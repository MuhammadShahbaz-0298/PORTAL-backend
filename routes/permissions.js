// Routes for the permission catalog and per-user extra permissions.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { catalog, updateUserPermissions } = require("../controllers/permissionController");

const router = express.Router();

router.use(auth, requirePermission("roles.manage"));
router.get("/", catalog);
router.patch("/users/:id", updateUserPermissions);

module.exports = router;
