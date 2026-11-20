// List announcements visible to a requester.
// Batch and school-wide visibility is enforced in the database filter.

const Announcement = require("../models/Announcement");
const { ROLES } = require("../constants");
const { getUserId, getUserRole } = require("../utils/authorization");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

async function listAnnouncements({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["title", "body"]);
  const filters = [{ active: true }, searchFilter];
  const role = getUserRole(requester);

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({
      $or: [{ scope: "school" }, { scope: "batch", batch: { $in: ownedBatchIds } }],
    });
  } else if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({
      $or: [{ scope: "school" }, { scope: "batch", batch: { $in: batchIds } }],
    });
  } else if (role !== ROLES.ADMIN) {
    filters.push({ scope: "school" });
  }

  const filter = { $and: filters };
  const total = await Announcement.countDocuments(filter);
  const items = await Announcement.find(filter)
    .populate("createdBy", "name email role")
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

module.exports = { listAnnouncements };
