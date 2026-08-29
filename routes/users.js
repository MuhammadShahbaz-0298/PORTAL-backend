const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  listUsers,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
router.use(auth);
router.get("/", requireRole("admin", "teacher"), listUsers);
router.patch("/:id", requireRole("admin"), updateUser);
router.delete("/:id", requireRole("admin"), deleteUser);
module.exports = router;
