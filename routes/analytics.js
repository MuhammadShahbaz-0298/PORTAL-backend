// HTTP routes for a na ly ti cs.
// Applies authentication and permissions before controllers run.
// Routes for analytics. Read-only, restricted to analytics.view permission.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { batchAnalytics, overviewAnalytics } = require("../controllers/analyticsController");

const router = express.Router();

router.use(auth);
router.get("/batch/:id", requirePermission("analytics.view"), batchAnalytics);
router.get("/overview", requirePermission("analytics.view"), overviewAnalytics);

module.exports = router;
