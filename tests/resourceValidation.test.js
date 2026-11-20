// Integration tests for assignment resource access and uploads.
// Fixtures use real multipart requests and an isolated in-memory database.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureResourceTests } = require("./helpers/resourceAttachmentTestHelpers");
const { createWorld, loginAs, pdfForm, PDF_BYTES } = configureResourceTests();
const fs = require("node:fs");
const path = require("node:path");
const Assignment = require("../models/Assignment");
test("disallowed file type is rejected and leaves no resource", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");
  const form = new FormData();
  form.append(
    "resource",
    new Blob([Buffer.from("MZ")], { type: "application/octet-stream" }),
    "malware.exe",
  );

  const response = await client.upload(`/api/assignments/${assignment._id}/resources`, form);

  assert.equal(response.status, 400);
  const stored = await Assignment.findById(assignment._id).lean();
  assert.equal(stored.resources.length, 0);
});

test("oversized file is rejected", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");
  const oversized = Buffer.alloc(1024 * 1024 + 1, 1);

  const response = await client.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(oversized, "too-large.pdf"),
  );

  assert.equal(response.status, 400);
});

test("more than one file in a request is rejected", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");
  const form = new FormData();
  form.append("resource", new Blob([PDF_BYTES], { type: "application/pdf" }), "one.pdf");
  form.append("resource", new Blob([PDF_BYTES], { type: "application/pdf" }), "two.pdf");

  const response = await client.upload(`/api/assignments/${assignment._id}/resources`, form);

  assert.equal(response.status, 400);
});

test("path traversal in the original filename is neutralized", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");

  const uploadResp = await client.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(PDF_BYTES, "../../evil.pdf"),
  );

  assert.equal(uploadResp.status, 201);
  assert.equal(uploadResp.data.fileName, "evil.pdf");

  const stored = await Assignment.findById(assignment._id).lean();
  const storedName = stored.resources[0].filePath;
  assert.ok(!storedName.includes(".."));
  assert.ok(fs.existsSync(path.join(process.env.ASSIGNMENT_RESOURCE_DIR, storedName)));
});

test("resources in an assignment PATCH body are ignored", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");
  const uploadResp = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());
  assert.equal(uploadResp.status, 201);

  const response = await client.patch(`/api/assignments/${assignment._id}`, {
    title: "Renamed assignment",
    resources: [],
  });

  assert.equal(response.status, 200);
  const stored = await Assignment.findById(assignment._id).lean();
  assert.equal(stored.title, "Renamed assignment");
  assert.equal(stored.resources.length, 1);
});
