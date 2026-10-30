# API reference

Base URL in production: `https://<your-api>.up.railway.app`

All JSON endpoints expect and return `Content-Type: application/json` unless
noted. Uploads are `multipart/form-data`.

## Conventions

### Authentication

Send the cookies set by `POST /api/auth/login`. Tokens are **never** returned in
the JSON body.

```
Cookie: portal_access=<jwt>; portal_refresh=<random>
```

`portal_access` is valid for `ACCESS_TOKEN_MINUTES` (default 10). When it
expires, call `POST /api/auth/refresh`; the browser sends `portal_refresh`
automatically because its path is `/api/auth`.

A `Bearer <token>` header is also accepted for the access token, which is useful
for scripts. Browsers should use cookies.

### CSRF header

Every `POST`, `PUT`, `PATCH` and `DELETE` must include:

```
x-csrf-protection: 1
```

Without it the API returns `403` before touching the route.

### Cookies (production)

```
Set-Cookie: portal_access=...; HttpOnly; Secure; SameSite=None; Path=/
Set-Cookie: portal_refresh=...; HttpOnly; Secure; SameSite=None; Path=/api/auth
```

In development (`NODE_ENV` not `production`) the flags are `SameSite=Lax` and
no `Secure`, so plain `http://localhost` works.

### Success responses

Only `/health` uses the envelope:

```json
{ "success": true, "data": { "status": "ok" } }
```

All feature endpoints return the resource or the array directly, preserving the
existing frontend contract.

### List responses

Lists return a JSON array and expose paging metadata in headers:

```
X-Page: 1
X-Page-Limit: 50
X-Total-Count: 137
```

Query parameters:

| Parameter | Default | Max       | Notes                              |
| --------- | ------- | --------- | ---------------------------------- |
| `page`    | `1`     | —         | Whole number ≥ 1.                  |
| `limit`   | `50`    | `100`     | Whole number ≥ 1.                  |
| `search`  | —       | 100 chars | Escaped before it becomes a regex. |

### Error responses

```json
{ "success": false, "error": "Human readable message." }
```

Validation errors may add `details`:

```json
{ "success": false, "error": "Validation failed.", "details": ["name is required."] }
```

Common codes:

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `400`  | Invalid input, invalid id, malformed archive.              |
| `401`  | Missing/expired session, wrong password, disabled account. |
| `403`  | Missing permission, wrong owner, missing CSRF header.      |
| `404`  | Record or route not found.                                 |
| `409`  | Duplicate email, duplicate submission, duplicate role.     |
| `410`  | Assignment closed or expired.                              |
| `429`  | Too many login attempts.                                   |
| `500`  | Unexpected server error (details are only in server logs). |

### Limits

- JSON body: 1 MB.
- Upload: `.zip` only, hard cap 50 MB, per-assignment `maxFileSizeMb` up to 250.
- One submission per student per assignment. Re-upload replaces the existing one.

---

## Health

### `GET /health`

Public. No CSRF header needed. Useful for Railway health checks.

```json
{ "success": true, "data": { "status": "ok" } }
```

---

## Auth

### `POST /api/auth/login`

Public.

```json
{ "email": "admin@example.com", "password": "Password123!" }
```

`200`

```json
{
  "user": {
    "id": "665f...",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin",
    "active": true,
    "permissions": ["dashboard.view", "students.view", "..."]
  }
}
```

Also sets both cookies. `401` for a wrong email/password or disabled account.
`429` after 10 failures in 15 minutes for the same IP or email.

### `POST /api/auth/refresh`

Public, but requires the `portal_refresh` cookie. No body.

`200` returns `{ "user": ... }` and rotates both cookies. `401` when the token
is missing, expired, revoked or replayed. Replay revokes the entire session
family.

### `POST /api/auth/logout`

Requires the `portal_refresh` cookie; does **not** require a valid access token,
so an expired session can still log out cleanly.

`200`

```json
{ "message": "Logged out." }
```

Revokes the current session and clears both cookies.

### `POST /api/auth/logout-all`

Requires authentication. Revokes every session of the user.

`200`

