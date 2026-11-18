// Student FAQ chatbot. Answers using only the student's own data.

const { askAI } = require("../utils/aiClient");
const { readAiSettings } = require("../config/env");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");

async function askAssistant({ requester, question }) {
  const settings = readAiSettings();
  if (!settings.enabled) {
    throw new AppError("AI assistant is disabled.", 503);
  }

  if (!question || typeof question !== "string" || question.trim().length < 3) {
    throw new AppError("A question is required.", 400);
  }

  const studentId = getUserId(requester);

  // Fetch only this student's data.
  const submissions = await Submission.find({ student: studentId })
    .populate("assignment", "title dueDate")
    .lean();
  const attendance = await Attendance.find({ student: studentId }).lean();

  const context = {
    submissions: submissions.map((s) => ({
      assignment: s.assignment?.title,
      status: s.status,
      grade: s.grade,
      submittedAt: s.submittedAt,
    })),
    attendance: attendance.map((a) => ({
      date: a.date,
      status: a.status,
    })),
  };

  const prompt = `You are a helpful assistant. Answer the student's question using ONLY the data provided below. Do not answer about other students or reveal data outside what is provided.\n\nStudent data:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question.trim()}`;

  const reply = await askAI({
    system: "You are a helpful assistant. Reply concisely. Never reveal other students' data.",
    prompt,
  });

  return { answer: reply };
}

module.exports = { askAssistant };
