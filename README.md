# Brandix Unit 3 — Enterprise HR Analytics Dashboard

A production-grade, realtime HR analytics platform for a garment manufacturing plant.
Pure **HTML5 + CSS3 + vanilla JavaScript (ES6 modules)** — no build step, no framework —
backed entirely by **Firebase** (Auth, Realtime Database, Storage, Analytics).

![stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Firebase-6366f1)

## Features

| Area | Highlights |
|---|---|
| **Dashboard** | 34 realtime KPI tiles (attendance, workforce, budget, OT, demographics) + 8 live trend charts |
| **Attendance** | Excel upload → auto-parse (SheetJS) → Firebase; daily & monthly views, per-employee history, late/early-out detection, OT & working-hours calculation |
| **Budget** | Monthly manpower budget vs actual, utilization % with green/yellow/red coding, Excel upload, copy-forward, exceeded alerts |
| **Employees** | Register with filters, full profile pages, photo upload (Storage), Excel-style export, leave balance |
| **Departments** | Per-department page: headcount, budget, attendance, late %, OT, joiners/leavers, efficiency, section charts |
| **Attrition** | Exit register, notice periods, reasons, monthly/yearly attrition %, tenure, replacement tracking |
| **Recruitment** | Candidate pipeline, stages, hiring source, recruiter performance, time-to-hire |
| **Leaves** | Apply/approve/reject with role gating; approved leaves auto-mark attendance |
| **Performance** | Discipline scoring, frequent-absentee analytics (>3/5/10 days, streaks, top-20, heatmap) |
| **Reports** | 28 reports, each downloadable as **PDF / Excel / CSV**, with date/month/year parameters |
| **Email automation** | EmailJS: send any report now or on schedule (daily/weekly/monthly/alerts) with PDF+Excel attachments and delivery log |
| **Notifications** | Realtime notification center: uploads, budget changes, joins/exits, threshold & birthday/anniversary alerts |
| **UX** | Glassmorphism dark/light themes, collapsible sidebar, global search (`/`), keyboard shortcuts, animated counters, skeletons, toasts, sticky-header tables with search/sort/pagination |

**Roles:** `HR Admin` (full control) · `HR Executive` (day-to-day ops) ·
`Department Manager` (own department + leave approvals) · `Management` (read-only analytics).

---

## 1 · Firebase setup (one-time, ~5 minutes)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → *Sign-in method* → enable **Email/Password**.
3. **Realtime Database** → *Create database* → then *Rules* tab → paste the contents of
   [`database.rules.json`](./database.rules.json) → **Publish**.
4. **Storage** → *Get started* → *Rules* tab → paste [`storage.rules`](./storage.rules) → **Publish**.
   *(Optional — only needed for employee photos/avatars.)*
5. Project settings → *General* → *Your apps* → **Add web app** → copy the config object into
   [`js/config/firebase-config.js`](./js/config/firebase-config.js).

> 🔑 **The first account registered becomes HR Admin automatically.**
> Everyone who registers afterwards must verify their email, then waits with
> **no access at all** until an HR Admin reviews them in **Settings → Pending
> Approvals** and assigns a role and department.
>
> HR Admins can also create a ready-to-use login directly in **Settings →
> Create guest / staff login** (username + password + role, optional expiry) —
> handy for temporary guest access. These skip the verify/approval wait.

### Try it with demo data

Sign in as HR Admin → **Settings → Load sample data**. This seeds ~120 employees,
60 days of attendance, budgets, leaves, attrition and a recruitment pipeline so every
chart, KPI and report is instantly populated.

## 2 · Run locally

Any static file server works (ES modules don't run from `file://`):

```bash
npx serve .          # or: python3 -m http.server 8080
```

Open http://localhost:3000 (or :8080).

## 3 · Deploy

### Option A — Firebase Hosting (recommended, same console as your data)

```bash
npm i -g firebase-tools
firebase login
# put your project id in .firebaserc (replace YOUR_FIREBASE_PROJECT_ID)
firebase deploy          # deploys hosting + database rules + storage rules
```

### Option B — GitHub Pages (zero-cost, automatic)

This repo ships with [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml):

1. Repo **Settings → Pages → Source: “GitHub Actions”**.
2. Push to `main` — the site deploys automatically.
3. Add your Pages URL to Firebase **Authentication → Settings → Authorized domains**.

## 4 · Email automation (optional)

1. Create a free account at [emailjs.com](https://www.emailjs.com), add an email service.
2. Create a template using the variables `to_email`, `subject`, `message`, `report_html`
   (and optionally variable attachments `attachment_pdf`, `attachment_xlsx` — paid plans).
3. Enter the **Public Key / Service ID / Template ID** in **Settings → EmailJS**.
4. Enable rules in **Email Automation** and set recipients.

> Scheduled sends run while any dashboard tab is open (checked every 30 min, with a
> database guard against duplicates). For guaranteed server-side delivery, port
> `js/lib/emailer.js` → `sendReportEmail()` into a scheduled Firebase Cloud Function.

## Excel formats

**Attendance upload** (Attendance page) — header names are case/spacing-insensitive:

| EmpID | Name | Date | Status | In | Out | Shift | OT |
|---|---|---|---|---|---|---|---|
| B30001 | Kasun Perera | 2026-07-06 | P | 07:52 | 17:05 | A | 1 |

Status accepts `P, A, L, HD, WFH, H` or full words; when omitted it is derived from
In/Out times. Dates accept `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY` or Excel dates.

**Budget upload** (Budget page): `Department | Budget` (+ optional `Section`).

## Architecture

```
index.html                 app shell (login + layout)
css/                       variables (design tokens) · base · layout · components
js/
├── config/firebase-config.js   ← your Firebase web config
├── main.js                bootstrap, login, global search, shortcuts
├── router.js              hash router + role-guarded page registry
├── lib/
│   ├── firebase.js        SDK init (Auth/RTDB/Storage/Analytics)
│   ├── store.js           realtime data layer (cached, refcounted, page-scoped)
│   ├── auth.js            roles & capability matrix
│   ├── metrics.js         pure HR analytics engine (all KPI math)
│   ├── reports.js         28-report registry (shared by Reports + Email)
│   ├── charts.js          theme-aware Chart.js factory
│   ├── export.js          PDF (jsPDF) / Excel (SheetJS) / CSV / PNG
│   ├── emailer.js         EmailJS engine + automation scheduler
│   ├── notify.js          realtime notification center
│   ├── seed.js            demo-data generator
│   ├── ui.js              toasts, modals, theme, badges, progress
│   └── utils.js           dates, numbers, DOM helpers
├── components/            kpi tiles · data table · filter bar
└── pages/                 dashboard, attendance, employees, departments,
                           budget, vacancies, recruitment, leaves, overtime,
                           attrition, performance, reports, email,
                           notifications, analytics, settings, profile
```

**Realtime by design:** pages subscribe to database paths through `store.pageWatch()`;
any change (attendance upload, budget edit, employee join/exit, leave approval)
recomputes KPIs, charts and tables in place — no reloads. Subscriptions are
refcounted and disposed automatically on navigation.

**Security:** access control is enforced by the database rules (role stored at
`users/{uid}/role`), not just the UI. The web API key is public by design.

## Scaling note

The dashboard subscribes to the whole `attendance` node for plant-wide analytics.
That is fine into the tens of thousands of records; for multi-year datasets with
1000+ employees, add per-month aggregate nodes (written at upload time) and point
the trend charts at those instead.
