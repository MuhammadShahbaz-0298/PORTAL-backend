// Compare a submission snapshot with other submissions for its assignment.
// A similarity result is advisory and never blocks an upload.

const Submission = require("../models/Submission");
const { textSimilarity, extractSnapshotText } = require("../utils/similarity");

async function checkSimilarity(submissionId) {
  const threshold = Number(process.env.SIMILARITY_THRESHOLD) || 0.6;
  const current = await Submission.findById(submissionId).select("+aiDraft.snapshot").lean();

  if (!current || !current.aiDraft?.snapshot) {
    return;
  }

  const currentText = extractSnapshotText(current.aiDraft.snapshot);
  if (!currentText.trim()) {
    return;
  }

  const others = await Submission.find({
    assignment: current.assignment,
    _id: { $ne: current._id },
  })
    .select("+aiDraft.snapshot")
    .lean();

  let bestMatch = null;
  let bestScore = 0;

  for (const other of others) {
    const otherText = extractSnapshotText(other.aiDraft?.snapshot);
    if (!otherText.trim()) {
      continue;
    }
    const score = textSimilarity(currentText, otherText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = other._id;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    await Submission.updateOne(
      { _id: submissionId },
      {
        $set: { "similarityFlag.matchedSubmission": bestMatch, "similarityFlag.score": bestScore },
      },
    );
  }
}

module.exports = { checkSimilarity };
