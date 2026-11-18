// Routes for session/device management.

const express = require("express");
const auth = require("../middleware/auth");
const { listSessions, revokeSession } = require("../controllers/sessionManagementController");

const router = express.Router();

router.use(auth);
router.get("/", listSessions);
router.delete("/:id", revokeSession);

module.exports = router;
