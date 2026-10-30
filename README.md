# School Portal — Backend

REST API for a small school portal: users and roles, batches, assignments,
ZIP submissions, grading and attendance.

The API is designed for a frontend hosted on a **different address** (for
example `portal.up.railway.app` calling `portal-api.up.railway.app`), so
authentication uses cross-site `httpOnly` cookies instead of tokens stored in
JavaScript.

## What this service does

- Logs users in with a short-lived JWT access token plus a rotating refresh token.
- Keeps sessions in MongoDB, so logout, idle timeout and "disable user" take effect immediately.
- Enforces permissions and ownership on every request (admin / teacher / student).
- Stores uploaded ZIP files outside the public folder and serves them only through an authorized download route.
- Archives users, batches and assignments instead of deleting history.
- Ships tests for every security control in `tests/`.

## Requirements

- Node.js 20 or newer.
- MongoDB 6 or newer (local, Docker, or MongoDB Atlas).

## Quick start

```bash
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux

# Generate a real secret and paste it into JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

npm run dev
```

The server refuses to start while required environment values are missing or
unsafe. That is intentional. See `docs/SECURITY.md` for the full list.

Open `http://localhost:5000/health`:

```json
{ "success": true, "data": { "status": "ok" } }
```

Create the first admin (values come from environment variables, never argv):

```bash
# add ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD to .env first
npm run seed:admin
```

## Environment variables

| Name                                            | Required      | Default       | Notes                                                       |
| ----------------------------------------------- | ------------- | ------------- | ----------------------------------------------------------- |
| `PORT`                                          | no            | `5000`        | Railway sets this for you.                                  |
| `NODE_ENV`                                      | no            | `development` | Use `production` on Railway.                                |
| `MONGO_URI`                                     | yes           | —             | Must start with `mongodb://` or `mongodb+srv://`.           |
| `JWT_SECRET`                                    | yes           | —             | At least 64 characters, random, not an example value.       |
| `FRONTEND_URL`                                  | yes           | —             | Exact origin allowed by CORS. No trailing slash.            |
| `ACCESS_TOKEN_MINUTES`                          | no            | `10`          | Must not exceed the idle timeout.                           |
| `REFRESH_TOKEN_DAYS`                            | no            | `7`           | Sliding refresh lifetime.                                   |
| `IDLE_TIMEOUT_MINUTES`                          | no            | `10`          | No request for this long logs the user out.                 |
| `SESSION_MAX_HOURS`                             | no            | `24`          | Hard cap for one login family.                              |
| `COOKIE_DOMAIN`                                 | no            | empty         | Set only for a shared parent domain such as `.example.com`. |
| `UPLOAD_DIR`                                    | no            | `./uploads`   | Must be writable and persistent in production.              |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeding   | —             | Used only by `npm run seed:admin`.                          |
| `SEED_DEMO_PASSWORD`                            | for demo seed | —             | Used only by `npm run db:seed-demo`.                        |

Never commit `.env`. `.gitignore` already excludes it and everything matching
`.env.*` except `.env.example`.

## Scripts

| Command                                  | What it does                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `npm start`                              | Start the API.                                                                    |
| `npm run dev`                            | Start with nodemon.                                                               |
| `npm test`                               | Run all tests with `node --test` against an in-memory MongoDB.                    |
| `npm run lint`                           | ESLint (fails on unused variables, `==`, `var`).                                  |
| `npm run format`                         | Prettier.                                                                         |
| `npm run seed:admin`                     | Create the first admin from env vars.                                             |
| `npm run db:migrate-teacher-permissions` | Add the new teacher permissions to the existing teacher role. Dry run by default. |
| `npm run db:clean`                       | Normalize data and report duplicates/orphans. Dry run by default, never deletes.  |
| `npm run db:seed-demo`                   | Create fake demo accounts (requires `--apply`).                                   |

Write scripts refuse to run without `--apply --i-have-a-backup`. See
`docs/DATABASE.md` before touching real data.

## Folder structure

```
app.js                 Express wiring, CORS, helmet, CSRF, error handler
server.js              Env check, database connect, listen, graceful shutdown
config/                env validation, auth settings, permission catalog, db connection
constants/             roles, statuses, limits, sizes, cookie names
models/                Mongoose schemas and indexes
routes/<feature>.js    URL -> controller mapping only
controllers/           HTTP layer, under 150 lines each
services/              Business rules and database access
middleware/            auth, permissions, CSRF, body validation, uploads
utils/                 validation, pagination, search, cookies, ZIP checks, errors
scripts/               safe data scripts (dry run by default)
tests/                 security and behavior tests
docs/                  API, architecture, database, security, change log
```

The rule is always:

```
routes/<feature>.js -> controllers/<feature>Controller.js
                    -> services/<feature>Service.js
                    -> models/<Feature>.js
```

`docs/ADD_A_FEATURE.md` walks through adding a feature in that shape.

## API and docs

- Endpoint reference: `docs/API.md`
- Breaking changes for the frontend: `docs/API_CHANGES.md`
- Architecture and request flow: `docs/ARCHITECTURE.md`
- Security controls and limits: `docs/SECURITY.md`
- Collections, indexes and data scripts: `docs/DATABASE.md`
- Coding rules: `docs/CODING_RULES.md`

## Frontend integration (different origins)

The frontend must send cookies:

```js
await fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-protection": "1",
  },
  body: JSON.stringify({ email, password }),
});
```

Rules:

1. `credentials: "include"` on every request.
2. `x-csrf-protection: 1` on every `POST`, `PUT`, `PATCH` and `DELETE`.
3. Do not store tokens in `localStorage`. The tokens are `httpOnly` cookies.
4. On `401`, call `POST /api/auth/refresh` once, then retry the original request.
5. Read `X-Total-Count`, `X-Page` and `X-Page-Limit` from list responses.

## Deployment notes (Railway)

- Set `NODE_ENV=production` and `FRONTEND_URL` to the exact frontend origin.
- Cookies become `SameSite=None; Secure` automatically in production. **Both
  sites must be HTTPS**, or the browser will drop the cookies.
- If the frontend and API are on unrelated domains (not subdomains of the same
  site), some browsers block third-party cookies. Prefer putting both services
  on the same parent domain (for example `app.example.com` and
  `api.example.com`) and set `COOKIE_DOMAIN=.example.com`.
- Railway containers have an ephemeral filesystem. Uploaded ZIP files disappear
  on redeploy unless `UPLOAD_DIR` points at a mounted volume or you move uploads
  to object storage before going live.
- Take a `mongodump` backup before running any `--apply` data script.

## Tests

```bash
npm test
```

The suite starts a throwaway MongoDB in memory, so it never touches your
database, and covers:

- cookie-only login, refresh rotation, refresh-reuse detection
- access token expiry, idle timeout, disabled-user rejection
- logout revocation, login lockout, CSRF rejection, password-change revocation
- environment validation and production cookie flags
- teacher/student ownership across batches, attendance, grading and registration
- multi-batch enrollment and soft-delete behavior
- ZIP signature, ZIP bomb, unsafe archive paths and upload path traversal
- validation, pagination, error mapping and permission normalization

42 tests, no external services required.
