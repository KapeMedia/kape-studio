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

- **Provideri LLM cu metode pe sarcină** (`proposeAngles`, `writeCopy`, `interpretFeedback`, `reviewImage`) în loc de un singur `generateJson`: mock-ul determinist e mult mai simplu așa.
- **Claude: output structurat** (`output_config.format` + Zod, validat din nou și un retry la JSON invalid) în loc de tool use forțat: modelele Claude actuale (Sonnet 5.5) nu mai acceptă `tool_choice` forțat. Am activat și fallback-ul server-side la refuz (`server-side-fallback-2026-07-01`, `fallbacks: "default"`); se scoate din `src/server/providers/llm/anthropic.ts` dacă nu e dorit. Model din `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`, cum cere SPEC).
- **Retry propriu** (`src/server/providers/retry.ts`) cu backoff la 408/409/429/5xx; retry-urile SDK-urilor sunt dezactivate ca să nu se dubleze.
- **„Alege tu” la stil** = alegere deterministă după brief + industrie (`chooseStyle`): procente/reducere → Ofertă clară; eveniment → Anunț; food → Produs pe fundal colorat; beauty → Minimal premium; altfel Foto full. *Schimbare:* se poate muta în apelul Claude mai târziu.
- **Format master** = feed_4x5 dacă e bifat, altfel primul format bifat. O singură imagine de fundal per variantă (generată pe aspectul formatului master), folosită cu `cover` pe toate formatele.
- **Fundal în background:** `after()` din Next în route handler cu `maxDuration = 300`. Pe Vercel, o generare trebuie să termine în limita `maxDuration` a planului (Hobby: 60 s, Pro: până la 300+ s). Dacă nu ajunge, soluția e o coadă (ex. Inngest/QStash) - notat pentru mai târziu.
- **Preview-ul** se randează în browser (Konva, fonturi reale) de un component ascuns care procesează variantele fără preview și urcă PNG-ul + lista de texte care nu încap; QA-ul rulează la upload.
- **QA vision** folosește Claude dacă e configurat, altfel mock-ul (care semnalează doar cuvinte before/after în nișa beauty).
- **Editor:** mărimea textului setată manual oprește încadrarea automată pe layerul respectiv (checkbox „Încadrare automată”). Regenerarea imaginii din editor păstrează documentele editate și schimbă doar imaginea. Statusul variantei revine la „draft” după o imagine nouă.
- **Export în browser**, cu un stage Konva ascuns la rezoluție completă (pixelRatio), un format pe rând; ZIP fără compresie (PNG-urile sunt deja comprimate).
