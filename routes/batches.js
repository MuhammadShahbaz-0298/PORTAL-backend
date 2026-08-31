const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  createBatch,
  enrollStudent,
  updateBatch,
  deleteBatch,
  getBatches,
  getBatchStudents,
} = require("../controllers/batchController");

router.get("/", auth, requirePermission("batches.view"), getBatches);
router.post("/", auth, requirePermission("batches.create"), createBatch);
router.patch("/:id", auth, requirePermission("batches.update"), updateBatch);
router.delete("/:id", auth, requirePermission("batches.delete"), deleteBatch);
router.post(
  "/:id/enroll",
  auth,
  requirePermission("batches.enroll"),
  enrollStudent,
);
router.get(
  "/:id/students",
  auth,
  requirePermission("batches.enroll"),
  getBatchStudents,
);

module.exports = router;
