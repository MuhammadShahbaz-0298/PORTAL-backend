# School Portal: Backend

REST API for a small school portal: users and roles, batches, assignments,
ZIP submissions, grading and attendance.

The frontend is separate, so authentication uses `httpOnly` cookies instead of
tokens kept in JavaScript.

## What it does

- Logs users in with a short-lived access token plus a rotating refresh token.
- Keeps sessions in MongoDB, so logout, idle timeout and "disable user" take
  effect immediately.
- Checks permissions and ownership on every request (admin, teacher, student).
- Stores uploaded ZIP files outside any public folder and serves them only
  through an authorized download route.
- Archives users, batches and assignments instead of deleting history.
- Lets an admin reset a user's password. The user must choose a new one at the
  next sign-in.
- Optionally drafts AI feedback for a teacher to review. The AI never saves a
  grade, and students never see the draft.
- Ships tests for the security controls in `tests/`.

## Tech stack

Node.js, Express 4, MongoDB with Mongoose 8, JWT, bcryptjs, multer, helmet,
ESLint and Prettier. Tests use `node --test` and an in-memory MongoDB.

## Requirements

- Node.js 20 or newer
- MongoDB 6 or newer (local or Docker)

## Quick start

```bash
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
```

Generate a real secret and paste it into `JWT_SECRET` in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the API:

```bash
npm run dev
```

Check that it is alive at `http://localhost:5000/health`:

```json
{ "success": true, "data": { "status": "ok" } }
```

The server refuses to start while a required value is missing or unsafe. That
is on purpose. See `docs/SECURITY.md`.

## Create the first admin

Put `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run seed:admin
```

The password is read from the environment, never from the command line. Remove
`ADMIN_PASSWORD` from `.env` afterwards.

To create clearly fake demo accounts for local work, set `SEED_DEMO_PASSWORD`
and run `node scripts/seedDemo.js --apply`.

## Environment variables

| Name                                            | Required      | Default               | Notes                                                     |
| ----------------------------------------------- | ------------- | --------------------- | --------------------------------------------------------- |
| `PORT`                                          | no            | `5000`                | API port.                                                 |
| `NODE_ENV`                                      | no            | `development`         | Runtime environment.                                      |
| `MONGO_URI`                                     | yes           |                       | Must start with `mongodb://` or `mongodb+srv://`.         |
| `JWT_SECRET`                                    | yes           |                       | At least 64 random characters, not an example value.      |
| `FRONTEND_URL`                                  | yes           |                       | Exact frontend origin allowed by CORS. No trailing slash. |
| `ACCESS_TOKEN_MINUTES`                          | no            | `10`                  | Must not be longer than the idle timeout.                 |
| `REFRESH_TOKEN_DAYS`                            | no            | `7`                   | Refresh token life.                                       |
| `IDLE_TIMEOUT_MINUTES`                          | no            | `10`                  | No request for this long logs the user out.               |
| `SESSION_MAX_HOURS`                             | no            | `24`                  | Hard cap for one login.                                   |
| `COOKIE_DOMAIN`                                 | no            | empty                 | Only for a shared parent domain such as `.example.com`.   |
| `UPLOAD_DIR`                                    | no            | `./uploads`           | Must be writable. See the storage note below.             |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeding   |                       | Used only by `npm run seed:admin`.                        |
| `SEED_DEMO_PASSWORD`                            | for demo seed |                       | Used only by `scripts/seedDemo.js`.                       |
| `AI_API_KEY`                                    | no            | empty                 | Empty switches AI drafts off. Never commit a real key.    |
| `AI_ENABLED`                                    | no            | `true`                | Set to `false` to switch AI drafts off even with a key.   |
| `AI_BASE_URL`                                   | no            | Groq URL              | Any OpenAI-compatible chat endpoint.                      |
| `AI_MODEL`                                      | no            | `openai/gpt-oss-120b` | Model name sent to the AI service.                        |
| `AI_MAX_INPUT_CHARS`                            | no            | `14000`               | 2000–30000 characters of student code sent to the AI.     |

Never commit `.env`. `.gitignore` already excludes it.

## Scripts

| Command                                   | What it does                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `npm start`                               | Start the API.                                                                  |
| `npm run dev`                             | Start with nodemon.                                                             |
| `npm test`                                | Run all tests against an in-memory MongoDB.                                     |
| `npm run lint` / `npm run lint:fix`       | Check, or fix, code problems with ESLint.                                       |
| `npm run format` / `npm run format:check` | Format, or check formatting, with Prettier.                                     |
| `npm run seed:admin`                      | Create the first admin from environment variables.                              |
| `npm run db:migrate-teacher-permissions`  | Add newer teacher permissions to the existing teacher role. Dry run by default. |
| `npm run db:clean`                        | Normalize data and report duplicates and orphans. Dry run by default.           |

Scripts that write data refuse to run without `--apply --i-have-a-backup`. Take
a `mongodump` backup first and read `docs/DATABASE.md`.

## Roles and default permissions

