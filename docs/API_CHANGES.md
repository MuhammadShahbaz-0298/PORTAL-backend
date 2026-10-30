# API changes for the frontend

These are the contract changes introduced by the security hardening. Anything
marked **breaking** needs a frontend change before deploy.

## 1. Tokens are cookies, not JSON — breaking

Before: `POST /api/auth/login` and `POST /api/auth/register` returned a token in
the response body, and the frontend stored it (usually in `localStorage`).

Now:

- `POST /api/auth/login` → `200 { "user": { ... } }`
- `POST /api/auth/register` → `201 { "user": { ... } }`
- No `token`, `accessToken` or `refreshToken` field is returned.
- The tokens are set as `httpOnly` cookies: `portal_access` and `portal_refresh`.

Frontend changes:

```js
// every request
fetch(url, { credentials: "include" });

// login
const response = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
  body: JSON.stringify({ email, password }),
});
const { user } = await response.json();
```

Do not read cookies with JavaScript; they are `httpOnly` on purpose. Read the
current user from `GET /api/auth/me`.

## 2. Every write needs a CSRF header — breaking

`POST`, `PUT`, `PATCH`, `DELETE` without this header return `403`:

```
x-csrf-protection: 1
```

Add it to every non-GET request, including `multipart/form-data` uploads and
`logout`. A single `fetch` wrapper is the cleanest fix.

## 3. CORS is an exact origin with credentials — breaking

The API only accepts the origin in `FRONTEND_URL`, with
`Access-Control-Allow-Credentials: true`. Wildcards no longer work.

If the frontend runs on `https://portal.up.railway.app`, set
`FRONTEND_URL=https://portal.up.railway.app` on the API service (no trailing
slash, no path).

## 4. Cross-site cookies in production — deployment impact

With `NODE_ENV=production`, cookies are `SameSite=None; Secure`. Consequences:

- The API **must** be served over HTTPS.
- If the frontend and API are on unrelated domains, some browsers block
  third-party cookies. Prefer subdomains of one site and set
  `COOKIE_DOMAIN=.example.com`.
- Same-origin `localhost` development still uses `SameSite=Lax`, so no special
  setup is needed locally.

## 5. `POST /api/auth/logout` behavior

- No longer requires a valid access token; it uses the refresh cookie.
- Revokes the server-side session and clears both cookies.
- Returns `200 { "message": "Logged out." }`.

New endpoint: `POST /api/auth/logout-all` (authenticated) revokes every session.

## 6. Register is a protected route — breaking

`POST /api/auth/register` now requires an authenticated admin or teacher with
`students.create`.

- Admin may create any role.
- Teacher may create students only.
- Optional `batchId` enrolls the new student; a teacher may only use an owned
  batch.
- The response is `{ user }`, not a token. Log in separately if needed.

## 7. Enrollment no longer removes other batches — behavior change

Before: enrolling a student in a new batch removed their other enrollments.

Now: a student can belong to multiple batches. Enrollment is idempotent for the
same student+batch pair. The frontend should refresh all enrollment lists after
an enroll call.

## 8. Deletes are archives — behavior change

| Endpoint                      | Effect now                                          |
| ----------------------------- | --------------------------------------------------- |
| `DELETE /api/users/:id`       | `active=false`, `archivedAt` set, sessions revoked. |
| `DELETE /api/batches/:id`     | `active=false`, `archivedAt` set.                   |
| `DELETE /api/assignments/:id` | `active=false`, `closedAt` set.                     |

Records stay in the database. Lists exclude archived batches and archived users
in teacher scope, and students no longer see archived assignments. Admin views
may still include historical records where documented in `docs/API.md`.

Responses stay `200` with a `message`. The record is not returned afterwards.

## 9. List pagination without changing the array shape — additive

Lists still return a JSON **array**, so existing `.map()` code keeps working.
Paging metadata is in response headers:

```
X-Page, X-Page-Limit, X-Total-Count
```

Supported query parameters: `page` (default 1) and `limit` (default 50, max
100). Asking for more than 100 returns `400`.

The frontend should read `X-Total-Count` for page counts instead of inferring it
from array length.

## 10. Error format is consistent — behavior change

All errors use:

```json
{ "success": false, "error": "message", "details": ["optional"] }
```

Clients that parsed a raw `message` only need to read `error`. Server errors
return the generic text `Internal server error.` and never a stack trace.

A new `GET /health` endpoint returns `{ "success": true, "data": { "status": "ok" } }`.

## 11. Idle timeout and session cap — UX change

- No request for 10 minutes → `401` and cookies cleared.
- Absolute session cap: 24 hours.
- Access token life: 10 minutes.

The frontend should:

1. On `401`, call `POST /api/auth/refresh` once.
2. If refresh succeeds, retry the original request.
3. If refresh fails, clear local UI state and show the login screen.
4. Avoid parallel refresh storms: share one refresh promise across requests.

Idle timeout means a user who leaves a tab open but idle will be logged out.
Previously issued tokens are not affected by this doc; new logins are.

## 12. Upload behavior — behavior change

- Only `.zip` is accepted, checked by extension, MIME type and magic bytes.
- Hard cap 50 MB; the assignment's `maxFileSizeMb` may be lower.
- One submission per student per assignment. A second `POST` returns `409`.
- Replacing a file is `PATCH /api/submissions/:id/file` (not another POST).
- Downloads are served from `GET /api/submissions/:id/download` with an
  attachment disposition. Fetch it with `credentials: "include"` and use a blob
  URL if the UI needs to control the file name.
- Archived or expired assignments reject uploads with `410`.
- If `resubmissionPolicy` is `disabled`, replacement returns `403`.

## 13. Submission status and grade

- `status` is one of `submitted`, `graded`, `rejected`.
- `grade` is stored as **text**. Numeric marks must be 0–100; letters are
  allowed.
- Re-upload resets `grade`, `feedback`, `gradedBy` and `gradedAt`.

## 14. Login lockout — UX change

10 failed logins within 15 minutes (per IP or per email) return `429` until the
window ends. Show the server message instead of a generic failure.

## 15. Teacher permissions expanded

Existing teacher roles get these on migration:

`attendance.manage`, `submissions.grade`, `students.view`, `students.create`,
`batches.update`, `batches.delete`, `batches.enroll`.

Run on the production database (dry run first):

```bash
npm run db:migrate-teacher-permissions
npm run db:migrate-teacher-permissions -- --apply --i-have-a-backup
```

Until the migration runs, teachers will get `403` on those actions even though
the code supports them.

## 16. Permissions are recalculated per request

Changing a role or a user's extra permissions takes effect on the next request.
A demoted user does not need to log in again, and the frontend should re-fetch
`GET /api/auth/me` after admin changes.

## Frontend checklist

- [ ] `credentials: "include"` on every API call.
- [ ] `x-csrf-protection: 1` on every POST/PUT/PATCH/DELETE.
- [ ] Remove token storage from `localStorage` / `sessionStorage`.
- [ ] Bootstrap auth with `GET /api/auth/me`.
- [ ] Single-flight refresh on `401`, then retry once.
- [ ] Stop enrolling by "replace all batches"; support multiple batches.
- [ ] Treat delete as archive in the UI.
- [ ] Read `X-Total-Count` for pagination.
- [ ] Update error parsing to `error` / `details`.
- [ ] Confirm the API is HTTPS and `FRONTEND_URL` is exact.
