// Check assignment resource permissions for each user role.
// Student download denials return 404 so resource existence is not exposed.

const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const batchAccessService = require("./batchAccessService");

async function assertCanManageResources(requester, assignment) {
  if (isAdmin(requester)) {
    return;
  }
  if (getUserRole(requester) !== ROLES.TEACHER) {
    throw new AppError("You do not have permission to change this assignment's resources.", 403);
  }

  const isOwner = String(assignment.createdBy) === getUserId(requester);
  const managesBatch =
    assignment.batch && (await batchAccessService.canManageBatch(requester, assignment.batch));
  if (!isOwner && !managesBatch) {
    throw new AppError("You do not have permission to change this assignment's resources.", 403);
  }
}

async function assertCanViewResources(requester, assignment) {
  if (isAdmin(requester)) {
    return;
  }

  const role = getUserRole(requester);
  if (role === ROLES.TEACHER) {
    const isOwner = String(assignment.createdBy) === getUserId(requester);
    const managesBatch =
      assignment.batch && (await batchAccessService.canManageBatch(requester, assignment.batch));
    if (isOwner || managesBatch) {
      return;
    }
  }

  if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    const isEnrolled = batchIds.some((batchId) => String(batchId) === String(assignment.batch));
    if (isEnrolled) {
      return;
    }
  }

  throw new AppError("You do not have access to this assignment's resources.", 403);
}

async function assertCanDownload(requester, assignment) {
  try {
    await assertCanViewResources(requester, assignment);
  } catch {
    throw new AppError("Resource not found.", 404);
  }
}

module.exports = { assertCanManageResources, assertCanViewResources, assertCanDownload };
