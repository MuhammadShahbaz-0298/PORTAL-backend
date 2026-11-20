// Register authenticated routes for batches and enrollment.
// Permission checks run before controllers; ownership checks stay in services.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  getBatches,
  createBatch,
  updateBatch,
  archiveBatch,
  deleteBatch,
  enrollStudent,
  unenrollStudent,
  getBatchStudents,
  getEligibleStudents,
} = require("../controllers/batchController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("batches.view"), getBatches);
router.post("/", requirePermission("batches.create"), createBatch);
router.patch("/:id", requirePermission("batches.update"), updateBatch);
router.patch("/:id/archive", requirePermission("batches.delete"), archiveBatch);
router.delete("/:id", requirePermission("batches.delete"), deleteBatch);
router.post("/:id/enroll", requirePermission("batches.enroll"), enrollStudent);
router.delete("/:id/students/:studentId", requirePermission("batches.enroll"), unenrollStudent);
router.get("/:id/eligible-students", requirePermission("batches.enroll"), getEligibleStudents);
router.get("/:id/students", requirePermission("batches.view"), getBatchStudents);

module.exports = router;
