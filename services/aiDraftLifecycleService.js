// Reset or discard a saved AI feedback draft.
// Generation limits remain lifetime limits across file replacements and retries.

const Submission = require("../models/Submission");
const { readAiSettings } = require("../config/env");
const { AppError } = require("../utils/errors");
const { AI_MAX_GENERATIONS } = require("../constants");

async function regenerateDraft({ submission }) {
  if (!readAiSettings().enabled) {
    throw new AppError("AI drafts are disabled.", 503);
  }

  const fresh = await Submission.findById(submission._id).select("+aiDraft.snapshot");
  if (!fresh) {
    throw new AppError("Submission not found.", 404);
  }
  if (!fresh.aiDraft) {
    throw new AppError("There is no saved AI draft to regenerate.", 409);
  }
  if ((fresh.aiDraft.generations || 0) >= AI_MAX_GENERATIONS) {
    throw new AppError(
      `AI drafts can be generated at most ${AI_MAX_GENERATIONS} times per submission.`,
      409,
    );
  }
  if (
    !fresh.aiDraft.snapshot ||
    !Array.isArray(fresh.aiDraft.snapshot.files) ||
    fresh.aiDraft.snapshot.files.length === 0
  ) {
    throw new AppError("The saved file snapshot is missing. Replace the ZIP to try again.", 409);
  }

  fresh.aiDraft.status = "pending";
  fresh.aiDraft.attempts = 0;
  fresh.aiDraft.error = "";
  fresh.aiDraft.requestedAt = new Date();
  await fresh.save();
  return fresh;
}

async function discardDraft({ submission }) {
  const fresh = await Submission.findById(submission._id);
  if (!fresh) {
    throw new AppError("Submission not found.", 404);
  }
  if (!fresh.aiDraft) {
    throw new AppError("There is no AI draft to discard.", 404);
  }

  fresh.aiDraft.status = "discarded";
  fresh.aiDraft.error = "";
  await fresh.save();
  return fresh;
}

module.exports = { regenerateDraft, discardDraft };
