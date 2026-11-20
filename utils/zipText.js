// Read source text from a ZIP in memory.
// Nothing is extracted to disk; output is capped by file and character limits.

const { AI_MAX_FILES, AI_MAX_FILE_BYTES, AI_DEFAULT_MAX_INPUT_CHARS } = require("../constants");
const { openZip, readEntries, readEntryBytes } = require("./zipTextArchive");
const { collectCandidates } = require("./zipTextSelection");

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

  return text.length === 0 || controlCharacters / text.length < 0.01;
}

async function addCandidateText(zipfile, candidate, limits, collected) {
  let readResult;
  try {
    readResult = await readEntryBytes(zipfile, candidate.entry, limits.maxFileBytes);
  } catch {
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
    if (collected.files.length >= limits.maxFiles || collected.totalChars >= limits.maxTotalChars) {
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
