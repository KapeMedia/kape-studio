# DECISIONS.md

Decizii luate autonom acolo unde SPEC.md nu spune explicit. Format: dată, decizie, motiv, cum se schimbă.

## 2026-11-26

- **Branch de lucru `v1`.** Repo-ul `KapeMedia/kape-studio` avea doar un commit inițial cu README pe `main`. Lucrez pe `v1`, cu push după fiecare milestone. *Schimbare:* PR `v1 → main` când Onisim validează.
- **Versiuni:** Next 16.4.6 (App Router, Turbopack), React 19.3, TypeScript 6.0.3 (TS 7 nativ nu e încă suportat de toolchain-ul Next), ESLint 9 (config flat), Tailwind 4, Drizzle 0.45 + PGlite 0.6, Zod 4, Vitest 5. *Schimbare:* `package.json`.
- **`proxy.ts` în loc de `middleware.ts`.** Next 16 a redenumit convenția. Proxy-ul verifică cookie-ul; API-urile primesc 401, paginile redirect la `/login`.
- **Auto-login local.** Fără `TEAM_PASSWORD` și când nu rulează pe Vercel, proxy-ul setează automat sesiunea pentru Onisim. Pe Vercel fără `TEAM_PASSWORD` login-ul e blocat. *Schimbare:* `src/server/auth/session.ts`.
- **AUTH_SECRET în dev:** dacă lipsește, se generează unul și se salvează în `.data/auth-secret` (nu doar în memorie), pentru că proxy-ul și serverul pot rula în bundle-uri diferite și ar avea secrete diferite.
- **Utilizatori cu UUID-uri fixe** (`...0001` Onisim, `...0002` Andrei, `...0003` Editor), ca auto-login-ul să nu depindă de DB.
- **Migrații + seed automat la prima cerere.** `getDb()` aplică migrațiile Drizzle și rulează seed-ul dacă tabela `users` e goală. Așa `pnpm dev` merge fără niciun pas manual. Pe Postgres se poate opri cu `AUTO_MIGRATE=false`.
- **Tipare DB:** ambele drivere (PGlite, postgres-js) sunt tipate ca `PgliteDatabase<schema>` (au același API de query). Cast-ul e într-un singur loc: `src/server/db/connect.ts`.
- **`variants.documents`** (`Record<FormatKey, Doc>`) în loc de `document` singular, plus `documentVersion`, `visualPrompt`, `error`, `rejectReason`. Statusul variantei are și `pending` (imaginea se generează) și `failed`.
- **`brain_entries.suggestAgencyWide`** (bool) ca să afișăm butonul „Fă-o regulă de agenție”; event nou `restored`.
- **Tabelă `app_settings`** (cheie/valoare) pentru setări din UI (ex: provider implicit de imagine).
- **Storage:** driverele `local` și `supabase` (REST, fără SDK). `vercel-blob` cade pe `local` cu warning (nu e în v1). Fișierele se servesc mereu prin `/api/files/...` (același origin → canvas-ul nu e „tainted”), inclusiv cu Supabase (bucket privat).
- **Componente UI scrise de mână** (stil shadcn, peste Radix) într-un singur fișier `src/components/ui/index.tsx` + `toast.tsx`. Fără CLI shadcn.
- **Fonturi UI:** `@fontsource/inter` (fără `next/font/google`).
