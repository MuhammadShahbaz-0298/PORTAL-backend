const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { AppError } = require("../utils/errors");
const { normalizeError } = require("../utils/http");
const { isZipFile, removeFile } = require("../utils/files");
const {
  assertEmail,
  assertObjectId,
  assertPassword,
  requireFields,
} = require("../utils/validation");

test("validation helpers accept valid values and reject invalid values", async () => {
  assert.equal(assertEmail(" Student@Example.com "), "student@example.com");
  assert.doesNotThrow(() => assertPassword("password123"));
  assert.throws(() => assertPassword("short"), AppError);
  assert.doesNotThrow(() => assertObjectId("507f1f77bcf86cd799439011"));
  assert.throws(() => assertObjectId("invalid"), AppError);
  assert.doesNotThrow(() => requireFields({ name: "Ayesha" }, ["name"]));
  assert.throws(() => requireFields({}, ["name"]), AppError);
});

test("error normalization maps common persistence failures", () => {
  const duplicate = normalizeError({ code: 11000 });
  assert.equal(duplicate.statusCode, 409);
  const cast = normalizeError({ name: "CastError" });
  assert.equal(cast.statusCode, 400);
});

test("ZIP validation checks file signatures and cleanup is safe", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "portal-test-"));
  const zipPath = path.join(directory, "valid.zip");
  const textPath = path.join(directory, "invalid.zip");
  await fs.writeFile(zipPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
  await fs.writeFile(textPath, "not a zip");
  assert.equal(await isZipFile(zipPath), true);
  assert.equal(await isZipFile(textPath), false);
  await removeFile(zipPath);
  await removeFile(textPath);
  await fs.rm(directory, { recursive: true, force: true });
});
