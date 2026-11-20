// Reading, grading and downloading submissions.
// Upload and replacement rules live in submissionUploadService.js.

const Assignment = require("../models/Assignment");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const {
  assertGrade,
  assertOptionalString,
  assertString,
  assertNumber,
} = require("../utils/validation");

const uploadService = require("./submissionUploadService");
const submissionReadService = require("./submissionReadService");

async function gradeSubmission({ requester, submission, payload }) {
  const grade = assertGrade(payload.grade);
  const feedback = assertOptionalString(payload.feedback, "feedback", {
    allowEmpty: true,
    maxLength: 2000,
  });
  const nextStatus = payload.status === "rejected" ? "rejected" : "graded";
  const savedFeedback = feedback || null;

  // Optional structured rubric scores. Validate against the assignment's max per criterion.
  if (payload.rubricScores !== undefined) {
    const scores = Array.isArray(payload.rubricScores) ? payload.rubricScores : [];
    const assignment = await Assignment.findById(submission.assignment).select("rubricItems");
    const maxByCriterion = new Map(
      (assignment?.rubricItems || []).map((item) => [item.criterion, item.maxPoints]),
    );

    const cleanedScores = [];
    for (const score of scores) {
      if (!score || typeof score !== "object") {
        throw new AppError("Invalid rubric score entry.", 400);
      }
      const criterion = assertString(score.criterion, "criterion", { maxLength: 200 });
      const points = assertNumber(score.points, "points", { min: 0 });
      const maxPoints = maxByCriterion.get(criterion);
      if (maxPoints === undefined) {
        throw new AppError(`Unknown rubric criterion: ${criterion}.`, 400);
      }
      if (points > maxPoints) {
        throw new AppError(`Score for ${criterion} exceeds maximum of ${maxPoints}.`, 400);
      }
      cleanedScores.push({ criterion, points });
    }
    submission.rubricScores = cleanedScores;
  }

  submission.grade = grade;
  submission.feedback = savedFeedback;
  submission.status = nextStatus;
  submission.gradedBy = getUserId(requester);
  submission.gradedAt = new Date();

  // Record whether the teacher used the AI draft as-is or changed it.
  if (submission.aiDraft && submission.aiDraft.status === "ready") {
    submission.aiDraft.status = savedFeedback === submission.aiDraft.feedback ? "used" : "edited";
  }

  await submission.save();

  return submission;
}

module.exports = {
  ...uploadService,
  gradeSubmission,
  ...submissionReadService,
};
