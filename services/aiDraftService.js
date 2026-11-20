// Queue and coordinate AI feedback draft generation.
// Drafts are best-effort and never block submission uploads or grading.

const Submission = require("../models/Submission");
const { readAiSettings } = require("../config/env");
const { createQueue } = require("../utils/aiQueue");
const {
  AI_MAX_CONCURRENT_DRAFTS,
  AI_RECOVERY_MIN_AGE_MS,
  AI_MAX_ATTEMPTS,
} = require("../constants");
const { runGeneration } = require("./aiDraftGenerationWorker");
const snapshotService = require("./aiDraftSnapshotService");
const lifecycleService = require("./aiDraftLifecycleService");

const runDraftQueue = createQueue(AI_MAX_CONCURRENT_DRAFTS);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function generateDraft(submissionId, options = {}) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    return null;
  }

  const safeOptions = { sleep, ...options };
  return runDraftQueue(() => runGeneration(submissionId, settings, safeOptions));
}

function startDraftGeneration(submissionId, options = {}) {
  if (!readAiSettings().enabled) {
    return;
  }

  generateDraft(submissionId, options).catch(() => {
    console.error("AI draft generation failed.");
  });
}

async function resumePendingDrafts() {
  if (!readAiSettings().enabled) {
    return;
  }

  const cutoff = new Date(Date.now() - AI_RECOVERY_MIN_AGE_MS);
  const pending = await Submission.find({
    "aiDraft.status": "pending",
    "aiDraft.attempts": { $lt: AI_MAX_ATTEMPTS },
    "aiDraft.requestedAt": { $lt: cutoff },
  })
    .select("_id")
    .lean();

  for (const item of pending) {
    try {
      await generateDraft(item._id, { countGeneration: false });
    } catch {
      console.error("AI draft recovery failed.");
    }
  }
}

module.exports = {
  ...snapshotService,
  ...lifecycleService,
  generateDraft,
  startDraftGeneration,
  resumePendingDrafts,
};
