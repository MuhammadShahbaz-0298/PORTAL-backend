// Reads source text from a ZIP in memory.
// Nothing is extracted to disk, and caps use REAL bytes read, not sizes declared in the ZIP.

const yauzl = require("yauzl");
const { AI_MAX_FILES, AI_MAX_FILE_BYTES, AI_DEFAULT_MAX_INPUT_CHARS } = require("../constants");

// Folders that never contain useful student source code.
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".svn", ".hg", "__MACOSX"]);

// Lockfiles are noise for the AI and are often very large.
const SKIPPED_FILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
  "poetry.lock",
  "pipfile.lock",
]);

// Images, archives and compiled files are not text.
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".bin",
  ".wasm",
  ".sqlite",
  ".db",
]);

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: false }, (error, zipfile) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(zipfile);
    });
  });
}

// Read the central directory first so we can choose the best files before reading them.
function readEntries(zipfile) {
  return new Promise((resolve, reject) => {
    const entries = [];

    zipfile.on("entry", (entry) => {
      entries.push(entry);
      zipfile.readEntry();
    });
    zipfile.on("end", () => resolve(entries));
    zipfile.on("error", reject);
    zipfile.readEntry();
  });
}

function normalizeEntryPath(fileName) {
  return String(fileName).replace(/\\/g, "/").replace(/^\.\//, "");
}

function shouldSkipPath(fileName) {
  const lowerName = fileName.toLowerCase();
  const parts = lowerName.split("/");
  const baseName = parts[parts.length - 1];
  const extensionIndex = baseName.lastIndexOf(".");
  const extension = extensionIndex === -1 ? "" : baseName.slice(extensionIndex);

  if (parts.some((part) => SKIPPED_DIRECTORIES.has(part))) {
    return true;
  }

  if (parts.includes("..")) {
    return true;
  }

  if (baseName.startsWith(".env")) {
    return true;
  }

  if (SKIPPED_FILE_NAMES.has(baseName)) {
    return true;
  }

  return BINARY_EXTENSIONS.has(extension);
}

// Lower score means "more likely to be real source code".
function scorePath(fileName) {
  const parts = fileName.toLowerCase().split("/");

  if (parts.length === 1) {
    return 0;
  }

  if (parts.includes("src")) {
    return 1;
  }

  return 2;
}

// Best files first. Files with the same score keep their order from the ZIP.
function compareCandidates(left, right) {
  if (left.score !== right.score) {
    return left.score - right.score;
  }

  return left.index - right.index;
}

// Read one entry and stop at maxBytes. It returns real bytes, not the declared size.
function readEntryBytes(zipfile, entry, maxBytes) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      const chunks = [];
      let bytesRead = 0;
      let truncated = false;
      let finished = false;

      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;
        resolve({ buffer: Buffer.concat(chunks), truncated });
      };

      stream.on("data", (chunk) => {
        if (finished) {
          return;
        }

        const remaining = maxBytes - bytesRead;
        if (remaining <= 0) {
          truncated = true;
          stream.destroy();
          finish();
          return;
        }

        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          bytesRead += remaining;
          truncated = true;
          stream.destroy();
          finish();
          return;
        }

        chunks.push(chunk);
        bytesRead += chunk.length;
      });

      stream.on("end", finish);
      stream.on("error", (streamError) => {
        if (truncated) {
          finish();
          return;
        }

        if (!finished) {
          finished = true;
          reject(streamError);
        }
      });
    });
  });
}

// A simple binary check: NUL bytes and too many control characters mean "not text".
function looksLikeText(buffer) {
  if (buffer.includes(0)) {
    return false;
  }

  const text = buffer.toString("utf8");
  let controlCharacters = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (code < 32 && !isAllowedWhitespace) {
      controlCharacters += 1;
    }
  }

  return controlCharacters / Math.max(text.length, 1) < 0.05;
}

// Only real source files are worth sending to the AI.
function collectCandidates(entries) {
  const candidates = [];

  entries.forEach((entry, index) => {
    if (entry.fileName.endsWith("/")) {
      return;
    }

    const entryPath = normalizeEntryPath(entry.fileName);
    if (!entryPath || shouldSkipPath(entryPath)) {
      return;
    }

    candidates.push({ entry, path: entryPath, index, score: scorePath(entryPath) });
  });

  candidates.sort(compareCandidates);
  return candidates;
}

// Adds one readable file to the result. Unreadable files are simply skipped.
async function addCandidateText(zipfile, candidate, limits, collected) {
  let readResult;
  try {
    readResult = await readEntryBytes(zipfile, candidate.entry, limits.maxFileBytes);
  } catch {
    // Unreadable entries are skipped; the rest of the archive is still useful.
    return;
  }

  if (readResult.truncated) {
    collected.truncated = true;
  }

  if (!looksLikeText(readResult.buffer)) {
    return;
  }

  const text = readResult.buffer.toString("utf8");
  if (!text.trim()) {
    return;
  }

  const remainingChars = limits.maxTotalChars - collected.totalChars;
  const finalText = text.length > remainingChars ? text.slice(0, remainingChars) : text;

  if (finalText.length < text.length) {
    collected.truncated = true;
  }

  collected.files.push({ path: candidate.path, text: finalText });
  collected.totalChars += finalText.length;
}

async function collectFileText(zipfile, candidates, limits) {
  const collected = { files: [], truncated: false, totalChars: 0 };

  for (const candidate of candidates) {
    if (
      collected.files.length >= limits.maxFiles ||
      collected.totalChars >= limits.maxTotalChars
    ) {
      collected.truncated = true;
      break;
    }

    await addCandidateText(zipfile, candidate, limits, collected);
  }

  return collected;
}

async function extractZipText(filePath, options = {}) {
  const limits = {
    maxFiles: options.maxFiles ?? AI_MAX_FILES,
    maxFileBytes: options.maxFileBytes ?? AI_MAX_FILE_BYTES,
    maxTotalChars: options.maxTotalChars ?? AI_DEFAULT_MAX_INPUT_CHARS,
  };

  const zipfile = await openZip(filePath);

  try {
    const entries = await readEntries(zipfile);
    const candidates = collectCandidates(entries);
    return await collectFileText(zipfile, candidates, limits);
  } finally {
    zipfile.close();
  }
}

module.exports = { extractZipText };
