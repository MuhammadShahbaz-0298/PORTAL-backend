// Google Calendar sync. Optional OAuth flow to push assignment due dates.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.use(auth);
router.get("/connect", requirePermission("assignments.view"), (request, response) => {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) {
    return response.status(503).json({ error: "Google Calendar sync is not configured." });
  }
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || "";
  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline`;
  return response.json({ connectUrl: url });
});

module.exports = router;
