# Security

This document lists the controls in the code, the checks that verify them, and
the limits you still need to handle when deploying.

## 1. Secrets and configuration

- Required values are checked at startup in `config/env.js`. The process exits
  before listening if anything is missing or unsafe.
- `JWT_SECRET` must be at least 64 characters, must not contain example words
  (`change_this`, `example`, `your_secret`, …), and must have at least 8
  distinct characters.
- `MONGO_URI` must be a `mongodb://` or `mongodb+srv://` URI.
- `FRONTEND_URL` must be a full `http://` or `https://` URL.
- Auth lifetimes are validated: the access token may not outlive the idle
  timeout, and the session cap may not be shorter than the idle timeout.
- `.env` and `.env.*` are git-ignored, except `.env.example`. The example file
  contains deliberately invalid placeholders, so copying it without editing
  makes the server refuse to start.
- `seedAdmin.js` takes the password from `ADMIN_PASSWORD` (or a hidden prompt),
  never from command-line arguments, because argv is visible in process lists
  and shell history.
- Security logs include event names, user ids, IPs and emails, but never
  passwords, tokens or hashes.

Verified by `tests/env.test.js`.

## 2. Authentication

| Control          | Implementation                                                       |
| ---------------- | -------------------------------------------------------------------- |
| Access token     | JWT, 10 min default, `httpOnly` cookie, issuer checked.              |
| Refresh token    | 64 random bytes, `httpOnly` cookie, SHA-256 hash stored.             |
| Rotation         | Every refresh replaces the session row.                              |
| Reuse detection  | Replaying a replaced token revokes the whole family.                 |
| Revocation       | Server-side sessions; logout and password change revoke immediately. |
| Idle timeout     | 10 min default, checked on every authenticated request.              |
| Absolute cap     | 24 h default per login family.                                       |
| Disabled user    | Rejected on the next request; all sessions revoked.                  |
| Login timing     | Unknown email still runs a bcrypt compare against a dummy hash.      |
| Login lockout    | 10 failures / 15 min per IP and per email.                           |
| Enumeration      | Login returns the same message for unknown email and wrong password. |
| Password storage | bcrypt, cost 10, never selected by default.                          |
| Password length  | 8–128 characters on register, change and reset.                      |

Tokens are never returned in JSON. That removes the usual XSS token theft path:
JavaScript cannot read `httpOnly` cookies.

Verified by `tests/auth.test.js`.

## 3. CSRF

Cookies are sent automatically, so state-changing requests require:

```
x-csrf-protection: 1
```

A cross-site HTML form cannot set custom headers, and a cross-origin `fetch`
that sets one triggers a CORS preflight, which only `FRONTEND_URL` passes. The
check runs globally for `POST`, `PUT`, `PATCH`, `DELETE` before any route.

