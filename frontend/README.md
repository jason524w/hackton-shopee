# SeaLaunch AI — Frontend

The seller-facing app: marketing site + the `/app` workspace that drives a live
7-agent pipeline run. This is one of **two** Next apps in the repo — it talks to
the API app (repo root, `app/api/run`) over HTTP. See `docs/DEPLOY.md`.

## Stack
Next.js 16 (App Router, TS) · React 19 · Tailwind v4 · shadcn/ui · Framer Motion · Zustand · Vitest.

## Develop
```bash
npm install
npm run dev      # http://localhost:3001  (API app runs on :3000)
npm test         # unit tests (store, flow, adapters)
npm run build    # production build (standalone, for Docker)
```

The API app must be running for a real run. For a same-origin setup (no CORS),
put nginx in front (DEPLOY.md §3) and leave `NEXT_PUBLIC_API_BASE_URL` empty.

## Routes
- `/` Homepage · `/login` Login
- Flow: `/app/brief` → `/app/org-room` → `/app/board` → `/app/studio` → `/app/listing`
- Also: `/app/upload`, `/app/org-room/[dept]`, `/app/committee`, `/app/dashboard`, `/app/history`

## Data flow (no mock — single real path, iron rule 3)
`/app/brief` POSTs to the API's `POST /api/run` (`src/lib/api.ts`). The returned
`RunResult` is stored in `src/lib/store.ts` (zustand) and mapped to view models in
`src/lib/adapters.ts`. Types come from `contract/result.ts` — never redefined here.
Before a run, pages render empty/loading states. There is no `?mock=1` and no
`mock-data.ts`; the only path is the live pipeline (`?images=0` for a fast
text-only run during rehearsal).
