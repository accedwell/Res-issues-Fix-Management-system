# ResiFix backend

Express + TypeScript API with Prisma and PostgreSQL. Configure `DATABASE_URL` and apply the migrations before starting it.

## Run it

```bash
cd backend
npm install
cp .env.example .env     # configure DATABASE_URL and TOKEN_SECRET
npx prisma generate
npx prisma migrate deploy
npm run dev              # http://localhost:5000
```

| Script | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when code changes |
| `npm run reset-data` | Replaces the configured database contents with sample data; use only on a disposable demo database |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run build` / `npm start` | Compiles to `dist/` and runs the compiled server |

## Sample accounts

Every sample account uses the password **`password123`**.

| Role | Email |
|---|---|
| Student | `naledi@resStudent.ac.za`, `karabo.s@resStudent.ac.za` |
| Supervisor | `mokgadi@resStaff.ac.za` |
| Maintenance (Plumbing) | `t.nkosi@resStaff.ac.za` |
| Maintenance (Electrical) | `l.mokoena@resStaff.ac.za` |
| Maintenance (General) | `s.dlamini@resStaff.ac.za` |
| Maintenance (IT / Wi-Fi) | `a.khumalo@resStaff.ac.za` |
| System admin | `sysadmin@resStaff.ac.za` |

Students must use `@resStudent.ac.za`. Supervisors, maintenance staff and system administrators must use `@resStaff.ac.za`. Addresses are stored in lowercase and accepted case-insensitively.

After configuring the intended local database, `npm run migrate:email-domains` updates existing active accounts to these domains while keeping account IDs, passwords and report ownership. The script runs in a transaction and stops if an address conflicts with an existing account.

## How the code is organised

```
src/
  index.ts            server setup and route mounting
  types.ts            shared data types
  lib/                password hashing, login tokens, errors, input checks
  middleware/auth.ts  reads the login token and checks roles
  services/           business rules (issue workflow, auto-assignment, removals)
  routes/             HTTP endpoints, kept thin
  store/              the ONLY code that reads or writes the data file
```

To move to a real database later, rewrite the files in `src/store/`. Their functions are already `async`, so the routes and services do not need to change.

## Logging in

`POST /api/auth/login` returns a `token`. Send it on every other request:

```
Authorization: Bearer <token>
```

Tokens last 7 days. In production, set `TOKEN_SECRET` in `.env` to a long random value.

## Endpoints

All paths start with `/api`. Errors come back as `{ "error": "message" }`.

### Auth
| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/auth/signup` | anyone (creates a **student**) | `firstName, lastName, studentNumber, email, block, room, password` |
| POST | `/auth/login` | anyone | `email, password, role?` |
| GET | `/auth/me` | logged in | |

Only students can sign up. The system admin creates every other account.

### Issues
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/issues?status=&category=&residence=&search=` | logged in | students get their own, maintenance their jobs, admins all |
| GET | `/issues/:id` | logged in, if allowed to see it | |
| POST | `/issues` | student | `title, category, residence, room, description, priority?, photo?` |
| POST | `/issues/:id/receive` | admin | |
| GET | `/issues/:id/recommended-staff` | admin | |
| POST | `/issues/:id/assign` | admin | `staffId?, priority?`. Leave out `staffId` to auto-assign by job |
| POST | `/issues/:id/progress` | assigned maintenance staff, admin | `status` (`In Progress` or `Resolved`), `note?` |
| POST | `/issues/:id/confirm` | the student who reported it | `rating` (1–5), `comment?` |
| POST | `/issues/:id/not-fixed` | the student who reported it | `reason`. Re-opens a resolved or closed issue |

**Auto-assignment** matches the issue category to a staff specialization:
- Plumbing and Water Supply go to Plumbing.
- Electrical and Lighting go to Electrical.
- Wi-Fi goes to IT / Wi-Fi.
- Everything else goes to General Maintenance.

If two people share a specialization, the one with fewer open jobs gets it.

### Notifications
| Method | Path | Who |
|---|---|---|
| GET | `/notifications` | logged in (own notifications plus `unread` count) |
| POST | `/notifications/read-all` | logged in |

### Users
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/users/staff` | admin, system admin | maintenance staff with open-job counts |
| GET | `/users` | system admin | |
| POST | `/users` | system admin | `name, email, role, password`, plus `specialization` (maintenance) or `studentNumber, block, room` (student) |
| DELETE | `/users/:id` | system admin | a removed staff member's open jobs go back to **Received** for re-assignment |

### Categories
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/categories` | anyone | |
| POST | `/categories` | system admin | `name, icon?` |
| PATCH | `/categories/:key` | system admin | `name?, icon?` |
| DELETE | `/categories/:key` | system admin | reports in it move to **Other**. **Other** itself cannot be removed |

### Settings
| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/settings/meta` | anyone | blocks, statuses and priorities for forms |
| GET | `/settings` | system admin | |
| PATCH | `/settings/:key` | system admin | `on` (true or false) |
