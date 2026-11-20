// HTTP routes for a ss ig nm en ts.
// Applies authentication and permissions before controllers run.
// Routes for assignments. Ownership is checked inside the service.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const assignmentController = require("../controllers/assignmentController");
const assignmentResourceController = require("../controllers/assignmentResourceController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("assignments.view"), assignmentController.listAssignments);
router.get("/:id", requirePermission("assignments.view"), assignmentController.getAssignment);
router.post("/", requirePermission("assignments.create"), assignmentController.createAssignment);
router.patch(
  "/:id",
  requirePermission("assignments.update"),
  assignmentController.updateAssignment,
);
router.delete(
  "/:id",
  requirePermission("assignments.delete"),
  assignmentController.deleteAssignment,
);
router.post(
  "/:id/resources",
  requirePermission("assignments.resources.upload"),
  assignmentResourceController.uploadSingleResource,
  assignmentResourceController.uploadResource,
);
router.get(
  "/:id/resources",
  requirePermission("assignments.resources.view"),
  assignmentResourceController.listResources,
);
router.get(
  "/:id/resources/:resourceId/download",
  requirePermission("assignments.resources.download"),
  assignmentResourceController.downloadResource,
);
router.delete(
  "/:id/resources/:resourceId",
  requirePermission("assignments.resources.delete"),
  assignmentResourceController.deleteResource,
);

module.exports = router;
