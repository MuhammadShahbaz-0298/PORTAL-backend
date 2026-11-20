// Read batch lists and enrolled students.
// Teachers and students only receive batches they are assigned to.

const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

async function listBatches({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["name"]);
  const filters = [{ active: true }, searchFilter];
  const role = getUserRole(requester);

  if (role === ROLES.TEACHER) {
    filters.push({ teacher: getUserId(requester) });
  }
  if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ _id: { $in: batchIds } });
  }

  const filter = { $and: filters };
  const total = await Batch.countDocuments(filter);
  const batches = await Batch.find(filter)
    .populate("teacher", "name email")
    .sort({ name: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  const items = [];
  for (const batch of batches) {
    const value = batch.toObject();
    value.studentCount = await Enrollment.countDocuments({
      batch: value._id,
      active: { $ne: false },
    });
    items.push(value);
  }

  return { items, pagination, total };
}

async function getBatchStudents({ requester, batchId, query }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const pagination = getPagination(query);
  const enrollmentFilter = { batch: batchId, active: { $ne: false } };
  const total = await Enrollment.countDocuments(enrollmentFilter);
  const enrollments = await Enrollment.find(enrollmentFilter)
    .populate("student", "name email role active")
    .sort({ createdAt: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  const students = enrollments.map((enrollment) => enrollment.student).filter(Boolean);
  return { items: students, pagination, total };
}

async function getEligibleStudents({ requester, batchId, query }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const batch = await Batch.findOne({ _id: batchId, active: true }).select("_id");
  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const pagination = getPagination(query);
  const enrolledInBatch = await Enrollment.find({
    batch: batchId,
    active: { $ne: false },
  }).distinct("student");
  const filters = [
    { role: ROLES.STUDENT },
    { active: true },
    { _id: { $nin: enrolledInBatch } },
    buildSearchFilter(query.search, ["name", "email"]),
  ];

  if (getUserRole(requester) === ROLES.TEACHER) {
    const teacherBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const [ownedStudents, enrolledStudents] = await Promise.all([
      Enrollment.find({
        batch: { $in: teacherBatchIds },
        active: { $ne: false },
      }).distinct("student"),
      Enrollment.distinct("student", { active: { $ne: false } }),
    ]);
    const enrolledSet = new Set(enrolledStudents.map(String));
    const unassignedStudents = await User.find({
      role: ROLES.STUDENT,
      active: true,
      _id: { $nin: [...enrolledSet] },
    })
      .select("_id")
      .lean();
    const visibleIds = [
      ...new Set([
        ...ownedStudents.map(String),
        ...unassignedStudents.map((student) => String(student._id)),
      ]),
    ];
    filters.push({ _id: { $in: visibleIds } });
  }

  const filter = { $and: filters };
  const total = await User.countDocuments(filter);
  const items = await User.find(filter)
    .select("name email role active")
    .sort({ name: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

module.exports = { listBatches, getBatchStudents, getEligibleStudents };
