# Software Engineer Assessment

A self-contained technical-screening app for recruitment. Send each candidate
an **invite code**, they take a **timed assessment** (multiple choice + live
coding + SQL), and you review their **auto-graded score** plus manual SQL review
from a password-protected **admin dashboard**.

Built with **Next.js (App Router) + TypeScript + Tailwind**, backed by **Neon
Postgres**, and designed to deploy to **Vercel** with zero servers to manage.

---

## What's in the test

Three sections, all in one timed session (45 minutes by default):

1. **Knowledge Quiz** — auto-scored multiple choice covering SQL, logic, and core
   engineering concepts.
2. **Live Coding** — candidates write real JavaScript functions in the browser,
   auto-graded against hidden test cases (with instant feedback on the visible
   examples).
3. **SQL** — free-text query writing, reviewed manually by the recruiter.

The total score = auto-graded sections + your manual SQL score. You set the
final **Pass / Fail / Review** verdict from the dashboard.

---

## Deploy to Vercel

### 1. Create a Postgres database

- In your Vercel project, go to **Storage → Create** and choose **Neon**
  (Postgres). This gives you a free serverless database and a connection string.
- Copy the connection string.

### 2. Add environment variables

In **Vercel → Project → Settings → Environment Variables**, add:

| Name             | Value                                              |
| ---------------- | -------------------------------------------------- |
| `POSTGRES_URL`   | Your Neon connection string (`postgresql://…`)     |
| `ADMIN_PASSWORD` | A password for the recruiter dashboard             |
| `SESSION_SECRET` | A long random string (for the admin cookie)        |

> Locally, copy `.env.example` to `.env.local` and fill in the same values.

### 3. Deploy

Push this repo to GitHub and import it into Vercel (or run `vercel` from the
project folder). The framework preset auto-detects Next.js.

### 4. Initialize the database (one time)

After the first deploy, create the tables once. Either:

- Visit `https://your-app.vercel.app/api/setup` while signed in as admin, **or**
- From the dashboard, click **"Initialize database"** (shown automatically if
  the tables are missing).

That's it — the tables are created idempotently and the app is ready.

---

## How to use it

**As a recruiter (admin):**

1. Go to `https://your-app.vercel.app/admin` and sign in with `ADMIN_PASSWORD`.
2. Click **Generate invites** — paste candidates as `Name, email, Role` (one per
   line), set attempts and expiry, then send each generated link to its candidate.
3. As candidates finish, their scores appear in the dashboard. Click **Review**
   to see every answer, run the coding cases, score the SQL, and set a verdict.

**As a candidate:**

1. Open the invite link (or the home page) and enter their code.
2. Review instructions, then **Start Assessment** — the timer begins.
3. Work through the three sections (progress auto-saves).
4. **Submit** — they see their auto-graded score immediately; the SQL portion is
   reviewed later by the recruiter.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in POSTGRES_URL + ADMIN_PASSWORD
npm run dev
```

Then initialize the DB once by opening
`http://localhost:3000/api/setup?token=<your SETUP_TOKEN>` (or sign in as admin
and use the dashboard button).

---

## Customizing the questions

All test content lives in [`src/lib/questions.ts`](src/lib/questions.ts):

- `MCQ_QUESTIONS` — multiple choice (add `correctIndex`, `explanation`, `points`).
- `CODING_QUESTIONS` — coding problems. `examples` are shown to candidates;
  `testCases` (including hidden ones) are used for grading.
- `SQL_QUESTIONS` — manual-review SQL tasks.
- `ASSESSMENT` — title, `timeLimitMinutes`, and `passingPercent`.

Editing that file and redeploying is all you need to change the test.

---

## Security notes

- Coding answers are executed in an isolated V8 context server-side (`vm`) with a
  hard timeout, and previewed client-side in a Web Worker — an infinite loop
  cannot hang the server or the candidate's tab.
- Correct answers and hidden test cases never reach the browser; they stay
  server-side and are only used for grading.
- The admin dashboard is protected by a signed, httpOnly session cookie.

---

## Project structure

```
src/
  app/
    page.tsx                     # landing (enter code)
    t/[code]/page.tsx            # candidate invite page
    test/[attemptId]/page.tsx    # the timed test
    result/[attemptId]/page.tsx  # candidate result
    admin/                       # login, dashboard, review pages
    api/                         # route handlers (start/save/submit, admin, setup)
  components/                    # client UI (TestRunner, AdminDashboard, …)
  lib/                           # db, schema, auth, questions, scoring, runners
```
