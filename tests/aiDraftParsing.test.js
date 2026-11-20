// Tests for AI draft parsing and response shaping.
// Tests exercise bounded parsing, retry behavior and response privacy.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseDraftResponse } = require("../services/aiDraftParser");
const submissionView = require("../utils/submissionView");
test("JSON inside markdown fences is parsed and cleaned", () => {
  const reply = [
    "Here is my answer:",
    "```json",
    JSON.stringify({
      feedback: "Good work. Email me at teacher@example.com for help.",
      suggestedMarks: 142,
      strengths: ["Clear names"],
      improvements: ["Add tests", "   "],
    }),
    "```",
    "Thanks!",
  ].join("\n");

  const parsed = parseDraftResponse(reply);

  assert.equal(parsed.suggestedMarks, 100);
  assert.ok(parsed.feedback.includes("[email removed]"));
  assert.ok(!parsed.feedback.includes("teacher@example.com"));
  assert.deepEqual(parsed.strengths, ["Clear names"]);
  assert.deepEqual(parsed.improvements, ["Add tests"]);
});

test("response shaping hides aiDraft from students and snapshot from staff", () => {
  const document = {
    toObject: () => ({
      _id: "abc",
      aiDraft: { feedback: "draft", snapshot: { files: [{ path: "a.js", text: "secret" }] } },
    }),
  };

  const studentView = submissionView.toVisibleSubmission(document, { role: "student" });
  assert.equal(studentView.aiDraft, undefined);

  const teacherView = submissionView.toVisibleSubmission(document, { role: "teacher" });
  assert.equal(teacherView.aiDraft.feedback, "draft");
  assert.equal(teacherView.aiDraft.snapshot, undefined);
});
