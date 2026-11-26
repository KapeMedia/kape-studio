# KAPE Studio

Aplicația internă a KAPE Media pentru bannere statice on-brand (feed, story, cover Facebook, landscape). Fiecare client are brand kit, proiecte și un „brain” care învață din feedback.

- Specificația: [`SPEC.md`](SPEC.md)
- Ce e gata / ce urmează: [`PROGRESS.md`](PROGRESS.md)
- Decizii luate pe parcurs: [`DECISIONS.md`](DECISIONS.md)

---

## 1. Pornire locală (fără niciun cont)

Ai nevoie de **Node.js 20+** și **pnpm** (`npm i -g pnpm`).

```
pnpm install
pnpm dev
```

Deschide **http://localhost:3000**.

Fără `.env`, aplicația:

- folosește **PGlite** (Postgres în proces) salvat în `.data/pglite`; migrațiile și seed-ul (3 utilizatori, 2 clienți demo, formate, 6 stiluri) rulează automat la prima cerere;
- salvează fișierele în `.data/uploads`;
- folosește **providerii mock** pentru text și imagini (imagini-gradient cu eticheta „MOCK”, copy determinist);
- te loghează automat ca **Onisim** (pentru că nu e setat `TEAM_PASSWORD`).

Ca să o iei de la zero, oprește serverul și șterge folderul `.data`.

### Comenzi

| Comandă | Ce face |
|---|---|
| `pnpm dev` | pornește aplicația |
| `pnpm build` / `pnpm start` | build de producție / pornire build |
| `pnpm typecheck` | TypeScript strict |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (folosește PGlite în memorie, fără rețea) |
| `pnpm db:generate` | generează o migrație nouă după ce modifici `src/server/db/schema.ts` |
| `pnpm db:migrate` | aplică migrațiile (local sau pe `DATABASE_URL`) |
| `pnpm db:seed` | adaugă datele seed (idempotent) |

> PGlite permite un singur proces pe folder: oprește `pnpm dev` înainte de `pnpm db:seed` / `db:migrate` local.

---

## 2. Variabile de mediu

Copiază `.env.example` în `.env.local` și completează doar ce ai nevoie. Orice cheie lipsă = mod mock pentru providerul respectiv.

| Variabilă | Rol |
|---|---|
| `DATABASE_URL` | Postgres (Supabase / Neon). Gol = PGlite local. |
| `AUTO_MIGRATE` | `false` ca aplicația să nu ruleze migrațiile singură la pornire (implicit le rulează). |
| `STORAGE_DRIVER` | `local` (implicit) sau `supabase`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | pentru storage pe Supabase (bucket privat; fișierele se servesc prin aplicație). |
| `TEAM_PASSWORD` | parola echipei. Gol = login automat (doar local; pe Vercel login-ul e blocat fără ea). |
| `AUTH_SECRET` | secretul pentru cookie-ul de sesiune (minim 32 de caractere aleatorii). Local se generează în `.data/auth-secret`. **Obligatoriu pe Vercel.** |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude pentru unghiuri, copy, interpretarea feedback-ului, QA vision. Model implicit `claude-sonnet-5-5`. |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` | imagini cu `gpt-image-2`. |
| `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL` | imagini cu `gemini-3-pro-image-preview`. |
| `DEFAULT_IMAGE_PROVIDER` | `openai` / `gemini` / `mock` (se poate schimba și din Setări). |

După ce pui cheile, intră în **Setări** și apasă **Test conexiune** la fiecare provider. Tot acolo vezi costul lunii pe client și pe provider. Prețurile sunt în `src/server/services/costs/prices.ts`.

---

## 3. Punere live: Vercel + Postgres + Storage

Pe Vercel discul nu e persistent, deci în producție ai nevoie de **Postgres** și de **Supabase Storage**.

### 3.1 Baza de date (Supabase sau Neon)

1. Creează un proiect pe [Supabase](https://supabase.com) (sau [Neon](https://neon.tech)).
2. Copiază connection string-ul Postgres.
   - Supabase: Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Aplicația folosește deja `prepare: false`, necesar pentru pooler.
   - Neon: connection string-ul „pooled”.
3. Rulează migrațiile o dată, de pe calculatorul tău:

   ```
   $env:DATABASE_URL="postgres://..."; pnpm db:migrate; pnpm db:seed
   ```

   (Seed-ul creează utilizatorii, formatele, stilurile și cei 2 clienți demo. Clienții demo se pot arhiva din aplicație.)

### 3.2 Storage (Supabase)

1. Supabase → Storage → New bucket → nume `kape-studio`, **privat**.
2. Ia `SUPABASE_URL` și `service_role key` din Project Settings → API. Cheia service role e secretă: o pui doar în variabilele Vercel, niciodată în cod.

### 3.3 Vercel

1. Importă repo-ul `kape-studio` în Vercel (framework detectat: Next.js, build `pnpm build`).
2. Setează variabilele de mediu (Production):
   - `DATABASE_URL`
   - `AUTH_SECRET` (generează: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `TEAM_PASSWORD`
   - `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=kape-studio`
   - cheile AI pe care le ai (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) și `DEFAULT_IMAGE_PROVIDER`
   - opțional `AUTO_MIGRATE=false` dacă vrei să rulezi migrațiile doar manual.
3. Deploy.

**Limita de timp:** generarea rulează în fundal după răspuns (`after()`), cu `maxDuration = 300` s pe rutele de generare. Pe planul Hobby Vercel limitează funcțiile la 60 s, ceea ce poate tăia generări cu multe imagini reale. Pe Pro merge până la 300 s. Detalii și alternative în `DECISIONS.md`.

### 3.4 Migrații la versiuni noi

Când se schimbă schema (`src/server/db/schema.ts`):

```
pnpm db:generate
```

Commit-ul include fișierul nou din `drizzle/`. La deploy, aplicația aplică migrațiile la prima cerere (sau rulezi manual `pnpm db:migrate` cu `DATABASE_URL` de producție dacă ai `AUTO_MIGRATE=false`).

---

## 4. Cum e organizat codul

```
src/
  app/                 rute Next.js (UI în română), route handlers, server actions subțiri
  components/          UI (componente în stil shadcn scrise de mână peste Radix)
  editor/              Konva: randare documente, editor, preview, export
  lib/                 logică pură: template-uri, derivare formate, încadrare text, culori, diacritice
  server/
    db/                schema Drizzle, conexiune (PGlite / Postgres), seed
    providers/         llm (anthropic, mock), image (openai, gemini, mock), storage (local, supabase)
    services/          brain, context (buildContext), generation, qa, costs, editor
    prompts/           prompturi versionate (PROMPT_VERSION)
tests/                 Vitest
```

Fluxul unei generări: brief → `buildContext()` (reguli agenție → format → stil → client → reguli fixe → reguli în probă → exemple → brief → prioritate) → un apel Claude pentru copy + direcție vizuală → imagini în paralel (max 4) → `resolveDocument()` pe fiecare format → preview randat în browser → QA automat. Snapshot-ul contextului se vede în „De ce a făcut asta?”.
