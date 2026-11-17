// Turns the AI's text reply into safe draft fields.
// The AI suggests text and marks only; the teacher still saves the real grade.

const {
  AI_FEEDBACK_MAX_LENGTH,
  AI_FEEDBACK_ITEMS_MAX,
  AI_FEEDBACK_ITEM_MAX_LENGTH,
} = require("../constants");

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function stripEmails(text) {
  return String(text || "")
    .replace(EMAIL_PATTERN, "[email removed]")
    .trim();
}

function cleanText(value, maxLength) {
  if (value === undefined || value === null) {
    return "";
  }

  return stripEmails(value).slice(0, maxLength);
}

function cleanList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(item, AI_FEEDBACK_ITEM_MAX_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, AI_FEEDBACK_ITEMS_MAX);
}

function clampMarks(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

// The model sometimes wraps JSON in markdown fences or adds a sentence first.
function extractJsonObject(rawText) {
  const withoutFences = String(rawText)
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "");

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseDraftResponse(rawText) {
  const parsed = extractJsonObject(rawText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The AI reply was not valid JSON.");
  }

  const feedback = cleanText(parsed.feedback, AI_FEEDBACK_MAX_LENGTH);
  if (!feedback) {
    throw new Error("The AI reply did not include feedback.");
  }

  return {
    feedback,
    suggestedMarks: clampMarks(parsed.suggestedMarks),
    strengths: cleanList(parsed.strengths),
    improvements: cleanList(parsed.improvements),
  };
}

function renderPrompt(template, values) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

module.exports = { parseDraftResponse, renderPrompt, extractJsonObject, stripEmails, clampMarks };
