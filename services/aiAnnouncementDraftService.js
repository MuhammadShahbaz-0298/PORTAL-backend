// AI announcement draft helper. Draft only; never auto-publish.

const { askAI } = require("../utils/aiClient");
const { readAiSettings } = require("../config/env");
const { AppError } = require("../utils/errors");

async function draftAnnouncement({ note }) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    throw new AppError("AI drafts are disabled.", 503);
  }

  if (!note || typeof note !== "string" || note.trim().length < 5) {
    throw new AppError("A short note is required.", 400);
  }

  const prompt = `Turn the following short teacher note into a polished announcement. Return JSON with "title" and "body" fields only.\n\nNote: ${note.trim()}`;

  const rawReply = await askAI({
    system: "You are a helpful assistant. Reply with JSON only.",
    prompt,
  });

  let parsed;
  try {
    parsed = JSON.parse(rawReply);
  } catch {
    const match = rawReply.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new AppError("AI did not return valid JSON.", 502);
    }
  }

  return {
    title: String(parsed.title || "").slice(0, 200),
    body: String(parsed.body || "").slice(0, 5000),
  };
}

module.exports = { draftAnnouncement };
