# PROGRESS.md

_Ultima actualizare: 2026-11-26_

## Stare milestone-uri

| Milestone | Stare |
|---|---|
| M0: Fundația | ✅ gata |
| M1: Clienți, brand kit, proiecte | ⏳ urmează |
| M2: Bibliotecă | — |
| M3: Generare cap-coadă (mock) | — |
| M4: Editor + export | — |
| M5: Feedback + brain | — |
| M6: Provideri reali + costuri | — |
| M7: QA + finisare | — |

## Ce e gata

### M0
- Next.js 16 + TS strict + Tailwind 4 + componente UI (Button, Input, Textarea, Select, Dialog, Tabs, Card, Badge, Toast, DropdownMenu, Tooltip).
- Drizzle + PGlite (`.data/pglite`), Postgres prin `DATABASE_URL`. Migrații în `drizzle/`, aplicate automat; seed automat la prima pornire.
- Auth: parolă de echipă + alegerea utilizatorului; fără `TEAM_PASSWORD`, login automat ca Onisim.
- Layout cu sidebar (Dashboard, clienți, Client nou, Bibliotecă, Setări) și header cu utilizatorul.
- Seed: 3 utilizatori, 2 clienți demo, 5 formate, 6 template-uri + stiluri, 2 reguli de agenție.
- Storage local + `/api/files/...`.

## Cum pornești

```
pnpm install
pnpm dev
```
Apoi deschizi http://localhost:3000. Nu trebuie niciun `.env`.

## Ce urmează
- M1: CRUD clienți, brand kit (upload logo/poze/fonturi, culori), proiecte, referințe.

## Blocat
- Nimic.

## Ce trebuie să facă Onisim
- (opțional) Repo-ul GitHub e **public**. Dacă vrei să fie privat: GitHub → Settings → Danger zone → Change visibility.

## Idei pentru mai târziu
- (gol)
