// Build role-safe context for the portal assistant.
// Students get only their own progress; staff get portal workflow guidance.

const { askAI } = require("../utils/aiClient");
const { readAiSettings } = require("../config/env");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");

const STAFF_PORTAL_GUIDE = [
  "Review submissions: open Grading, choose a submission, enter marks and feedback, then save the grade.",
  "Mark attendance: open Attendance, select the batch and date, mark each learner's status, then save.",
  "Create an announcement: open Announcements, choose New announcement, enter a title and body, select the school or batch audience, then publish.",
  "Create a quiz: open Quizzes, choose New quiz, select a batch, add questions manually or import the Excel example, review the correct answers, then create the quiz.",
  "Quiz scores are calculated automatically from the selected correct options when a student submits. AI does not grade quiz attempts.",
  "View quiz scores: open Quizzes and choose the results action for a quiz. Results show each attempt's score and total.",
  "Schedule a class: open Timetable, choose a batch, add an entry, and set its day and time.",
].join("\n");

const STUDENT_PORTAL_GUIDE = [
  "Assignments: open Assignments to read instructions and due dates, then use the submission action to upload your work.",
  "Submissions: open Submissions to see the status, grade, and feedback for your own work.",
  "Attendance: open Attendance to see your own attendance record.",
  "Quizzes: open Quizzes to take a quiz assigned to your batch. Your score is calculated automatically when you submit; AI does not grade quiz attempts.",
].join("\n");

function buildAssistantContext({ role, submissions = [], attendance = [] }) {
  const context = {
    role,
    portalGuide:
      role === ROLES.STUDENT
        ? STUDENT_PORTAL_GUIDE
        : role === ROLES.ADMIN || role === ROLES.TEACHER
          ? STAFF_PORTAL_GUIDE
          : "Answer general portal navigation questions only. Do not claim access to student records or staff actions.",
  };

  if (role === ROLES.STUDENT) {
    context.studentProgress = {
      submissions: submissions.map((submission) => ({
        assignment: submission.assignment?.title,
        status: submission.status,
        grade: submission.grade,
        submittedAt: submission.submittedAt,
      })),
      attendance: attendance.map((record) => ({
        date: record.date,
        status: record.status,
      })),
    };
  }

  return context;
}

async function askAssistant({ requester, question }) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    throw new AppError("AI assistant is disabled.", 503);
  }

  if (typeof question !== "string" || !question.trim()) {
    throw new AppError("A question is required.", 400);
  }

  const role = getUserRole(requester);
  let submissions = [];
  let attendance = [];

  if (role === ROLES.STUDENT) {
    const studentId = getUserId(requester);
    [submissions, attendance] = await Promise.all([
      Submission.find({ student: studentId }).populate("assignment", "title dueDate").lean(),
      Attendance.find({ student: studentId }).lean(),
    ]);
  }

  const context = buildAssistantContext({ role, submissions, attendance });
  const prompt = `You are a helpful portal assistant for a ${role}. Use portalGuide for portal workflow questions. Use studentProgress only for the student's own records. If the guide or available data does not answer the question, say what is missing and ask a useful follow-up instead of giving a generic refusal or inventing facts. Never claim to perform an action or reveal another user's data.\n\nAvailable context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question.trim()}`;

  const reply = await askAI({
    system:
      "You are a concise support assistant for a school portal. Answer how-to questions from the provided portal guide. Treat student progress as private, and never invent portal capabilities or claim that AI grades quizzes.",
    prompt,
  });

  return { answer: reply };
}

module.exports = { askAssistant, buildAssistantContext };
