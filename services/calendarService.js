// Generates an iCalendar (.ics) feed for a user's assignment due dates and announcements.

const { createEvents } = require("ics");
const Assignment = require("../models/Assignment");
const Announcement = require("../models/Announcement");

const { ROLES } = require("../constants");
const { getUserId, getUserRole } = require("../utils/authorization");
const batchAccessService = require("./batchAccessService");

async function buildCalendar({ requester }) {
  const role = getUserRole(requester);
  const userId = getUserId(requester);

  let batchIds = [];
  if (role === ROLES.STUDENT) {
    batchIds = await batchAccessService.getStudentBatchIds(userId);
  } else if (role === ROLES.TEACHER) {
    batchIds = await batchAccessService.getTeacherBatchIds(userId);
  }

  const assignments = await Assignment.find({
    active: true,
    batch: { $in: batchIds },
  })
    .populate("batch", "name")
    .lean();

  const announcements = await Announcement.find({
    active: true,
    $or: [{ scope: "school" }, { scope: "batch", batch: { $in: batchIds } }],
  }).lean();

  const events = [];

  for (const assignment of assignments) {
    if (!assignment.dueDate) {
      continue;
    }
    const due = new Date(assignment.dueDate);
    events.push({
      title: `Due: ${assignment.title}`,
      description: assignment.description || "",
      start: [
        due.getFullYear(),
        due.getMonth() + 1,
        due.getDate(),
        due.getHours() || 9,
        due.getMinutes() || 0,
      ],
      duration: { hours: 1 },
    });
  }

  for (const announcement of announcements) {
    if (!announcement.createdAt) {
      continue;
    }
    const created = new Date(announcement.createdAt);
    events.push({
      title: `Announcement: ${announcement.title}`,
      description: announcement.body || "",
      start: [created.getFullYear(), created.getMonth() + 1, created.getDate(), 9, 0],
      duration: { hours: 1 },
    });
  }

  const { error, value } = createEvents(events);
  if (error) {
    throw new Error("Could not generate calendar.");
  }

  return value;
}

module.exports = { buildCalendar };
