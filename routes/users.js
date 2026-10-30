// Routes for users. Teachers only see students in their own batches.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listUsers, updateUser, deleteUser } = require("../controllers/userController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("students.view"), listUsers);
router.patch("/:id", requirePermission("users.manage"), updateUser);
router.delete("/:id", requirePermission("users.manage"), deleteUser);

module.exports = router;