Verified by `tests/auth.test.js` ("unsafe requests without the CSRF header are
rejected").

**Limit:** this is a header-based guard, not a per-session synchronizer token.
It is effective with the strict CORS policy. Do not loosen CORS to `*`.

## 4. CORS and cookies

- `origin: process.env.FRONTEND_URL` — one exact origin.
- `credentials: true`.
- Allowed headers: `Content-Type`, `Authorization`, `x-csrf-protection`.
- `x-powered-by` is disabled.
- `helmet()` sets standard security headers.
- Production cookies: `httpOnly`, `Secure`, `SameSite=None`.
- Development cookies: `httpOnly`, `SameSite=Lax`, no `Secure`.
- Refresh cookie path is `/api/auth`, so it is not sent to ordinary API routes.

Verified by `tests/env.test.js` ("production cookies are cross-site safe").

**Limit:** `SameSite=None` cookies are third-party cookies when the frontend and
API are on unrelated sites. Safari and some privacy settings block them. Use
subdomains of one parent domain and `COOKIE_DOMAIN` when possible.

## 5. Authorization and IDOR

Every protected route runs `auth`, then `requirePermission`. Authorization is
based on the **current database user**, not on JWT claims.

Ownership checks in services:

- Teacher → only batches where `teacher == user`.
- Users list → teacher sees only students in owned batches.
- Registration → teacher may create students only, into owned batches only.
- Attendance → write requires owned batch; student reads only self.
- Assignments → teacher manages owned batches; student must be enrolled.
- Submissions → student owns the row; teacher owns the batch; admin bypasses.
- Download → same rule as reading the submission.
- Roles/permissions → `roles.manage` (admin by default).

Soft-deleted users are rejected even with a valid token, and their sessions are
revoked.

Verified by `tests/permissions.test.js`.

## 6. Input validation

- `validateBodyShape` rejects non-object bodies and any key starting with `$`
  (NoSQL operator injection) on writes.
- `utils/validation.js` provides strict helpers: strings, booleans (real
  booleans only, so `"false"` cannot become `true`), numbers, dates, enums,
  ObjectIds, emails, passwords, arrays and grades.
- Every controller/service validates before touching the database.
- `pickFields` prevents mass assignment: only documented fields are written.
- Search text is escaped before becoming a MongoDB regex (`escapeRegex`).
- Pagination is bounded: `page ≥ 1`, `limit ≤ 100`.
- Body size is capped at 1 MB.
- Mongoose schemas use `strict: true`, enums, min/max and max lengths.

Verified by `tests/utils.test.js`.

## 7. Uploads

- Only `.zip` is accepted: extension, declared MIME type and magic bytes.
- Stored file names are random UUIDs with a `.zip` suffix. The original name is
  only used for display, sanitized, and never as a path.
- Uploads live in `UPLOAD_DIR`, outside any static/public folder.
- `resolveUploadPath` refuses paths that escape the upload root (including
  absolute paths and Windows drive letters).
- ZIP bomb checks read the central directory and reject:
  - more than 1000 entries,
  - more than 500 MB declared uncompressed,
  - compression ratio above 100:1,
  - ZIP64 archives,
  - entries with `../`, absolute paths or drive letters.
- Hard upload cap is 50 MB (`multer`), on top of the per-assignment limit.
- One submission per student+assignment; re-upload replaces the row.
- Download uses `res.download` with `Content-Disposition: attachment`, after an
  authorization check.
- Failed uploads are removed from disk.

Verified by `tests/uploads.test.js` and the submission tests.

**Limit:** the ZIP check reads declared sizes from the central directory. It
does not decompress the archive. That is fast and safe, and it stops accidental
and naive ZIP bombs, but a malicious archive could lie about its sizes. If you
later extract archives on the server, do it in a sandbox with a hard disk quota.

## 8. Data safety

- API deletes are soft deletes (users, batches, assignments).
- No endpoint hard-deletes attendance or submissions.
- Data scripts (`scripts/cleanData.js`, `scripts/migrateTeacherPermissions.js`)
  are dry runs by default.
- Any write requires both `--apply` and `--i-have-a-backup`.
- The cleanup script never deletes rows; it normalizes fields and reports
  duplicates and orphans for a human decision.
- Demo seeding refuses to run on production without `--i-have-a-backup`.

See `docs/DATABASE.md`.

## 9. Logging and error handling

- One central error handler returns `{ success: false, error }`.
- `5xx` responses say `Internal server error.`; the full error is logged on the
  server only.
- Stack traces, database errors and file paths are never sent to clients.
- Security events are structured JSON on stderr: login failures, rate limits,
  refresh reuse, idle timeouts, disabled users, password changes.
- Request bodies and cookies are never logged.

## 10. Transport and platform

- `app.set("trust proxy", 1)` so `req.ip` and `secure` cookies work behind
  Railway's proxy.
- Graceful shutdown on `SIGTERM`/`SIGINT`, with a 10-second force exit.
- Helmet sets `X-Content-Type-Options`, `X-Frame-Options`, HSTS and related
  headers.

## 11. Residual risks and next steps

| Risk                                            | Mitigation now                                      | Next step                                                                    |
| ----------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Login lockout is per process                    | In-memory map                                       | Move to Redis if you run more than one replica.                              |
| No password reset flow                          | Admin can set a password via `PATCH /api/users/:id` | Add a signed, single-use reset token with email delivery.                    |
| No email verification                           | Email is validated syntactically                    | Add verification if accounts are self-service.                               |
| No 2FA                                          | Not implemented                                     | Add TOTP for admins first.                                                   |
| Tokens valid until expiry after secret rotation | Standard JWT behavior                               | Rotate by revoking all sessions, then change `JWT_SECRET`.                   |
| Third-party cookie blocking                     | Cross-site cookie warning                           | Serve frontend and API from one parent domain.                               |
| Ephemeral uploads on Railway                    | Configurable `UPLOAD_DIR`                           | Mount a volume or use S3-compatible storage.                                 |
| No malware scan                                 | ZIP structure checks only                           | Scan uploads with ClamAV or an object-storage scanner before staff download. |
| No audit trail for reads                        | Security events cover auth only                     | Add an append-only audit collection if required by policy.                   |
| In-process rate limiting for all routes         | Login only                                          | Add a general IP rate limit at the proxy (Railway/Cloudflare).               |

## 12. Security checklist before deploy

- [ ] `JWT_SECRET` generated with `crypto.randomBytes(64)`, stored only in Railway variables.
- [ ] `NODE_ENV=production`.
- [ ] `FRONTEND_URL` is the exact HTTPS origin.
- [ ] Both services are HTTPS.
- [ ] `UPLOAD_DIR` points at a persistent volume, or uploads are moved to object storage.
- [ ] `mongodump` backup taken before any `--apply` data script.
- [ ] `npm test`, `npm audit` and `npm run lint` pass.
- [ ] Teacher permission migration applied deliberately.
- [ ] `.env` is not committed and never was.
- [ ] Logs are checked for secrets before sharing them.
