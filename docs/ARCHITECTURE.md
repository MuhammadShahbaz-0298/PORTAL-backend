# Architecture

## Big picture

```
Browser (different origin)
   |  HTTPS, cookies + x-csrf-protection
   v
Express app (app.js)
   |-- helmet, CORS, JSON limit, body shape check, CSRF
   |-- routes/<feature>.js
   |-- controllers/<feature>Controller.js
   |-- services/<feature>Service.js
   |-- models/<Feature>.js
   v
MongoDB  +  UPLOAD_DIR (ZIP files)
```

There is no frontend build inside this repository. The frontend is a separate
service on a different address; see `README.md` for the cookie requirements.

## Why the layers exist

| Layer         | Responsibility                                          | Must not                                                          |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `routes`      | URL, HTTP method, middleware, permission name           | Contain business logic                                            |
| `controllers` | Read request, call one service, send response           | Query MongoDB directly (except simple lookups already documented) |
| `services`    | Rules, ownership checks, database queries, transactions | Know about `req`/`res`                                            |
| `models`      | Schema, validation, indexes, defaults                   | Contain HTTP or permission logic                                  |

The layer rule keeps authorization decisions in one place: services always
receive `requester` (the fresh user from the auth middleware) and check
ownership from the database.

## Request lifecycle

1. `server.js` reads the environment with `config/env.js`. If a value is
   missing or unsafe, the process exits before listening.
2. `server.js` connects to MongoDB, then requires `app.js`.
3. Per request, `app.js` runs:
   - `helmet()` — security headers.
   - `cors()` — only `FRONTEND_URL`, with `credentials: true`.
   - `express.json({ limit: "1mb" })`.
   - `validateBodyShape` — rejects non-object bodies and any `$` key on writes.
   - `csrfProtection` — requires `x-csrf-protection: 1` on unsafe methods.
4. Route-level `auth` middleware:
   - reads the access token from the `portal_access` cookie (or a Bearer header),
   - verifies the JWT,
   - loads the **session row** and rejects revoked / replaced / expired / idle sessions,
   - loads the **current user** and rejects disabled users,
   - refreshes `lastActiveAt` at most once per minute,
   - attaches `request.user` (role + effective permissions) and `request.session`.
5. `requirePermission(...)` checks the permissions loaded in step 4. Permissions
   are never read from the token, so a demotion applies on the next request.
6. The controller calls the service; the service enforces ownership.
7. Errors are normalized in `utils/http.js` and rendered as
   `{ success: false, error, details? }`. Server errors never leak stack traces.

## Authentication design

- **Access token**: JWT, 10 minutes, `httpOnly` cookie `portal_access`, path `/`.
  It contains `userId`, `sessionId`, issuer `portal-backend`. It is never the
  source of truth for permissions or active status.
- **Refresh token**: 64 random bytes (128 hex chars), `httpOnly` cookie
  `portal_refresh`, path `/api/auth`. Only its SHA-256 hash is stored.
- **Session family**: every login creates a `familyId`. Refreshing rotates the
  token inside the same family. Replaying an old token revokes the whole family.
- **Timeouts**: idle timeout (default 10 min) and absolute family cap
  (default 24 h) are enforced server-side.
- **Logout**: revokes the current session. `logout-all` revokes every session
  of the user. Changing a password revokes all other sessions.
- **CSRF**: because cookies are sent automatically, every unsafe request needs
  a custom header that a cross-site HTML form cannot set.
- **Rate limit**: 10 failed logins per 15 minutes per IP and per email,
  in memory. See `docs/SECURITY.md` for the scaling limit.

## Authorization design

Roles: `admin`, `teacher`, `student`. A role has a permission list in the
`roles` collection; a user may have extra permissions.

Rules enforced in services:

| Area              | Rule                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Batches           | Admin: all. Teacher: only `batch.teacher === user`.                                                                                                          |
| Batch delete      | Soft delete (`active=false`, `archivedAt`).                                                                                                                  |
| Enrollment        | Student may be in many batches; duplicates are idempotent.                                                                                                   |
| Users list        | Admin: all. Teacher: only students enrolled in the teacher's batches.                                                                                        |
| Registration      | Admin: any role. Teacher: students only, and only into owned batches.                                                                                        |
| Assignments       | Teacher may manage only assignments in owned batches. Student sees active, unexpired assignments of enrolled batches.                                        |
| Attendance        | Teacher may read/write only owned batches; students read only their own.                                                                                     |
| Submissions       | Student uploads only for enrolled batches and reads only their own. Teacher reads/grades only submissions in owned batches. Download enforces the same rule. |
| Roles/permissions | Requires `roles.manage` (admin by default).                                                                                                                  |

## Soft delete model

| Entity                | Field                        | Effect                                                                 |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| User                  | `active=false`, `archivedAt` | Cannot log in; existing sessions revoked; excluded from teacher lists. |
| Batch                 | `active=false`, `archivedAt` | Hidden from lists; enrollments, attendance and submissions remain.     |
| Assignment            | `active=false`, `closedAt`   | Hidden from student lists; submissions remain readable to staff.       |
| Attendance/Submission | none                         | Never deleted by API or scripts.                                       |

## Uploads

1. `multer` writes to `UPLOAD_DIR` with a random UUID file name and a `.zip`
   extension. The original name is never used as a filesystem path.
2. The file filter checks extension and declared MIME type.
3. The service checks the ZIP magic bytes (`PK\x03\x04`, `PK\x05\x06`,
   `PK\x07\x08`).
4. `utils/zip.js` reads the central directory and rejects:
   - more than 1000 entries,
   - more than 500 MB declared uncompressed size,
   - a compression ratio above 100:1,
   - ZIP64,
   - absolute paths, drive letters or `../` entries.
5. Download goes through `res.download` after an ownership check and a
   path-traversal-safe path resolution.

## Failure behavior

- Missing/invalid environment: process exits with a readable list of problems.
- Database unreachable: process exits instead of serving broken requests.
- `SIGTERM` / `SIGINT`: stop accepting requests, disconnect, exit; force-exit
  after 10 seconds.
- Unknown route: `404` with the standard error shape.
- Unexpected error: logged in full on the server, generic message to the client.

## Deliberate non-goals

- No email verification, password reset email, or 2FA.
- No background job runner. Session cleanup uses a MongoDB TTL index.
- No Redis. Login lockout is in process memory, which fits one Railway replica.
- No refresh-token rotation grace window: replay is treated as compromise.
