// HTTP routes for a ud it lo g.
// Applies authentication and permissions before controllers run.
// Routes for audit log. Read-only, restricted to audit.view permission.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listAuditLogs } = require("../controllers/auditLogController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("audit.view"), listAuditLogs);

module.exports = router;