```json
{ "message": "Logged out from all devices." }
```

### `GET /api/auth/me`

Requires authentication. Returns the current user including **fresh**
permissions computed from the database.

### `POST /api/auth/change-password`

Requires authentication.

```json
{ "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }
```

`200`

```json
{ "message": "Password updated." }
```

All other sessions are revoked. The current session stays valid.

### `POST /api/auth/register`

Requires authentication and `students.create`.

| Field         | Type     | Required | Notes                                 |
| ------------- | -------- | -------- | ------------------------------------- |
| `name`        | string   | yes      | ≤ 100 chars.                          |
| `email`       | string   | yes      | Normalized to lowercase.              |
| `password`    | string   | yes      | 8–128 chars.                          |
| `role`        | string   | yes      | Must exist in `roles`.                |
| `permissions` | string[] | no       | Admin only; unknown values dropped.   |
| `active`      | boolean  | no       | Admin only; must be a real boolean.   |
| `batchId`     | string   | no       | Enroll the new student in this batch. |

`201`

```json
{
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "student",
    "active": true,
    "permissions": []
  }
}
```

Rules:

- Admin may create any role.
- Teacher may create **students only**, and only enroll them in a batch the
  teacher owns.
- `409` if the email already exists.
- No cookies are set; log in afterwards.

---

## Users

### `GET /api/users`

Permission: `students.view`.

Query: `page`, `limit`, `search` (name/email), `role`.

Returns an array of user documents without `password`.

Scope:

- Admin sees everyone.
- Teacher sees only active students enrolled in the teacher's batches.

### `PATCH /api/users/:id`

Permission: `users.manage`.

Accepts any subset of: `name`, `email`, `password`, `role`, `active`,
`permissions`.

Behavior:

- Changing `role`, `password` or `active` revokes that user's sessions.
- A user cannot change their own role, disable themselves, or delete themselves.
- Setting `active: false` sets `archivedAt`.

Returns the updated user document.

### `PATCH /api/users/:id/reset-password`

Permission: `users.manage`. Body: none.

Generates a random 12-character temporary password, stores only its bcrypt hash,
sets `mustChangePassword: true`, and revokes every active session for that user.

`200`

```json
{ "temporaryPassword": "Abc1!xyz9Qr2" }
```

- The plain password is returned **once**; it is never stored or logged.
- A security event is logged with the target `userId` and the admin who
  triggered it. The password itself is not logged.
- `404` if the user does not exist.
- `400` if the admin tries to reset their own password this way.
- `403` without `users.manage`.

Until the user changes this password, every authenticated route except
`POST /api/auth/change-password` returns `403` with
`"You must change your password before continuing."`.

### `DELETE /api/users/:id`

Permission: `users.manage`.

Soft delete only:

- sets `active=false` and `archivedAt=now`,
- revokes all sessions.

`200`

```json
{ "message": "User archived successfully." }
```

The document is **not** removed. Attendance, submissions and history stay valid.

---

## Batches

### `GET /api/batches`

Permission: `batches.view`.

Query: `page`, `limit`, `search`.

Scope:

- Admin: all active batches.
- Teacher: active batches they own.
- Student: active batches they are enrolled in.

Each item includes `studentCount`.

### `POST /api/batches`

Permission: `batches.create` (admin only by default).

```json
{ "name": "Batch A", "teacherId": "665f..." }
```

- Admin must send `teacherId` of an active teacher.
- A teacher calling this route is assigned to themselves; `teacherId` is ignored.

`201` returns the batch with `teacher` populated (`name`, `email`).

### `PATCH /api/batches/:id`

Permission: `batches.update`. Admin, or the teacher who owns the batch.

Accepts `name` and/or `teacherId`. Returns the updated batch with `teacher`
populated.

### `DELETE /api/batches/:id`

Permission: `batches.delete`. Admin, or the owning teacher.

Soft delete:

- sets `active=false` and `archivedAt=now`,
- keeps enrollments, attendance, assignments and submissions.

`200`

```json
{ "message": "Batch archived successfully." }
```

### `POST /api/batches/:id/enroll`