| Role    | Can do                                                                                        |
| ------- | --------------------------------------------------------------------------------------------- |
| Admin   | Everything: users, roles, batches, assignments, grading, attendance                           |
| Teacher | Their own batches: students, assignments, grading, attendance                                 |
| Student | View their assignments, upload and replace their own ZIP, see their own grades and attendance |

Admins can create custom roles and grant extra permissions to a single user.
The full permission list is in `config/permissions.js`. Permissions and
ownership are checked on the server for every request, whatever the frontend
shows.

## API overview

All routes are under `/api`. Full details are in `docs/API.md`.

| Area        | Routes                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth        | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`, `/auth/register`; `GET /auth/me`                                                                                   |
| Users       | `GET /users`, `PATCH /users/:id`, `PATCH /users/:id/reset-password`, `DELETE /users/:id`                                                                                                                             |
| Batches     | `GET/POST /batches`, `PATCH/DELETE /batches/:id`, `POST /batches/:id/enroll`, `GET /batches/:id/students`                                                                                                            |
| Assignments | `GET/POST /assignments`, `GET/PATCH/DELETE /assignments/:id`                                                                                                                                                         |
| Submissions | `GET /submissions`, `POST /submissions`, `PATCH /submissions/:id/file`, `PATCH /submissions/:id/grade`, `GET /submissions/:id/download`, `POST /submissions/:id/ai-draft`, `PATCH /submissions/:id/ai-draft/discard` |
| Attendance  | `GET/POST /attendance`, `GET /attendance/:studentId`, `PATCH /attendance/:id`                                                                                                                                        |
| Roles       | `GET/POST /roles`, `PATCH /roles/:id`, `GET /permissions`, `PATCH /permissions/users/:id`                                                                                                                            |
| Health      | `GET /health`                                                                                                                                                                                                        |

Lists return a plain array. Paging details come in the `X-Page`, `X-Page-Limit`
and `X-Total-Count` headers. Errors use one shape:
`{ "success": false, "error": "message" }`.

## Using the API (from a frontend or Postman)

1. Send cookies: `credentials: "include"` in `fetch`, or `withCredentials: true`
   in Axios.
2. Add the header `x-csrf-protection: 1` to every `POST`, `PUT`, `PATCH` and
   `DELETE`. Without it the API answers `Missing CSRF protection header.`
3. Never store tokens in `localStorage`. They are `httpOnly` cookies.
4. On a `401`, call `POST /api/auth/refresh` once, then retry the request.

In Postman, put the CSRF header on the collection and keep requests inside a
collection so the cookie jar is used.

## Folder structure

```
app.js               Express setup: helmet, CORS, CSRF, routes, error handler
server.js            Env check, database connect, listen, graceful shutdown
config/              Env validation, auth settings, permission catalog, database
constants/           Roles, statuses, limits, sizes, cookie names
models/              Mongoose schemas and indexes
routes/              URL to controller mapping only
controllers/         HTTP layer
services/            Business rules and database access
middleware/          Auth, permissions, ownership, CSRF, body checks, uploads
utils/               Validation, pagination, search, cookies, ZIP checks, errors
scripts/             Data scripts (dry run by default)
tests/               Security and behaviour tests
docs/                API, architecture, database, security, change log
```

Every feature follows one shape:

```
routes/<feature>.js -> controllers/<feature>Controller.js
                    -> services/<feature>Service.js
                    -> models/<Feature>.js
```

`docs/ADD_A_FEATURE.md` explains how to add one by copying an existing feature.

## Documentation

| File                    | What is in it                              |
| ----------------------- | ------------------------------------------ |
| `docs/API.md`           | Every endpoint, who can call it, examples  |
| `docs/API_CHANGES.md`   | Contract changes the frontend must follow  |
| `docs/ARCHITECTURE.md`  | Request flow, auth and permission design   |
| `docs/SECURITY.md`      | Security controls and practices            |
| `docs/DATABASE.md`      | Collections, fields, indexes, data scripts |
| `docs/ADD_A_FEATURE.md` | Copy-and-rename recipe for a new feature   |
| `docs/CODING_RULES.md`  | Naming, comments and file rules            |

## Troubleshooting

| Problem                                    | Likely cause and fix                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `Missing CSRF protection header.`          | Add `x-csrf-protection: 1` to the request.                                     |
| Server exits at start                      | A required variable is missing or unsafe. The message names which one.         |
| Login works but you are logged out at once | Cookies blocked across sites, or `FRONTEND_URL` is not an exact match.         |
| `429` on login                             | Ten failed attempts in 15 minutes. Wait for the window to end.                 |
| `403` "You must change your password..."   | An admin reset this account. Sign in and use change password.                  |
| CORS error in the browser                  | `FRONTEND_URL` must equal the browser address exactly, with no trailing slash. |

## Tests

```bash
npm test
```

The suite starts a throwaway MongoDB in memory, so it never touches your real
database. It covers login cookies, refresh rotation and reuse detection, idle
timeout, disabled users, CSRF, login lockout, password changes and admin
resets, environment checks, permissions and ownership across batches,
attendance, grading and registration, ZIP safety checks, validation and
pagination.
