// Save a bounded snapshot of the uploaded source archive.
// Snapshot failures update the draft state without failing the student upload.

const { readAiSettings } = require("../config/env");
const { extractZipText } = require("../utils/zipText");
const { AI_MAX_GENERATIONS } = require("../constants");

async function saveSnapshot(submission, file, options = {}) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    return submission;
  }

  let generations;
  if (options.generations !== undefined) {
    generations = options.generations;
  } else if (submission.aiDraft?.generations !== undefined) {
    generations = submission.aiDraft.generations;
  } else {
    generations = 0;
  }

  if (generations >= AI_MAX_GENERATIONS) {
    submission.aiDraft = {
      status: "failed",
      error: "AI draft limit reached.",
      generations,
      attempts: 0,
      requestedAt: new Date(),
    };
    await submission.save();
    return submission;
  }

  try {
    const snapshot = await extractZipText(file.path, {
      maxTotalChars: settings.maxInputChars,
    });

    submission.aiDraft = {
      status: "pending",
      snapshot,
      attempts: 0,
      generations,
      requestedAt: new Date(),
      error: "",
    };
  } catch {
    submission.aiDraft = {
      status: "failed",
      error: "Could not read the uploaded ZIP.",
      attempts: 0,
      generations,
      requestedAt: new Date(),
    };
  }

  await submission.save();
  return submission;
}

module.exports = { saveSnapshot };
