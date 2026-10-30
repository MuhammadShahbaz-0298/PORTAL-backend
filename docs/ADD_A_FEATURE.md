# Adding a feature

This walkthrough adds a small "notes" feature using the project's layer rule:

```
routes/notes.js -> controllers/noteController.js -> services/noteService.js -> models/Note.js
```

Keep every file under about 150 lines. If a file grows past that, split it by
responsibility, not by line count.

## 1. Put fixed values in constants

If the feature has statuses, limits or sizes used in more than one file, add
them to `constants/index.js` (or a new file in `constants/`). Do not hard-code
magic strings in controllers or services.

```js
const NOTE_STATUSES = Object.freeze(["open", "closed"]);
const NOTE_TITLE_MAX_LENGTH = 160;
```

## 2. Create the model

```js
// models/Note.js
// One note belongs to one batch and is written by one user.
// Notes are never hard-deleted; they are archived.

const mongoose = require("mongoose");
const { NOTE_STATUSES, NOTE_TITLE_MAX_LENGTH } = require("../constants");

const noteSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: NOTE_TITLE_MAX_LENGTH },
    status: { type: String, enum: NOTE_STATUSES, default: "open" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

noteSchema.index({ batch: 1, active: 1 });

module.exports = mongoose.model("Note", noteSchema);
```

Rules:

- `strict: true` and `timestamps: true`.
- Add an index for every field a list query filters on.
- Prefer `active`/`archivedAt` over deleting rows.
- Never store a password or token without hashing it.

## 3. Add permissions to the catalog

Add new permission names to `config/permissions.js` in `PERMISSIONS` first.
Then decide which default roles get them in `ROLE_DEFAULTS`.

```js
const PERMISSIONS = [
  // ...
  "notes.view",
  "notes.manage",
];
```

If an existing role in a live database needs a new permission, add it to a
migration list (see `TEACHER_MIGRATION_PERMISSIONS` and
`scripts/migrateTeacherPermissions.js`) so production data is updated
deliberately, with a dry run first.

## 4. Write the service

Services receive a plain `requester` object (`userId`, `role`, `permissions`)
and validated input. They throw `AppError` for expected failures.

```js
// services/noteService.js
// Database work for notes. Teachers may only touch notes in batches they own.

const Note = require("../models/Note");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const { assertObjectId, assertOptionalString, assertString } = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

async function listNotes({ requester, query }) {
  const pagination = getPagination(query);
  const search = buildSearchFilter(query.search, ["title"]);
  const batchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
  const filter = { $and: [search, { batch: { $in: batchIds } }, { active: true }] };
  const total = await Note.countDocuments(filter);
  const items = await Note.find(filter)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

async function createNote({ requester, payload }) {
  const batchId = assertObjectId(payload.batchId, "batchId");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const title = assertString(payload.title, "title", { maxLength: 160 });

  return Note.create({ batch: batchId, title, createdBy: getUserId(requester) });
}

module.exports = { listNotes, createNote };
```

Rules:

- Validate in the service with helpers from `utils/validation.js`; do not trust
  the controller or the route.
- Use `pickFields` when accepting a payload, so unknown fields cannot be written.
- Use `getPagination` and `buildSearchFilter` instead of ad-hoc parsing.
- Check ownership with `batchAccessService`, never with a role check alone.

## 5. Write the controller

Controllers are thin: read input, call one service, send a response.

```js
// controllers/noteController.js
// HTTP layer for notes.

const noteService = require("../services/noteService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listNotes = asyncHandler(async (request, response) => {
  const result = await noteService.listNotes({ requester: request.user, query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createNote = asyncHandler(async (request, response) => {
  const note = await noteService.createNote({ requester: request.user, payload: request.body });
  return response.status(201).json(note);
});

module.exports = { listNotes, createNote };
```

Always wrap async handlers in `asyncHandler` so errors reach the central error
handler. Do not write `try/catch` in controllers unless there is a real reason.

## 6. Write the route

```js
// routes/notes.js
// Routes for notes. Ownership is checked inside the service.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listNotes, createNote } = require("../controllers/noteController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("notes.view"), listNotes);
router.post("/", requirePermission("notes.manage"), createNote);

module.exports = router;
```

Then mount it in `app.js`:

```js
const noteRoutes = require("./routes/notes");
app.use("/api/notes", noteRoutes);
```

## 7. Add tests

Every new rule needs a test, especially a negative one. Use
`tests/helpers/integration.js` for HTTP-level tests.

```js
test("teacher B cannot read teacher A's notes", async () => {
  // create two teachers, two batches, one note in batch A
  // log in as teacher B, GET /api/notes, assert the list is empty
});
```

Test categories to cover:

1. Happy path with the correct role.
2. Wrong role gets `403`.
3. Correct role but wrong owner gets `403`.
4. Invalid input gets `400`.
5. Deleted/archived records behave as documented.

Run:

```bash
npm run lint
npm test
```

## 8. Document the API

Add the endpoint, permission, request body and responses to `docs/API.md`.
If the contract differs from the previous behavior, add it to
`docs/API_CHANGES.md` so the frontend team can react.

## Checklist

- [ ] Constants added (no magic values).
- [ ] Model has validation, indexes, timestamps and soft-delete fields.
- [ ] Permission names added to the catalog and role defaults.
- [ ] Service validates input and enforces ownership.
- [ ] Controller is thin and uses `asyncHandler`.
- [ ] Route uses `auth` + `requirePermission`.
- [ ] Route mounted in `app.js`.
- [ ] Positive and negative tests added.
- [ ] API docs updated.
- [ ] `npm run lint` and `npm test` pass.
