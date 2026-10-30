// Database work for assignments.
// Teachers may only manage assignments in batches they own.

const Assignment = require("../models/Assignment");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId, assertOptionalString } = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const { applyUpdateFields, buildCreateFields, isExpired } = require("./assignmentFields");

async function listAssignments({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["title"]);
  const filters = [searchFilter];
  const role = getUserRole(requester);
  const batchId = assertOptionalString(query.batchId, "batchId", { maxLength: 50 });

  if (batchId) {
    filters.push({ batch: assertObjectId(batchId, "batchId") });
  }

  if (role === ROLES.STUDENT) {
    const studentBatchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ active: true });
    filters.push({ dueDate: { $gt: new Date() } });
    filters.push({ batch: { $in: studentBatchIds } });
  }

  if (role === ROLES.TEACHER) {
    const teacherBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const allowedBatchIds = batchId
      ? teacherBatchIds.filter((id) => String(id) === batchId)
      : teacherBatchIds;
    filters.push({ batch: { $in: allowedBatchIds } });
  }

  const filter = { $and: filters };
  const total = await Assignment.countDocuments(filter);
  const items = await Assignment.find(filter)
    .populate("batch", "name")
    .populate("createdBy", "name email")
    .sort({ dueDate: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

async function getAssignment({ requester, assignmentId }) {
  assertObjectId(assignmentId, "assignment id");
  const assignment = await Assignment.findById(assignmentId).populate("batch", "name teacher");

  if (!assignment) {
    throw new AppError("Assignment not found.", 404);
  }

  const role = getUserRole(requester);

  if (role === ROLES.ADMIN) {
    return assignment;
  }

  if (role === ROLES.TEACHER) {
    if (!assignment.batch || String(assignment.batch.teacher) !== getUserId(requester)) {
      throw new AppError("You cannot view this assignment.", 403);
    }
    return assignment;
  }

  if (role === ROLES.STUDENT) {
    if (!assignment.active) {
      throw new AppError("This assignment is closed.", 410);
    }

    await batchAccessService.assertCanAccessBatch(requester, assignment.batch?._id);
    return assignment;
  }

  throw new AppError("You cannot view this assignment.", 403);
}

async function createAssignment({ requester, payload }) {
  const batchId = assertObjectId(payload.batch, "batch");
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const assignment = await Assignment.create(
    buildCreateFields({ batchId, payload, createdBy: getUserId(requester) }),
  );

  return assignment.populate("batch", "name");
}

async function updateAssignment({ requester, assignmentId, payload }) {
  assertObjectId(assignmentId, "assignment id");
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    throw new AppError("Assignment not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, assignment.batch);
  applyUpdateFields(assignment, payload);
  await assignment.save();

  return assignment;
}

async function deleteAssignment({ requester, assignmentId }) {
  assertObjectId(assignmentId, "assignment id");
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    throw new AppError("Assignment not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, assignment.batch);
  assignment.active = false;
  assignment.closedAt = new Date();
  await assignment.save();

  return { message: "Assignment archived." };
}

module.exports = {
  isExpired,
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
