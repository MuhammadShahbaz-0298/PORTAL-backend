// HTTP routes for q ui zz es.
// Applies authentication and permissions before controllers run.
// Routes for quizzes and attempts.

const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  submitAttempt,
  startAttempt,
  saveAttemptAnswers,
  recordFocusViolation,
  listAttempts,
  downloadQuestionTemplate,
  importQuestions,
} = require("../controllers/quizController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(auth);
router.get("/questions/template", requirePermission("quiz.manage"), downloadQuestionTemplate);
router.post(
  "/questions/import",
  requirePermission("quiz.manage"),
  upload.single("file"),
  importQuestions,
);
router.get("/", requirePermission("quiz.view"), listQuizzes);
router.get("/:id", requirePermission("quiz.view"), getQuiz);
router.post("/", requirePermission("quiz.manage"), createQuiz);
router.patch("/:id", requirePermission("quiz.manage"), updateQuiz);
router.post("/:id/attempt/start", requirePermission("quiz.view"), startAttempt);
router.post("/:id/attempt/violation", requirePermission("quiz.view"), recordFocusViolation);
router.patch("/:id/attempt", requirePermission("quiz.view"), saveAttemptAnswers);
router.post("/:id/attempt", requirePermission("quiz.view"), submitAttempt);
router.get("/:id/attempts", requirePermission("quiz.view"), listAttempts);

module.exports = router;
