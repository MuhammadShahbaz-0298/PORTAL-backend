// HTTP routes for s ea rc h.
// Applies authentication and permissions before controllers run.
// Routes for global search.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { globalSearch } = require("../controllers/searchController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("search.use"), globalSearch);

module.exports = router;
