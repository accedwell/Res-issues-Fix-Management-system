# ResiFix backend

Express + TypeScript API. There is no database yet. All data is kept in one JSON file, `backend/data/db.json`. The server creates that file with sample data the first time it starts. The file is git-ignored, so each developer has their own copy.

## Run it

```bash
cd backend
npm install
cp .env.example .env     # optional, the defaults work locally
npm run dev              # http://localhost:5000
```

| Script | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when code changes |
| `npm run reset-data` | Wipes `data/db.json` and restores the sample data |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run build` / `npm start` | Compiles to `dist/` and runs the compiled server |

## Sample accounts

Every sample account uses the password **`password123`**.

| Role | Email |
|---|---|
| Student | `naledi.m@campus.ac.za`, `karabo.s@campus.ac.za` |
| Residence admin | `p.mokgadi@campus.ac.za` |
| Maintenance (Plumbing) | `t.nkosi@campus.ac.za` |
| Maintenance (Electrical) | `l.mokoena@campus.ac.za` |
| Maintenance (General) | `s.dlamini@campus.ac.za` |
| Maintenance (IT / Wi-Fi) | `a.khumalo@campus.ac.za` |
| System admin | `sysadmin@campus.ac.za` |

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
