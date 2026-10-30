# Database

MongoDB with Mongoose. Every schema uses `strict: true` and `timestamps: true`,
so unknown fields are dropped and `createdAt`/`updatedAt` are maintained.

## Collections

### `users`

| Field                    | Type     | Notes                                               |
| ------------------------ | -------- | --------------------------------------------------- |
| `name`                   | String   | Required, ≤ 100.                                    |
| `email`                  | String   | Required, unique, lowercase, ≤ 254, format checked. |
| `password`               | String   | bcrypt hash, `select: false`, min 8.                |
| `role`                   | String   | Enum: `admin`, `teacher`, `student`.                |
| `permissions`            | [String] | Extra permissions on top of the role.               |
| `active`                 | Boolean  | `false` means archived; login is refused.           |
| `archivedAt`             | Date     | Set when `active` becomes false.                    |
| `createdAt`, `updatedAt` | Date     | Automatic.                                          |

Indexes:

- `email` unique (from the field definition).
- `{ role: 1, active: 1 }` for filtered user lists.
- `{ name: 1 }` for sorted lists.

Passwords are never returned because every query excludes the field and
`toSafeJSON()` deletes it.

### `roles`

| Field         | Type     | Notes                                                  |
| ------------- | -------- | ------------------------------------------------------ |
| `name`        | String   | Unique, lowercase, ≤ 50.                               |
| `label`       | String   | Display name.                                          |
| `permissions` | [String] | Must come from the catalog in `config/permissions.js`. |
| `active`      | Boolean  | Inactive roles grant nothing.                          |

Index: `{ active: 1 }`.

Core roles (`admin`, `teacher`, `student`) are created on demand by
`roleService.ensureCoreRoles()` and cannot be deactivated.

### `batches`

| Field        | Type             | Notes               |
| ------------ | ---------------- | ------------------- |
| `name`       | String           | Required, ≤ 120.    |
| `teacher`    | ObjectId → users | Required.           |
| `active`     | Boolean          | `false` = archived. |
| `archivedAt` | Date             | Set on archive.     |

Indexes:

- `teacher` (field level).
- `{ teacher: 1, active: 1 }`.

### `enrollments`

| Field     | Type               | Notes     |
| --------- | ------------------ | --------- |
| `student` | ObjectId → users   | Required. |
| `batch`   | ObjectId → batches | Required. |

Index: `{ student: 1, batch: 1 }` unique.

A student may have many enrollments (one per batch). The unique index makes
re-enrolling idempotent.

### `assignments`

| Field                | Type               | Notes                      |
| -------------------- | ------------------ | -------------------------- |
| `batch`              | ObjectId → batches | Required.                  |
| `title`              | String             | Required, ≤ 160.           |
| `description`        | String             | ≤ 5000.                    |
| `dueDate`            | Date               | Required.                  |
| `allowedFileTypes`   | [String]           | Only `zip` today.          |
| `maxFileSizeMb`      | Number             | Default 25, 1–250.         |
| `resubmissionPolicy` | String             | `allowed` or `disabled`.   |
| `createdBy`          | ObjectId → users   | Required.                  |
| `active`             | Boolean            | `false` = archived/closed. |
| `closedAt`           | Date               | Set on archive or close.   |

Indexes:

- `batch` (field level).
- `{ batch: 1, active: 1 }`.
- `{ dueDate: 1 }`.

### `attendance`

| Field       | Type               | Notes                                              |
| ----------- | ------------------ | -------------------------------------------------- |
| `student`   | ObjectId → users   | Required.                                          |
| `batch`     | ObjectId → batches | Required.                                          |
| `batchName` | String             | Snapshot so archived batches still display a name. |
| `date`      | Date               | UTC midnight of the attendance day.                |
| `status`    | String             | `present`, `absent`, `leave`.                      |
| `enteredBy` | ObjectId → users   | Required.                                          |

Indexes:

- `{ student: 1, batch: 1, date: 1 }` unique — one record per day.
- `{ batch: 1, date: 1 }`.
- `{ student: 1, date: -1 }`.

`POST /api/attendance` is an upsert on student+batch+date.

### `submissions`

| Field         | Type                   | Notes                                 |
| ------------- | ---------------------- | ------------------------------------- |
| `assignment`  | ObjectId → assignments | Required.                             |
| `student`     | ObjectId → users       | Required.                             |
| `batch`       | ObjectId → batches     | Required, copied from the assignment. |
| `filePath`    | String                 | Random stored file name only.         |
| `fileName`    | String                 | Sanitized original name for display.  |
| `fileSize`    | Number                 | 1 byte – 50 MB.                       |
| `mimeType`    | String                 | Defaults to `application/zip`.        |
| `attempt`     | Number                 | Fixed at 1 (one active submission).   |
| `status`      | String                 | `submitted`, `graded`, `rejected`.    |
| `grade`       | String                 | Text, so `A` and `95` both work.      |
| `feedback`    | String                 | ≤ 2000.                               |
| `gradedBy`    | ObjectId → users       | Nullable.                             |
| `gradedAt`    | Date                   | Nullable.                             |
| `submittedAt` | Date                   | Updated on re-upload.                 |

