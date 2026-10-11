# Bhaktivedanta Book Stall | ISKCON Pandharpur

A responsive browser-based dashboard for Bhaktivedanta Book Stall at ISKCON Pandharpur, with sales, receipts, stock, reports, and book inventory modules.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/iskcon-books run dev` — run the dashboard website
- `pnpm --filter @workspace/iskcon-books run typecheck` — typecheck the website
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/iskcon-books/src/App.tsx` — dashboard modules and in-memory demo data
- `artifacts/iskcon-books/src/app.css` — website layout, responsive styling, and animations

## Architecture decisions

- This is a responsive website, not a native Android application.
- The supplied dashboard's sample data and workflows are frontend-only and remain in memory.
- Respect reduced-motion preferences for UI animations.

## Product

The dashboard manages book inventory, sales, receipts, stock alerts, and sales reports for Bhaktivedanta Book Stall at ISKCON Pandharpur.

## User preferences

- Preserve existing modules, copy, sample content, and behaviors; limit future changes to presentation and animation unless the user explicitly asks otherwise.
- Keep the experience as a full-screen responsive website, not an Android app.
- New sales must have no discount unless the owner enters one; support both a fixed rupee amount and a percentage.
- PDF reports should print only the selected report and key totals, not the full dashboard.

## Gotchas

The current books and sales data reset on refresh because this is a frontend-only demo.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
