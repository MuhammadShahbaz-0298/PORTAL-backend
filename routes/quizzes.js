// Routes for quizzes and attempts.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  submitAttempt,
  listAttempts,
} = require("../controllers/quizController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("quiz.view"), listQuizzes);
router.get("/:id", requirePermission("quiz.view"), getQuiz);
router.post("/", requirePermission("quiz.manage"), createQuiz);
router.patch("/:id", requirePermission("quiz.manage"), updateQuiz);
router.post("/:id/attempt", requirePermission("quiz.view"), submitAttempt);
router.get("/:id/attempts", requirePermission("quiz.view"), listAttempts);

module.exports = router;
