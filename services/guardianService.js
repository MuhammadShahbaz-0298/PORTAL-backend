// Read-only access for a guardian over their linked children.
// Reuses batchAccessService patterns for batch scoping.

const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");

// Returns the students a guardian is linked to.
async function getLinkedChildren({ requester }) {
  if (getUserRole(requester) !== "guardian") {
    throw new AppError("Only a guardian may list linked children.", 403);
  }

  const guardian = await User.findById(getUserId(requester)).select("guardianOf name email");
  if (!guardian) {
    throw new AppError("Guardian not found.", 404);
  }

  const childIds = guardian.guardianOf || [];
  const children = await User.find({
    _id: { $in: childIds },
    role: ROLES.STUDENT,
    active: true,
  }).select("name email _id");

  return children;
}

// Returns the batch ids a guardian can see through their linked children.
async function getGuardianBatchIds(guardianId) {
  const guardian = await User.findById(guardianId).select("guardianOf").lean();
  if (!guardian) {
    return [];
  }

  const childIds = guardian.guardianOf || [];
  const enrollments = await Enrollment.find({ student: { $in: childIds } })
    .select("batch")
    .lean();
  return enrollments.map((enrollment) => enrollment.batch);
}

// Checks that a guardian may view a given student's records.
async function assertCanViewChild(requester, studentId) {
  if (getUserRole(requester) !== "guardian") {
    throw new AppError("Only a guardian may view child records.", 403);
  }

  assertObjectId(studentId, "student id");

  const guardian = await User.findById(getUserId(requester)).select("guardianOf").lean();
  if (!guardian) {
    throw new AppError("Guardian not found.", 404);
  }

  const isLinked = (guardian.guardianOf || []).some((id) => String(id) === String(studentId));
  if (!isLinked) {
    throw new AppError("You are not linked to this student.", 403);
  }
}

module.exports = {
  getLinkedChildren,
  getGuardianBatchIds,
  assertCanViewChild,
};
