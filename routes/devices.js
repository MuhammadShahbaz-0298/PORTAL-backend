// Authenticated routes for registering and removing push devices.
// Device ownership is scoped to the current user by the service.

const express = require("express");
const auth = require("../middleware/auth");
const { registerDevice, unregisterDevice } = require("../controllers/deviceController");

const router = express.Router();

router.use(auth);
router.post("/", registerDevice);
router.delete("/:token", unregisterDevice);

module.exports = router;
