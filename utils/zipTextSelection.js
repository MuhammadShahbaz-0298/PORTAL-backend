// Select source files from a ZIP while excluding sensitive and generated files.
// Candidate order prefers root files and source directories, preserving ZIP order for ties.

const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".svn", ".hg", "__MACOSX"]);
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
  if (parts.includes("..") || baseName.startsWith(".env")) {
    return true;
  }
  if (SKIPPED_FILE_NAMES.has(baseName)) {
    return true;
  }

  return BINARY_EXTENSIONS.has(extension);
}

function scorePath(fileName) {
  const parts = fileName.toLowerCase().split("/");
  if (parts.length === 1) {
    return 0;
  }
  return parts.includes("src") ? 1 : 2;
}

function compareCandidates(left, right) {
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  return left.index - right.index;
}

function collectCandidates(entries) {
  const candidates = [];

  entries.forEach((entry, index) => {
    const entryPath = normalizeEntryPath(entry.fileName);
    if (!entryPath || entryPath.endsWith("/") || shouldSkipPath(entryPath)) {
      return;
    }

    candidates.push({ entry, path: entryPath, index, score: scorePath(entryPath) });
  });

  candidates.sort(compareCandidates);
  return candidates;
}

module.exports = { collectCandidates };
