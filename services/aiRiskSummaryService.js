// AI narrative summary for at-risk students. Rule-based detection stays rule-based;
// this only wraps the data in a plain-language paragraph.

const { askAI } = require("../utils/aiClient");
const { readAiSettings } = require("../config/env");
const RiskFlag = require("../models/RiskFlag");
const Batch = require("../models/Batch");

async function summarizeBatchRisk({ batchId }) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    return null;
  }

  const flags = await RiskFlag.find({ batch: batchId, status: "open" })
    .populate("student", "name")
    .lean();

  if (flags.length === 0) {
    return "No at-risk students flagged for this batch.";
  }

  const batch = await Batch.findById(batchId).lean();
  const lines = flags.map(
    (flag) =>
      `${flag.student?.name || "Unknown"}: attendance ${flag.attendancePercentage}%, missed ${flag.missedSubmissions} submissions, reasons: ${(flag.reasons || []).join(", ")}`,
  );

  const prompt = `Summarize the following at-risk student data for batch "${batch?.name || batchId}" in one short paragraph for a teacher. Do not invent data beyond what is provided.\n\n${lines.join("\n")}`;

  const reply = await askAI({
    system: "You are a helpful assistant. Reply with a single short paragraph.",
    prompt,
  });

  return reply;
}

module.exports = { summarizeBatchRisk };
