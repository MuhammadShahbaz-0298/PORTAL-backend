// Smoke-test screens available to core roles.
// Students must still receive 403 responses from admin-only routes.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureRoleSmokeTests } = require("./helpers/roleSmokeTestHelpers");
const { createWorld } = configureRoleSmokeTests();

test("all three core roles can read their normal screens", async () => {
  const world = await createWorld();
  const paths = [
    "/api/announcements",
    "/api/timetable",
    "/api/quizzes",
    "/api/assignments",
    "/api/submissions",
    "/api/attendance",
    "/api/notifications",
    "/api/search?q=Week",
    "/api/events",
    "/api/calendar.ics",
    `/api/weighted-grades/${world.student._id}?batchId=${world.batch._id}`,
    `/api/assignments/${world.assignment._id}/resources`,
    `/api/assignments/${world.assignment._id}/resources/${world.resourceId}/download`,
  ];

  for (const [role, client] of Object.entries(world.clients)) {
    for (const path of paths) {
      const response = await client.get(path);
      assert.equal(response.status, 200, `${role} GET ${path} returned ${response.status}`);
    }
  }

  const rolesResponse = await world.clients.admin.get("/api/roles");
  assert.equal(rolesResponse.status, 200);
  assert.ok(rolesResponse.data.permissionMeta["timetable.view"]);
});

test("a student gets 403 on admin-only routes and exports", async () => {
  const world = await createWorld();
  const client = world.clients.student;
  const paths = [
    "/api/users",
    "/api/audit-log",
    "/api/roles",
    "/api/analytics/overview",
    "/api/users/export",
    "/api/attendance/export",
    "/api/submissions/export",
  ];

  for (const path of paths) {
    const response = await client.get(path);
    assert.equal(response.status, 403, `student GET ${path} returned ${response.status}`);
  }

  const createAnnouncement = await client.post("/api/announcements", {
    title: "Not allowed",
    body: "Students cannot create announcements.",
    scope: "school",
  });
  assert.equal(createAnnouncement.status, 403);

  const createEvent = await client.post("/api/events", {
    title: "Not allowed",
    date: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(createEvent.status, 403);
});
