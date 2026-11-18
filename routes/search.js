// Routes for global search.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { globalSearch } = require("../controllers/searchController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("dashboard.view"), globalSearch);

module.exports = router;
