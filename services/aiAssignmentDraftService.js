// AI assignment draft generator. Draft only; nothing is saved automatically.

const fs = require("fs/promises");
const path = require("path");
const { askAI } = require("../utils/aiClient");
const { readAiSettings } = require("../config/env");
const { AppError } = require("../utils/errors");

const PROMPT_FILE = path.join(__dirname, "..", "prompts", "assignmentDraft.md");

async function generateAssignmentDraft({ idea }) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    throw new AppError("AI drafts are disabled.", 503);
  }

  if (!idea || typeof idea !== "string" || idea.trim().length < 5) {
    throw new AppError("A short idea is required.", 400);
  }

  const template = await fs.readFile(PROMPT_FILE, "utf8");
  const prompt = `${template}\n\nTeacher's idea: ${idea.trim()}`;

  const rawReply = await askAI({
    system: "You are a helpful teacher's assistant. Reply with JSON only.",
    prompt,
  });

  let parsed;
  try {
    parsed = JSON.parse(rawReply);
  } catch {
    // Try to extract JSON from the reply.
    const match = rawReply.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new AppError("AI did not return valid JSON.", 502);
    }
  }

  return {
    title: String(parsed.title || "").slice(0, 160),
    description: String(parsed.description || "").slice(0, 5000),
    rubricItems: Array.isArray(parsed.rubricItems)
      ? parsed.rubricItems.map((item) => ({
          criterion: String(item.criterion || "").slice(0, 200),
          maxPoints: Number(item.maxPoints) || 0,
        }))
      : [],
  };
}

module.exports = { generateAssignmentDraft };
