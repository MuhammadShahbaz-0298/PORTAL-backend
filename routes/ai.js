// Routes for AI helpers.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { generateDraft } = require("../controllers/aiAssignmentDraftController");
const { ask } = require("../controllers/aiAssistantController");

const router = express.Router();

router.use(auth);
router.post("/assignment-draft", requirePermission("assignments.create"), generateDraft);
router.post("/assistant/ask", requirePermission("dashboard.view"), ask);

module.exports = router;
