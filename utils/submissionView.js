// Shapes a submission for an HTTP response.
// Students never see AI drafts, and nobody sees the stored ZIP text snapshot.

const { ROLES } = require("../constants");
const { getUserRole } = require("./authorization");

function toVisibleSubmission(submission, requester) {
  if (!submission) {
    return submission;
  }

  const visible =
    typeof submission.toObject === "function" ? submission.toObject() : { ...submission };

  if (visible.aiDraft) {
    if (getUserRole(requester) === ROLES.STUDENT) {
      delete visible.aiDraft;
    } else {
      delete visible.aiDraft.snapshot;
    }
  }

  return visible;
}

function toVisibleSubmissionList(items, requester) {
  return items.map((item) => toVisibleSubmission(item, requester));
}

module.exports = { toVisibleSubmission, toVisibleSubmissionList };