Permission: `batches.enroll`. Admin, or the owning teacher.

```json
{ "studentId": "665f..." }
```

`201` returns the enrollment. Calling it twice is idempotent.

A student may be enrolled in **multiple batches**. Other enrollments are never
removed.

### `GET /api/batches/:id/students`

Permission: `batches.view` plus ownership (admin or owning teacher).

Returns an array of student documents with `page`/`limit` and the paging headers.

---

## Assignments

### `GET /api/assignments`

Permission: `assignments.view`.

Query: `page`, `limit`, `search` (title), `batchId`.

Scope:

- Admin: all assignments.
- Teacher: assignments in owned batches (including archived ones, for history).
- Student: active, not-yet-due assignments in enrolled batches.

### `GET /api/assignments/:id`

Permission: `assignments.view`.

Admins and the owning teacher may read any assignment in scope. A student must
be enrolled in the batch, and the assignment must be active. `410` when closed.

### `POST /api/assignments`

Permission: `assignments.create`. Admin, or the owning teacher.

```json
{
  "batch": "665f...",
  "title": "Week 1 homework",
  "description": "Upload a ZIP with your source files.",
  "dueDate": "2026-11-15T23:59:00.000Z",
  "allowedFileTypes": ["zip"],
  "maxFileSizeMb": 25,
  "resubmissionPolicy": "allowed"
}
```

| Field                | Notes                                   |
| -------------------- | --------------------------------------- |
| `batch`              | Required; must be owned by the teacher. |
| `title`              | Required, ≤ 160 chars.                  |
| `description`        | Optional, ≤ 5000 chars.                 |
| `dueDate`            | Required ISO date.                      |
| `allowedFileTypes`   | Only `"zip"` is accepted today.         |
| `maxFileSizeMb`      | 1–250, default 25.                      |
| `resubmissionPolicy` | `allowed` (default) or `disabled`.      |

`201` returns the assignment with `batch` populated.

### `PATCH /api/assignments/:id`

Permission: `assignments.update`. Admin, or the owning teacher.

Accepts `title`, `description`, `dueDate`, `allowedFileTypes`,
`maxFileSizeMb`, `resubmissionPolicy`, `active`.

Setting `active: false` sets `closedAt`.

### `DELETE /api/assignments/:id`

Permission: `assignments.delete`. Admin, or the owning teacher.

Soft delete (`active=false`, `closedAt=now`). Existing submissions are kept.

`200`

```json
{ "message": "Assignment archived." }
```

---

## Attendance

### `GET /api/attendance`

Permission: `attendance.view`.

Query: `page`, `limit`, `batchId`, `studentId`, `date` (`YYYY-MM-DD`).

Scope:

- Admin: all.
- Teacher: only attendance for owned batches.
- Student: only their own records.

### `GET /api/attendance/:studentId`

Permission: `attendance.view`.

Returns a summary:

```json
{
  "studentId": "665f...",
  "present": 8,
  "total": 10,
  "percentage": 80,
  "records": ["...attendance documents..."]
}
```

A student may only request their own id.

### `POST /api/attendance`

Permission: `attendance.manage`. Admin, or the owning teacher.

```json
{
  "studentId": "665f...",
  "batchId": "665f...",
  "date": "2026-10-30",
  "status": "present"
}
```

`status` is one of `present`, `absent`, `leave`. The student must be enrolled in
the batch. The date is normalized to UTC midnight.

Upsert semantics: posting the same student + batch + day updates the existing
record. Returns `200` with the attendance document (not `201`).

### `PATCH /api/attendance/:id`

Permission: `attendance.manage`. Admin, or the owning teacher.

Accepts `date` and/or `status`.

---

## Submissions

### `GET /api/submissions`

Permission: `submissions.view`.

Query: `page`, `limit`, `assignmentId`.

Scope:

- Admin: all.
- Teacher: submissions in owned batches.
- Student: their own only.

### `POST /api/submissions`

Permission: `submissions.view` **and** role `student`.

`multipart/form-data`:

