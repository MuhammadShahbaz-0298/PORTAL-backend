const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  listRoles,
  createRole,
  updateRole,
} = require("../controllers/roleController");
router.use(auth, requireRole("admin"));
router.get("/", listRoles);
router.post("/", createRole);
router.patch("/:id", updateRole);
module.exports = router;
