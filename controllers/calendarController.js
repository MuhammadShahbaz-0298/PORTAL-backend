// HTTP layer for calendar .ics export.

const calendarService = require("../services/calendarService");
const asyncHandler = require("../utils/asyncHandler");

const getCalendar = asyncHandler(async (request, response) => {
  const ics = await calendarService.buildCalendar({ requester: request.user });
  response.setHeader("Content-Type", "text/calendar");
  response.setHeader("Content-Disposition", 'attachment; filename="calendar.ics"');
  return response.send(ics);
});

module.exports = { getCalendar };
