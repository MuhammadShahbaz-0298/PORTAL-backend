// Routes for feature flags.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listFlags, checkFlag, upsertFlag } = require("../controllers/featureFlagController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("roles.manage"), listFlags);
router.get("/:key", checkFlag);
router.post("/", requirePermission("roles.manage"), upsertFlag);

module.exports = router;
