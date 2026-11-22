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

If the frontend runs on `https://portal.onrender.com`, set
`FRONTEND_URL=https://portal.onrender.com` on the API service (no trailing
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
- Replacing a `graded` submission returns `409`.
- If `resubmissionPolicy` is `disabled`, replacing a `submitted` submission
  returns `409`. A `rejected` submission may always be replaced.

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

## 17. Admin password reset — additive

New endpoint: `PATCH /api/users/:id/reset-password` (no body). Requires
authentication and `users.manage`.

- An admin may reset **another** user's password; resetting their own returns
  `400`.
- The response is `200 { "temporaryPassword": "..." }`, a random 12-character
  password with uppercase, lowercase, a digit and a special character.
- Only the bcrypt hash is stored. The plain password is returned exactly once
  and is never logged.
- The target user's `mustChangePassword` field is set to `true`, and all of that
  user's sessions are revoked immediately.
- A security event `admin_password_reset` is logged with the target `userId` and
  the admin's id only.

While `mustChangePassword` is `true`, every authenticated route except
`POST /api/auth/change-password` returns:

```json
{
  "success": false,
  "error": "You must change your password before continuing."
}
```

A successful `POST /api/auth/change-password` clears the flag in the same
request, so the user can continue normally. Existing endpoint response shapes are
unchanged; `mustChangePassword` is not added to login or user responses.

Frontend changes:

1. Show the temporary password **once** after a successful reset, with a copy
   button and a clear warning that it will not be shown again. The admin passes
   it to the user manually — there is no email and no link.
2. Catch the new `403` message above on any request, stop retrying, and send the
   user to the change-password screen.
3. After a successful password change, resume normal navigation.

## 18. Mobile clients (additive)

Native apps cannot read the `httpOnly` cookies, so they opt in to the body
token contract with this request header:

```
x-client: mobile
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
x-csrf-protection: 1
x-client: mobile

{ "email": "user@example.test", "password": "..." }
```

`200`

```json
{
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "student",
    "active": true,
    "permissions": []
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

Cookies are still set for compatibility. Without `x-client: mobile`, the
response remains `{ "user": { ... } }` and no tokens are returned.

### Refresh

```http
POST /api/auth/refresh
Content-Type: application/json
x-csrf-protection: 1
x-client: mobile

{ "refreshToken": "..." }
```

`200` returns a rotated `accessToken` and `refreshToken` plus the user. The
cookie is still preferred when both are present.

### Logout

```http
POST /api/auth/logout
Content-Type: application/json
x-csrf-protection: 1
x-client: mobile

{ "refreshToken": "..." }
```

The body token is used only when the `portal_refresh` cookie is missing. The
session is revoked and the mobile app must delete both stored tokens.

### Security rules

- Mobile tokens are returned only to clients that send `x-client: mobile`.
- Never log request bodies or tokens.
- Store tokens with the platform secure store, never AsyncStorage.
- On `401`, refresh once, retry once, then clear tokens and show login.
- On `403` with `"You must change your password before continuing."`, stop and
  show the change-password screen.

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
- [ ] Show a reset temporary password once; never store or log it.
- [ ] Catch the `mustChangePassword` 403 and redirect to change-password.
- [ ] Confirm the API is HTTPS and `FRONTEND_URL` is exact.

## Frontend changes applied

- Added cookie credentials, the CSRF request header, global 401 refresh/retry, and the forced-password redirect in `src/api/client.js`.
- Added `refresh`, `logoutSession`, and `logoutAll` calls in `src/api/auth.js`.
- Reworked login, logout, hydrate, and refresh to use server cookies and removed token/user storage in `src/store/actions/authActions.js`.
- Removed the token and saved user from the initial auth state and reducer in `src/store/index.js`.
- Changed the loading guard and inactivity check to use the Redux user instead of the token in `src/components/layout/AppLayout.jsx`.
- Added the standalone forced password change page and its public `/force-change-password` route in `src/features/auth/ForceChangePasswordPage.jsx` and `src/routes/index.jsx`.
- Added the `resetPassword` API call in `src/api/users.js`.
- Added the admin reset-password action button, confirmation, and one-time credential warning in `src/features/users/UsersPage.jsx`.

## 19. Leave reason validation (additive)

`POST /api/attendance` and `PATCH /api/attendance/:id` now validate `leaveReason`:

- `status` is `leave` → a reason is required when creating the record or explicitly setting its status; empty/whitespace returns `400 { error: "leave reason is required." }`.
- `status` is `present` or `absent` → any non-empty `leaveReason` returns `400 { error: "leave reason is only allowed when status is leave." }`.
- A date-only PATCH to an older reasonless leave record remains allowed.

This is **additive** — existing attendance records without `leaveReason` continue to work. The frontend must send `leaveReason` when marking a student on leave.

Attendance requests may also include `timezoneOffset` (the value from the
client's `Date.getTimezoneOffset()`) so the backend checks "today" in the
client's local timezone. If omitted, UTC is used.

## 20. AI feedback drafts (additive)

Teachers and admins may now receive an `aiDraft` object on submission
responses. It is **optional** and only appears when AI drafts are configured.

```json
{
  "status": "ready",
  "feedback": "A kind, specific suggestion...",
  "suggestedMarks": 82,
  "strengths": ["..."],
  "improvements": ["..."],
  "model": "openai/gpt-oss-120b",
  "attempts": 1,
  "generations": 1,
  "error": "",
  "generatedAt": "...",
  "requestedAt": "..."
}
```

Rules for the frontend:

- **Students never receive `aiDraft`.** Do not expect it on student screens.
- The source-code `snapshot` is never returned to any role.
- `suggestedMarks` is only a suggestion. It is never saved as the real `grade`.
- The teacher should still edit and save the grade/feedback normally.
- When grading, the server changes a `ready` draft to `used` if the saved
  feedback exactly matches the draft, otherwise `edited`.
- New endpoints:
  - `POST /api/submissions/:id/ai-draft` (regenerate; `submissions.grade`)
    returns `aiDraft.status: "pending"` and works in the background.
  - `PATCH /api/submissions/:id/ai-draft/discard` marks the draft `discarded`.
- A submission has at most **8 lifetime generations**, counting automatic and
  manual runs. Regenerate after that returns `409`.
- Replacing a ZIP resets the draft but keeps the lifetime `generations` count.
- If AI is switched off, the endpoints return `503` and the server still starts
  normally. The startup log says `AI drafts are off`.

Assignments also accept an optional `rubric` (≤ 5000 chars) on create/update.
It is sent to the AI as extra marking context.

This change is additive: existing response shapes are unchanged apart from the
new `aiDraft` field for teachers/admins.

## 21. Excel-only imports and exports — breaking

User and batch bulk imports now accept `.xlsx` files only; CSV uploads are
rejected. User imports read the first worksheet with `name`, `email`,
`password`, and `role` columns. Batch bulk enrollment reads `studentId`.
Spreadsheet uploads are limited to 5 MB.

User, attendance, and submission exports now return `.xlsx` workbooks instead
of CSV text. The user import template is available at
`GET /api/users/bulk-import/template`.

## 22. Eligible enrollment candidates — additive

`GET /api/batches/:id/eligible-students` requires `batches.enroll` and batch
ownership. It supports the standard `page`, `limit`, and `search` query fields.
Admins see active students not yet in the batch. Teachers see unassigned
students and students in their own batches; students assigned only to another
teacher are not disclosed.

## 23. Clear notifications — additive

`DELETE /api/notifications` requires `notifications.view`. It deletes only the
authenticated recipient's notification records and returns `deletedCount`.
This action permanently clears notifications; it does not affect another
user's records.

## 24. Permission-gated AI assistant — additive

`POST /api/ai/assistant/ask` remains gated by `assistant.use`. Students receive
their own submission and attendance context. Other permitted roles can ask
general portal questions without student-record context.

## 25. Bulk quiz question entry (additive)

Quiz managers can download an Excel example from
`GET /api/quizzes/questions/template` and preview questions with
`POST /api/quizzes/questions/import`. Upload the `.xlsx` file as multipart
field `file` (maximum 5 MB). Its first worksheet needs `question`, `optionA`,
`optionB`, and `correctOption`; `optionC` through `optionF` are optional.
`correctOption` is the letter A-F for the correct filled option. The import
returns validated questions for the quiz draft; it does not create or save a
quiz. CSV is not accepted.

## 26. Student quiz access and notifications (additive)

Creating a quiz notifies students enrolled in its batch with a link to the quiz.
The student dashboard also lists active quizzes for their batches. Students can
read quiz content only for batches they are enrolled in; correct answer indices
are not included in student responses.

## 27. Batch student removal — additive

`DELETE /api/batches/:id/students/:studentId` requires `batches.enroll` and batch
ownership. It deactivates the enrollment instead of deleting it, preserving
historical records and allowing a later re-enrollment to reactivate the same
enrollment. Removed students lose access to that batch's current content.

## 28. Timed quiz attempts — breaking for quiz creation

New quizzes require `timeLimitMinutes`, a whole number from 1 to 1,440. Students
start or resume their server-timed attempt through
`POST /api/quizzes/:id/attempt/start`; answer changes are persisted with
`PATCH /api/quizzes/:id/attempt`. The existing submit route finalizes the attempt.
When the deadline has passed, saved answers are submitted automatically on the
next client save/submit request; late answer payloads are ignored. In-progress
attempts are excluded from staff results. The
`POST /api/quizzes/:id/attempt/violation` route records fullscreen/tab exits;
the third exit submits the saved answers after two warnings.

## 29. Device registration and push notifications — additive

Authenticated mobile clients can register an Expo push token with
`POST /api/devices`:

```json
{ "token": "ExponentPushToken[...]", "platform": "ios" }
```

`platform` must be `ios` or `android`. Registering the same token again updates
its owner, platform and last-seen time. Remove the current user's token with
`DELETE /api/devices/:token` (URL-encode the token); another user's token
returns `404`.

New announcements are also sent to enrolled batch students or all active
students for school-wide announcements. Delivery is best-effort and can be
disabled with `PUSH_ENABLED=false`; in-app notifications remain available
through `GET /api/notifications`.

## 30. Mobile session lifetime — mobile behavior change

Web session defaults remain unchanged. Mobile sessions use a 30-day refresh
token lifetime, inactivity timeout, and absolute session cap by default. These
are configurable with `MOBILE_REFRESH_TOKEN_DAYS`,
`MOBILE_IDLE_TIMEOUT_MINUTES`, and `MOBILE_SESSION_MAX_HOURS`.

## 31. Assistant conversation history — additive

`POST /api/ai/assistant/ask` accepts optional conversation history:

```json
{
  "question": "How do I create a quiz?",
  "conversation": [
    { "role": "user", "content": "Where are quizzes?" },
    { "role": "assistant", "content": "Open Quizzes from the navigation." }
  ]
}
```

History is limited to 10 messages; roles must be `user` or `assistant`, each
message is limited to 2,000 characters, and the current question is limited to
4,000 characters. History is untrusted context, not instructions.

## 32. Quiz list batch filter — additive

`GET /api/quizzes` accepts an optional `batchId` query parameter in addition to
standard pagination. The server validates the ID and applies the caller's
existing batch-access rules.

## 33. Multi-batch report cards — additive

When `batchId` is omitted from `GET /api/users/:id/report-card`, the report
includes all of the student's active enrolled batches. Supplying `batchId`
continues to request one batch. Staff access checks apply to every included
batch.
