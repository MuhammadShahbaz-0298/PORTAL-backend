// HTTP routes for c al en da r.
// Applies authentication and permissions before controllers run.
// Routes for calendar .ics export.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { getCalendar } = require("../controllers/calendarController");

const router = express.Router();

router.use(auth);
router.get("/calendar.ics", requirePermission("calendar.view"), getCalendar);

module.exports = router;
