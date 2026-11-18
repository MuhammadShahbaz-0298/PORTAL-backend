// Routes for comments on a submission. Ownership is checked inside the service.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listComments, createComment, archiveComment } = require("../controllers/commentController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("comments.view"), listComments);
router.post("/", requirePermission("comments.create"), createComment);
router.patch("/:id/archive", requirePermission("comments.create"), archiveComment);

module.exports = router;
