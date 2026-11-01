// Routes for roles.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listRoles, createRole, updateRole, deleteRole } = require("../controllers/roleController");

const router = express.Router();

router.use(auth, requirePermission("roles.manage"));
router.get("/", listRoles);
router.post("/", createRole);
router.patch("/:id", updateRole);
router.delete("/:id", deleteRole);

module.exports = router;
