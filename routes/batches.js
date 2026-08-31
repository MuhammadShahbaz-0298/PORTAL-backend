const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  createBatch,
  enrollStudent,
  updateBatch,
  deleteBatch,
  getBatches,
  getBatchStudents,
} = require("../controllers/batchController");

router.get("/", auth, getBatches);
router.post("/", auth, requireRole("admin"), createBatch);
router.patch("/:id", auth, requireRole("admin"), updateBatch);
router.delete("/:id", auth, requireRole("admin"), deleteBatch);
router.post(
  "/:id/enroll",
  auth,
  requireRole("admin"),
  enrollStudent,
);
router.get(
  "/:id/students",
  auth,
  requireRole("admin"),
  getBatchStudents,
);

module.exports = router;
