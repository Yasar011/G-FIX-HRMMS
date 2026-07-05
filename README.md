# Factory Control Center

Portfolio site with a full admin panel ("Factory Control Center") driving all content. Built with Next.js (App Router, TypeScript, Tailwind) and Firebase (Auth + Realtime Database + Storage).

## Status

**Phase 1 (done):** auth (email/password + Google), role-based access (Super Admin / Editor / Viewer), admin dashboard shell with a placeholder page per planned module.

**Phase 2 (done):** Projects module end-to-end — admin CRUD with image/document uploads, public `/projects` list and `/projects/[slug]` detail pages, both reading live from Realtime Database.

Every other module in the admin sidebar (CMS, Internships, Fashion Portfolio, Photography, Certificates, AI Knowledge Center, AI Chatbot Manager, Media Manager, Theme Builder, Factory Layout Editor, Visitor Analytics, Contact Manager, SEO Manager, Backup System, Notification Center, Settings) is currently a placeholder — see the sidebar in `/admin` for the full list.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase project's web config (Project settings → General → Your apps).

### Firebase console setup (required, one-time)

1. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
2. **Realtime Database** → Rules → paste in the contents of [`database.rules.json`](./database.rules.json) → Publish.
3. **Storage** → Rules → paste in the contents of [`storage.rules`](./storage.rules) → Publish.
4. Sign in once at `/login`, then in the Realtime Database console flip your new `users/{uid}.role` from `"viewer"` to `"superadmin"` to unlock `/admin`.

## Architecture notes

- No custom backend / Firebase Admin SDK — everything runs through the Firebase client SDK, so there are no service-account secrets to manage in deployment.
- Roles live in Realtime Database at `users/{uid}.role` (`superadmin | editor | viewer`) and are enforced both client-side (`src/lib/auth-context.tsx`, `src/app/admin/layout.tsx`) and via Realtime Database security rules.
- Content lives under `content/` in Realtime Database (e.g. `content/projects/{id}`), publicly readable, editor/superadmin writable.
- Uploaded files (project images/documents) go to Firebase Storage under `projects/{projectId}/...`.
