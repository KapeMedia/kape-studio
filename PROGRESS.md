# PROGRESS.md

_Ultima actualizare: 2026-11-26_

## Stare milestone-uri

| Milestone | Stare |
|---|---|
| M0: Fundația | ✅ gata |
| M1: Clienți, brand kit, proiecte | ✅ gata |
| M2: Bibliotecă | ✅ gata |
| M3: Generare cap-coadă (mock) | ✅ gata |
| M4: Editor + export | ✅ gata |
| M5: Feedback + brain | ⏳ în lucru (cod scris, de verificat) |
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

### M1
- CRUD clienți (creare, editare, arhivare), tab-uri Prezentare / Brand kit / Brain / Proiecte / Istoric.
- Brand kit: logo + logo pentru fundal închis (preview pe deschis/închis), culori cu rol (color picker + hex), fonturi (.ttf/.otf/.woff2) cu preview românesc și avertisment dacă lipsesc glifele ș/ț, poze proprii.
- Proiecte (creare, arhivare/restaurare) și referințe de inspirație pe proiect.
- Verificat în browser: client nou → logo, 2 culori, font, 3 poze → proiect.

### M2
- Bibliotecă: Stiluri (preview feed + story cu brandul clientului ales), editare stil cu versiuni noi la salvare și „Publică versiunea”, imagini de referință pe stil, arhivare.
- Template-uri: editor JSON validat cu Zod + preview live Konva pe orice format (cu safe zone), duplicare, template nou.
- Formate editabile (dimensiuni, safe zone, avoidRects, note, activ).
- Funcții pure testate: `fitText` (încadrare text), `getLayout` (derivare 1:1 / story / landscape / cover), `resolveDocument`.
- Renderer Konva (`src/editor/document-canvas.tsx`) cu fonturi încărcate prin FontFace, refit cu fontul real, overlay safe zone, suport de editare (selecție, drag, resize).

### M3
- Interfețe `LLMProvider` / `ImageProvider` + provideri mock (deterministe) + provideri reali (Anthropic, OpenAI, Gemini), selectați automat după chei.
- Brief complet (mesaj, CTA, note, formate, stil sau „Alege tu”, nr. variante, referințe din brand kit/proiect, provider imagine), „Propune unghiuri” cu editare inline.
- `buildContext` (ordinea din SPEC 10.3, scope pe format/stil, uses/lastUsedAt/event `used`), snapshot salvat pe generare și panoul „De ce a făcut asta?”.
- Pipeline în fundal (`after()`): 1 apel copy → imagini în paralel (max 4) → compoziție pe toate formatele bifate; eșecul unei variante nu le oprește pe celelalte.
- Preview PNG randat în browser cu Konva și urcat pe server; QA determinist rulează la upload.
- Grid de review cu polling: Aprobă / Respinge (cu motiv) / Regenerează imaginea / Duplică / Deschide în editor; aprobat/respins → referințe folosite ca exemple în context.
- `llm_calls` populat pentru fiecare apel (cost 0 pe mock).

### M4
- Pagina variantei: canvas Konva cu selecție, mutare, redimensionare (Transformer), dublu-click pentru editare text, panou de proprietăți (text, font din brand kit, grosime, mărime/încadrare automată, aliniere, majuscule, culori din paletă + hex liber, fundal buton, overlay/formă, variantă logo, imagine: upload / din brand kit / regenerează păstrând editările).
- Undo/redo (50 de pași, Ctrl+Z / Ctrl+Y), toggle safe zone, lista de layere cu marcaj „nu încape”.
- Comutare formate: formatele lipsă se derivă și preiau editările de text/culoare, apoi se editează separat.
- Salvare cu `documentVersion` incrementat + preview nou + QA refăcut.
- Export: PNG la rezoluție completă pe formatele bifate, ZIP `client_proiect_stil_format_v{index}.png` (verificat: 3 PNG-uri 1080×1350 / 1080×1920 / 1080×1080).
- Derivarea 1:1 și cover respectă acum safe zone-ul (test pe toate stilurile × toate formatele).

## Cum pornești

```
pnpm install
pnpm dev
```
Apoi deschizi http://localhost:3000. Nu trebuie niciun `.env`.

## Ce urmează
- M5: verificare feedback → reguli în browser, teste pentru promovare/arhivare.

## Blocat
- Nimic.

## Ce trebuie să facă Onisim
- (opțional) Repo-ul GitHub e **public**. Dacă vrei să fie privat: GitHub → Settings → Danger zone → Change visibility.

## Idei pentru mai târziu
- (gol)
