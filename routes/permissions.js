const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  catalog,
  updateUserPermissions,
} = require("../controllers/permissionController");
router.use(auth, requireRole("admin"));
router.get("/", catalog);
router.patch("/users/:id", updateUserPermissions);
module.exports = router;
