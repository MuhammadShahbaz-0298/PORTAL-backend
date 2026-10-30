# Coding rules

These rules exist so a new developer can open any file and know what it does
without reading the rest of the project.

## Files and layers

- One feature, one route file: `routes/<feature>.js`.
- One controller per feature: `controllers/<feature>Controller.js`.
- One service per feature: `services/<feature>Service.js`.
- One model per collection: `models/<Feature>.js`.
- Shared code goes in `utils/` or `constants/`, never copy-pasted between
  features.
- Keep files under about 150 lines. Split by responsibility when a file grows.

Request flow is always:

```
route -> controller -> service -> model
```

Controllers do not query the database (except trivial reads that are already
documented). Services do not touch `req` or `res`.

## Naming

- Files: `camelCase.js`, models `PascalCase.js`.
- Variables and functions: full words, `camelCase`. Prefer `studentId` over
  `sid`, `archivedAt` over `del`.
- Booleans read as questions: `isActive`, `hasBackup`, `canManageBatch`.
- Constants: `UPPER_SNAKE_CASE`.
- Collections and routes: plural (`/api/batches`, `submissions`).

## Comments

Every file starts with a two-line comment saying what the file does:

```js
// Database work for attendance.
// Teachers can only read or write attendance for batches they own.
```

Add a `WHY` comment for anything non-obvious:

```js
// A dummy hash makes "unknown email" take as long as "wrong password".
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 10);
```

Do not comment what the code already says. Do comment security decisions,
workarounds and invariants.

## Constants, not magic values

Roles, permissions, statuses, limits, token lifetimes, file sizes, page sizes
and header names live in `constants/` or `config/permissions.js`.

```js
// Good
if (limit > MAX_PAGE_SIZE) { ... }

// Bad
if (limit > 100) { ... }
```

## Validation

- Validate at the boundary with `utils/validation.js`.
- Every write uses `pickFields(payload, allowedFields)` to stop mass assignment.
- Booleans must be real booleans (`assertBoolean`), never `Boolean(value)`.
- IDs go through `assertObjectId`.
- Search text goes through `buildSearchFilter`, which escapes regex characters.
- Never pass `req.body`, `req.query` or `req.params` directly into a query.
- New string fields get a max length.

## Authorization

- Routes use `auth` plus `requirePermission("...")`.
- Ownership is checked in the service with `batchAccessService` or an explicit
  query that includes the owner id.
- Never trust a role, user id or permission from the request body or token.
- Soft-deleted users (`active=false`) must be rejected.
- New permissions must be added to `config/permissions.js` and, if production
  roles need them, to a migration script.

## Errors and responses

- Throw `AppError(message, statusCode)` for expected failures.
- Wrap async handlers in `asyncHandler`; do not add `try/catch` for control flow.
- Controllers return the resource directly; lists use `sendPaginatedList`.
- Error text is short and does not reveal internals.
- `5xx` details stay in server logs, never in the response.

## Async and database

- Use `async`/`await`, not callbacks or `.then()` chains.
- `await` every database call; a floating promise is a bug.
- Use `lean()` for read-only lists.
- Select only the fields you need; `password` is `select: false`, so adding
  `+password` must be deliberate.
- Add an index for every field used in a list filter or sort.
- Never delete history; archive with `active`/`archivedAt`.

## Security

- Never log or return passwords, tokens, cookies, hashes or full request bodies.
- Never commit `.env` or a real secret. Use `.env.example` with placeholders.
- Never read a password from `process.argv`.
- Uploaded files: random stored name, outside public folders, authorized download.
- Do not weaken CORS, CSRF, cookie flags or rate limits to fix a client bug.
- Any contract change must be written in `docs/API_CHANGES.md`.

## Formatting

Prettier and ESLint decide the style:

- 2 spaces, no tabs.
- Double quotes, semicolons, trailing commas.
- 100-character print width.
- `const`/`let` only; `===` only; no unused variables.

Run before committing:

```bash
npm run format
npm run lint
npm test
```

## Tests

- Every security control and every ownership rule needs a test.
- Add a negative test (wrong role, wrong owner, invalid input), not only a happy
  path.
- HTTP tests use `tests/helpers/integration.js`, which starts an in-memory
  MongoDB. Never point tests at a real database.
- Test names describe the behavior, for example "teacher B cannot grade another
  teacher's submission".
- Tests must not depend on execution order.

## Scripts that write data

- Default to dry run.
- Require `--apply` **and** `--i-have-a-backup` before writing.
- Print exactly what would change and a summary.
- Never delete rows in a cleanup script; report and let a human decide.
- Refuse dangerous defaults in production.

## Git

- One logical change per commit.
- Never commit `node_modules/`, `uploads/`, `.env` or backups.
- Before committing: `npm run lint`, `npm test`, `npm audit`.
- Do not rewrite or delete someone else's work without checking with them first.
