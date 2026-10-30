// Tests for the shared input helpers and error mapping.

const assert = require("node:assert/strict");
const test = require("node:test");
const { AppError } = require("../utils/errors");
const { normalizeError } = require("../utils/http");
const {
  assertBoolean,
  assertEmail,
  assertGrade,
  assertNoMongoOperators,
  assertObjectId,
  assertPassword,
  assertString,
  escapeRegex,
  pickFields,
} = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const { PERMISSIONS, normalizePermissions } = require("../config/permissions");

test("validation helpers accept valid values and reject invalid values", () => {
  assert.equal(assertEmail(" Student@Example.com "), "student@example.com");
  assert.doesNotThrow(() => assertPassword("password123"));
  assert.throws(() => assertPassword("short"), AppError);
  assert.doesNotThrow(() => assertObjectId("507f1f77bcf86cd799439011"));
  assert.throws(() => assertObjectId("invalid"), AppError);
  assert.throws(() => assertString({ $gt: "" }, "name"), AppError);
  assert.equal(assertString("  Ayesha  ", "name"), "Ayesha");
});

test("real booleans are required, so Boolean('false') bugs cannot happen", () => {
  assert.equal(assertBoolean(true, "active"), true);
  assert.equal(assertBoolean(false, "active"), false);
  assert.throws(() => assertBoolean("false", "active"), AppError);
});

test("NoSQL operators are rejected anywhere in the body", () => {
  assert.throws(() => assertNoMongoOperators({ email: { $gt: "" } }), AppError);
  assert.throws(() => assertNoMongoOperators({ nested: [{ $ne: null }] }), AppError);
  assert.doesNotThrow(() => assertNoMongoOperators({ email: "a@example.com" }));
});

test("user text is escaped before it becomes a regex", () => {
  assert.equal(escapeRegex("a.*b"), "a\\.\\*b");
});

test("grades allow letters but cap numeric marks at 0-100", () => {
  assert.equal(assertGrade("A"), "A");
  assert.equal(assertGrade("95"), "95");
  assert.throws(() => assertGrade("101"), AppError);
});

test("mass assignment is stopped by picking allowed fields", () => {
  const picked = pickFields({ name: "Ayesha", role: "admin", active: false, password: "x" }, [
    "name",
    "email",
  ]);

  assert.deepEqual(picked, { name: "Ayesha" });
});

test("pagination has safe defaults and a hard maximum", () => {
  assert.deepEqual(getPagination({}), { page: 1, limit: 50, skip: 0 });
  assert.deepEqual(getPagination({ page: "2", limit: "10" }), { page: 2, limit: 10, skip: 10 });
  assert.throws(() => getPagination({ limit: "101" }), AppError);
  assert.throws(() => getPagination({ page: "0" }), AppError);
});

test("error normalization maps common persistence failures", () => {
  assert.equal(normalizeError({ code: 11000 }).statusCode, 409);
  assert.equal(normalizeError({ name: "CastError" }).statusCode, 400);
  assert.equal(normalizeError({ name: "ValidationError" }).statusCode, 400);
});

test("permission normalization keeps valid values and drops stale entries", () => {
  const cleaned = normalizePermissions([
    "dashboard.view",
    "students.view",
    "legacy.permission",
    "students.view",
    " ",
    null,
  ]);

  assert.deepEqual(cleaned, ["dashboard.view", "students.view"]);
  assert.ok(PERMISSIONS.includes("students.view"));
  assert.deepEqual(normalizePermissions(["legacy.permission"]), []);
});