Indexes:

- `{ assignment: 1, student: 1 }` unique — one submission per student.
- `{ batch: 1, submittedAt: -1 }`.

### `sessions`

| Field             | Type                | Notes                                           |
| ----------------- | ------------------- | ----------------------------------------------- |
| `user`            | ObjectId → users    | Required.                                       |
| `tokenHash`       | String              | SHA-256 of the refresh token, unique.           |
| `familyId`        | String              | Same for every rotation of one login.           |
| `expiresAt`       | Date                | TTL anchor.                                     |
| `lastActiveAt`    | Date                | Idle-timeout anchor.                            |
| `userAgent`       | String              | ≤ 500.                                          |
| `ip`              | String              | ≤ 64.                                           |
| `revokedAt`       | Date                | Set on logout/revocation.                       |
| `replacedBy`      | ObjectId → sessions | Set on rotation; non-null means "already used". |
| `familyCreatedAt` | Date                | Start of the login family.                      |
| `familyExpiresAt` | Date                | Absolute 24 h cap.                              |

Indexes:

- `tokenHash` unique.
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0` — MongoDB deletes expired rows.
- `{ familyId: 1, revokedAt: 1 }`.

Refresh tokens are never stored in plain text.

## Relationships

```
users 1---* batches (teacher)
users *---* batches        through enrollments
batches 1---* assignments
assignments 1---* submissions
users 1---* submissions    (student)
users 1---* attendance
users 1---* sessions
```

## Soft delete rules

- Users: `active=false`, `archivedAt`; sessions revoked.
- Batches: `active=false`, `archivedAt`; children preserved.
- Assignments: `active=false`, `closedAt`; submissions preserved.
- Attendance and submissions: never deleted by the API.
- There are no hard-delete endpoints.

This is why historical reports keep working after a teacher removes a batch or
a student leaves.

## Data scripts

All scripts load `.env`, use the same Mongoose models and print a summary.

### `npm run db:clean`

Dry run by default. It:

- trims and lowercases emails, names and roles,
- fills missing `active`/`archivedAt`/`permissions`,
- normalizes ObjectId references, dates and numeric fields,
- converts numeric grades to text,
- reports duplicate emails, duplicate enrollments, duplicate attendance days,
  duplicate submissions and orphan references.

It **never deletes records**. Duplicates and orphans are for a human to review.

```bash
# 1. Look at the report
npm run db:clean

# 2. Back up
mongodump --uri="$MONGO_URI" --out=backup-$(date +%F)

# 3. Apply
npm run db:clean -- --apply --i-have-a-backup
```

On PowerShell, use `mongodump --uri="$env:MONGO_URI" --out="backup-$(Get-Date -Format yyyy-MM-dd)"`.

### `npm run db:migrate-teacher-permissions`

Adds the new teacher permissions to the existing `teacher` role:

`attendance.manage`, `submissions.grade`, `students.view`, `students.create`,
`batches.update`, `batches.delete`, `batches.enroll`.

```bash
npm run db:migrate-teacher-permissions                               # dry run
npm run db:migrate-teacher-permissions -- --apply --i-have-a-backup   # write
```

Until this runs in production, the code allows those actions but the stored
role does not grant them, so teachers receive `403`.

### `npm run db:seed-demo`

Creates fake data with `@example.test` emails and one password from
`SEED_DEMO_PASSWORD`. It requires `--apply`, and on `NODE_ENV=production` it
also requires `--i-have-a-backup`. It is idempotent (upserts by natural keys).

## Backup and restore

Before any `--apply` run:

```bash
mongodump --uri="$MONGO_URI" --out=backup-YYYY-MM-DD
```

Restore into a scratch database first, verify, then restore over production
only with explicit approval:

```bash
mongorestore --uri="$MONGO_URI" --nsFrom="portal.*" --nsTo="portal_restore.*" backup-YYYY-MM-DD
```

Rules:

1. Never run a write script without a fresh dump.
2. Never delete collections or documents to "clean" data; normalize and report.
3. Test the restore path before you need it.
4. Keep backups off the application server.

## Schema changes

Mongoose creates indexes on connect. For large collections, build indexes in the
background during a maintenance window and watch for duplicate-key failures
(for example, the unique submission index will fail if duplicates already
exist). Run `db:clean` first to see the duplicates, resolve them manually, then
add the index.

Adding a required field to an existing collection needs a migration step:

1. Add the field as optional.
2. Backfill with a script (dry run first).
3. Make it required in a later deploy.

Do not drop and recreate a collection that holds submissions or attendance.
