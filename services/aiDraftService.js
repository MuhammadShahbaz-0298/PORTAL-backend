// Stores ZIP text and creates AI feedback drafts.
// The AI only suggests text and marks; it never saves a grade.

const fs = require("fs/promises");
const path = require("path");
const Submission = require("../models/Submission");
const { readAiSettings } = require("../config/env");
const { askAI } = require("../utils/aiClient");
const { extractZipText } = require("../utils/zipText");
const { createQueue } = require("../utils/aiQueue");
const { parseDraftResponse, renderPrompt } = require("./aiDraftParser");
const { AppError } = require("../utils/errors");
const {
  AI_ERROR_MAX_LENGTH,
  AI_MAX_ATTEMPTS,
  AI_MAX_CONCURRENT_DRAFTS,
  AI_MAX_GENERATIONS,
  AI_OTHER_ERROR_WAIT_MS,
  AI_RATE_LIMIT_MAX_WAIT_MS,
  AI_RECOVERY_MIN_AGE_MS,
} = require("../constants");

const PROMPT_FILE = path.join(__dirname, "..", "prompts", "assignmentFeedback.md");
const SYSTEM_PROMPT =
  "You are a kind, specific teacher. Follow the instructions and reply with JSON only.";
const runDraftQueue = createQueue(AI_MAX_CONCURRENT_DRAFTS);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shortError(error) {
  if (error?.isRateLimited) {
    return "AI provider rate limit reached. Try again later.";
  }

  if (error?.statusCode) {
    return `AI provider error (HTTP ${error.statusCode}).`;
  }

  return "AI draft could not be generated.";
}

function formatFiles(files) {
  if (!files || files.length === 0) {
    return "(No readable source files were found.)";
  }

  return files.map((file) => `--- ${file.path} ---\n${file.text}`).join("\n\n");
}

// Runs during the upload request, while the ZIP still exists on disk.
async function saveSnapshot(submission, file, options = {}) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    return submission;
  }

  // generations is a lifetime counter, so replacing a file must not reset it.
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
    // A broken or unreadable ZIP must never fail the upload.
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

async function loadSubmissionForGeneration(submissionId) {
  return Submission.findById(submissionId)
    .select("+aiDraft.snapshot")
    .populate("assignment", "title description rubric");
}

function hasUsableSnapshot(draft) {
  return Boolean(
    draft.snapshot && Array.isArray(draft.snapshot.files) && draft.snapshot.files.length > 0,
  );
}

// The caller must already have a submission with an aiDraft object.
async function markDraftFailed(submission, message) {
  submission.aiDraft.status = "failed";
  submission.aiDraft.error = message;
  await submission.save();
  return submission;
}

// Returns false when this submission already used all lifetime generations.
async function countGeneration(submission) {
  const draft = submission.aiDraft;

  if ((draft.generations || 0) >= AI_MAX_GENERATIONS) {
    return false;
  }

  draft.generations = (draft.generations || 0) + 1;
  draft.attempts = 0;
  draft.status = "pending";
  draft.requestedAt = new Date();
  draft.error = "";
  await submission.save();
  return true;
}

async function buildPrompt(submission, draft) {
  const template = await fs.readFile(PROMPT_FILE, "utf8");
  const assignment = submission.assignment || {};

  return renderPrompt(template, {
    title: assignment.title || "",
    description: assignment.description || "",
    rubric: assignment.rubric || "",
    files: formatFiles(draft.snapshot.files),
  });
}

async function saveDraftReply(submission, settings, prompt) {
  const draft = submission.aiDraft;
  const rawReply = await askAI({ system: SYSTEM_PROMPT, prompt });
  const parsed = parseDraftResponse(rawReply);

  draft.status = "ready";
  draft.feedback = parsed.feedback;
  draft.suggestedMarks = parsed.suggestedMarks;
  draft.strengths = parsed.strengths;
  draft.improvements = parsed.improvements;
  draft.model = settings.model;
  draft.error = "";
  draft.generatedAt = new Date();
  await submission.save();
  return submission;
}

async function runAttempts(submission, settings, prompt, options) {
  const draft = submission.aiDraft;
  let lastError = null;

  for (let attempt = (draft.attempts || 0) + 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
    draft.attempts = attempt;
    await submission.save();

    try {
      return await saveDraftReply(submission, settings, prompt);
    } catch (error) {
      lastError = error;

      if (attempt >= AI_MAX_ATTEMPTS) {
        break;
      }

      const waitMs = error.isRateLimited
        ? Math.min((error.retryAfterSeconds || 60) * 1000, AI_RATE_LIMIT_MAX_WAIT_MS)
        : AI_OTHER_ERROR_WAIT_MS;

      await options.sleep(waitMs);
    }
  }

  draft.status = "failed";
  draft.error = String(shortError(lastError)).slice(0, AI_ERROR_MAX_LENGTH);
  await submission.save();
  return submission;
}

async function runGeneration(submissionId, settings, options) {
  const submission = await loadSubmissionForGeneration(submissionId);

  if (!submission || !submission.aiDraft) {
    return null;
  }

  if (!hasUsableSnapshot(submission.aiDraft)) {
    return markDraftFailed(submission, "No saved file snapshot.");
  }

  if (options.countGeneration !== false) {
    const started = await countGeneration(submission);

    if (!started) {
      return markDraftFailed(submission, "AI draft limit reached.");
    }
  }

  const prompt = await buildPrompt(submission, submission.aiDraft);

  return runAttempts(submission, settings, prompt, options);
}

async function generateDraft(submissionId, options = {}) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    return null;
  }

  const safeOptions = { sleep, ...options };

  // At most two drafts run at the same time, to respect small free-tier limits.
  return runDraftQueue(() => runGeneration(submissionId, settings, safeOptions));
}

function startDraftGeneration(submissionId, options = {}) {
  if (!readAiSettings().enabled) {
    return;
  }

  generateDraft(submissionId, options).catch(() => {
    // Logs never contain the API key or student code.
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

  // One at a time: a restart must not create a burst of AI calls.
  for (const item of pending) {
    try {
      await generateDraft(item._id, { countGeneration: false });
    } catch {
      console.error("AI draft recovery failed.");
    }
  }
}

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

module.exports = {
  saveSnapshot,
  generateDraft,
  startDraftGeneration,
  resumePendingDrafts,
  regenerateDraft,
  discardDraft,
};
