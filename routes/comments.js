// Routes for comments on submissions.
// Authentication and permissions run before service-level ownership checks.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listComments, createComment, archiveComment } = require("../controllers/commentController");

const router = express.Router({ mergeParams: true });

router.use(auth);
router.get("/", requirePermission("comments.view"), listComments);
router.post("/", requirePermission("comments.create"), createComment);
router.patch("/:id/archive", requirePermission("comments.create"), archiveComment);

module.exports = router;
