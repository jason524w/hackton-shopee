# SeaLaunch AI — Website

An AI commerce company built for one Shopee seller. Marketing site + product flow.

## Stack
Next.js (App Router, TS) · Tailwind v4 · shadcn/ui · Framer Motion · Zustand · Vitest.

## Develop
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (store, flow, mock data)
npm run build    # production build
```

## Routes
- `/` Homepage · `/login` Login
- Flow: `/app/brief` → `/app/org-room` → `/app/board` → `/app/studio` → `/app/listing`
- Also: `/app/upload`, `/app/org-room/[dept]`, `/app/committee`, `/app/dashboard`

Data is mock/static (`src/lib/mock-data.ts`), shaped to match the future backend.
Demo case: Mini Desk Vacuum in Singapore.

See `docs/superpowers/specs/2026-06-06-sealaunch-ai-website-design.md` for the design spec.