| Field          | Type   | Notes                                 |
| -------------- | ------ | ------------------------------------- |
| `file`         | file   | Required `.zip`, magic bytes checked. |
| `assignmentId` | string | Required, sent as a form field.       |

Rules:

- The student must be enrolled in the assignment's batch.
- The assignment must be active and not past `dueDate`, else `410`.
- The file must be ≤ the assignment's `maxFileSizeMb` and a valid ZIP.
- Only **one** submission per student+assignment. A second POST returns `409`.

`201` returns the submission with `assignment`, `batch` and `student` populated.

### `PATCH /api/submissions/:id/file`

Permission: `submissions.view` **and** role `student`.

`multipart/form-data` with `file`. The student must own the submission, the
assignment must allow resubmissions, and it must not be expired.

Replaces the stored file, resets grade/feedback/status and deletes the previous
file from disk. Returns `200`.

### `GET /api/submissions/:id/download`

Permission: `submissions.view`. Ownership is enforced in the service.

Allowed for: admin, the student who owns it, or the teacher who owns the batch.

Returns the ZIP as an attachment (`Content-Disposition: attachment`). The
response is not JSON. `404` if the file no longer exists on disk.

### `PATCH /api/submissions/:id/grade`

Permission: `submissions.grade`. Admin, or the owning teacher.

```json
{ "grade": "A", "feedback": "Good structure.", "status": "graded" }
```

- `grade` is required. Numeric grades must be between 0 and 100. Letter grades
  are allowed. Stored as text.
- `feedback` optional, ≤ 2000 chars.
- `status` optional: `graded` (default) or `rejected`.

Returns the updated submission.

---

## Permissions (admin)

All routes require `roles.manage` (admin by default).

### `GET /api/permissions`

Returns the catalog and the defaults:

```json
{
  "permissions": ["dashboard.view", "..."],
  "roleDefaults": { "admin": ["..."], "teacher": ["..."], "student": ["..."] }
}
```

### `PATCH /api/permissions/users/:id`

```json
{ "permissions": ["dashboard.view", "students.view"] }
```

Replaces the user's **extra** permissions. Unknown values are rejected with
`400`. Effective permissions are the union of the role's permissions and these.

---

## Roles (admin)

All routes require `roles.manage`.

### `GET /api/roles`

Creates the three core roles if missing, then returns:

```json
{
  "roles": [{ "name": "admin", "label": "Administrator", "permissions": ["..."] }],
  "permissions": ["..."]
}
```

### `POST /api/roles`

```json
{ "name": "assistant", "label": "Assistant", "permissions": ["students.view"] }
```

`201`. `409` if the name already exists.

### `PATCH /api/roles/:id`

Accepts `label`, `permissions`, `active`. Core roles (`admin`, `teacher`,
`student`) cannot be deactivated.

---

## Permission catalog

| Permission            | What it gates                                           |
| --------------------- | ------------------------------------------------------- |
| `dashboard.view`      | Dashboard data.                                         |
| `students.view`       | `GET /api/users`, batch student lists, teacher scoping. |
| `students.create`     | `POST /api/auth/register`.                              |
| `students.update`     | Student edits.                                          |
| `students.attendance` | Legacy attendance permission kept for compatibility.    |
| `batches.view`        | Batch lists and batch student lists.                    |
| `batches.create`      | Create a batch.                                         |
| `batches.update`      | Update an owned batch.                                  |
| `batches.delete`      | Archive an owned batch.                                 |
| `batches.enroll`      | Enroll a student into an owned batch.                   |
| `assignments.view`    | List/read assignments.                                  |
| `assignments.create`  | Create an assignment.                                   |
| `assignments.update`  | Update an owned assignment.                             |
| `assignments.delete`  | Archive an owned assignment.                            |
| `submissions.view`    | List/upload/download submissions.                       |
| `submissions.grade`   | Grade submissions.                                      |
| `attendance.view`     | Read attendance.                                        |
| `attendance.manage`   | Create/update attendance.                               |
| `users.manage`        | Update/archive any user.                                |
| `roles.manage`        | Roles and per-user permissions.                         |
| `profile.view`        | Profile screens.                                        |
