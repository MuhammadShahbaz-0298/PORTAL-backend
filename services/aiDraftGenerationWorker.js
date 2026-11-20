// Execute one AI draft generation and persist its result.
// Retry policy and output limits are shared across background and recovery runs.

const fs = require("fs/promises");
const path = require("path");
const Submission = require("../models/Submission");
const { askAI } = require("../utils/aiClient");
const { parseDraftResponse, renderPrompt } = require("./aiDraftParser");
const {
  AI_ERROR_MAX_LENGTH,
  AI_MAX_ATTEMPTS,
  AI_MAX_GENERATIONS,
  AI_OTHER_ERROR_WAIT_MS,
  AI_RATE_LIMIT_MAX_WAIT_MS,
} = require("../constants");

const PROMPT_FILE = path.join(__dirname, "..", "prompts", "assignmentFeedback.md");
const SYSTEM_PROMPT =
  "You are a kind, specific teacher. Follow the instructions and reply with JSON only.";

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

async function markDraftFailed(submission, message) {
  submission.aiDraft.status = "failed";
  submission.aiDraft.error = message;
  await submission.save();
  return submission;
}

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
  if (options.countGeneration !== false && !(await countGeneration(submission))) {
    return markDraftFailed(submission, "AI draft limit reached.");
  }

  const prompt = await buildPrompt(submission, submission.aiDraft);
  return runAttempts(submission, settings, prompt, options);
}

module.exports = { runGeneration };
