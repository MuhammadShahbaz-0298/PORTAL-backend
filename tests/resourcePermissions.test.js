// Validation test: every requirePermission("...") string written in routes/
// must exist in the permission catalog. It reads the route files themselves,
// so a typo or a permission that was never added is caught automatically.

const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PERMISSIONS, PERMISSION_META } = require("../config/permissions");

function collectRoutePermissions() {
  const routesDir = path.join(__dirname, "..", "routes");
  const routeFiles = fs.readdirSync(routesDir).filter((file) => file.endsWith(".js"));
  const found = [];

  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(routesDir, file), "utf8");

    for (const call of source.matchAll(/requirePermission\s*\(([\s\S]*?)\)/g)) {
      for (const literal of call[1].matchAll(/["']([^"']+)["']/g)) {
        found.push({ file, permission: literal[1] });
      }
    }
  }

  return found;
}

test("all route permission strings exist in the catalog", () => {
  const used = collectRoutePermissions();
  const catalog = new Set(PERMISSIONS);

  assert.ok(used.length > 0, "No requirePermission calls were found in routes/.");

  const unknown = used.filter(({ permission }) => !catalog.has(permission));

  assert.deepEqual(
    unknown,
    [],
    `Permissions used in routes but missing from config/permissions.js: ${unknown
      .map(({ file, permission }) => `${permission} (${file})`)
      .join(", ")}`,
  );
});

test("every catalog permission has a label and group in PERMISSION_META", () => {
  const missing = PERMISSIONS.filter(
    (permission) => !PERMISSION_META[permission]?.label || !PERMISSION_META[permission]?.group,
  );
  const extra = Object.keys(PERMISSION_META).filter(
    (permission) => !PERMISSIONS.includes(permission),
  );

  assert.deepEqual(missing, [], `Permissions missing metadata: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `Metadata has permissions not in the catalog: ${extra.join(", ")}`);
});
