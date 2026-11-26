# PROGRESS.md

_Ultima actualizare: 2026-11-26 (M0–M7 gata)_

## Stare milestone-uri

| Milestone | Stare |
|---|---|
| M0: Fundația | ✅ gata |
| M1: Clienți, brand kit, proiecte | ✅ gata |
| M2: Bibliotecă | ✅ gata |
| M3: Generare cap-coadă (mock) | ✅ gata |
| M4: Editor + export | ✅ gata |
| M5: Feedback + brain | ✅ gata |
| M6: Provideri reali + costuri | ✅ gata (testat cu HTTP mock-uit; netestat cu chei reale) |
| M7: QA + finisare | ✅ gata |

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

### M5
- Feedback pe variantă (editor) → interpretare (Claude sau mock determinist: propozițiile cu „nu”, „evită”, „mereu”, „niciodată” devin reguli, restul one-off) → rezumat „Am înțeles…” + chip-uri de reguli cu Confirmă / Editează / Șterge.
- Reguli `trial` cu sursă (feedback, variantă, autor, citat, dată); aceeași idee din nou → `confirmations++` (fără duplicat); promovare la Confirmă sau la 2 confirmări; maxim 15 în probă; arhivare automată după 30 de zile nefolosite; Șterge = arhivare, cu Restaurează.
- „Fă-o regulă de agenție” (sugestie, nu automat), „Aplică la banner” pentru one-off (regenerează imaginea cu instrucțiunea, păstrând editările).
- Tab Brain: Reguli fixe / în probă / Fapte-preferințe / Arhivate, editare inline, scope pe format, pin, istoric evenimente, link spre varianta-sursă, „Adaugă regulă”. Bibliotecă → Reguli agenție.
- Verificat: feedback → regulă în probă → Confirmă → la generarea următoare apare în snapshot („De ce a făcut asta?”).

### M6
- Provideri reali: Anthropic (`@anthropic-ai/sdk`, output structurat validat cu Zod + retry), OpenAI `gpt-image-2` (generate; edits când există imagini de referință), Gemini `gemini-3-pro-image-preview` (`@google/genai`, aspect ratio mapat, referințe ca `inlineData`). Retry cu backoff la 429/5xx, timeout, mesaje de eroare în română.
- Tabel de prețuri editabil (`src/server/services/costs/prices.ts`): gpt-image-2  /  / 0 per 1M; Claude Sonnet 5.5  / 0; Gemini = 0 cu TODO vizibil în Setări.
- Cost pe fiecare `llm_calls`, însumat pe generare (afișat în grid) și în Setări (total pe lună, pe client, pe provider).
- Setări: status pe provider (activ / mock / eroare la ultimul apel), provider implicit de imagine, „Test conexiune”, utilizatori, clienți arhivați.
- Teste cu `fetch` mock-uit pentru toți trei providerii (fără apeluri reale).

### M7
- QA complet: `safe_zone` (inclusiv zone acoperite, ex. poza de profil pe cover), `text_overflow`, `min_font`, `contrast` (eșantionat din preview), `logo_present`, `diacritics` (corectare automată ş/ţ → ș/ț); QA vision cu Claude când există cheie, mock altfel. Badge-uri ok / avertisment / eroare pe carduri și panou QA în editor.
- Verificat în UI: headline mutat în afara safe zone-ului pe story → badge „1 eroare”.
- Istoric client (toate generările, filtre după status și proiect, cost), Dashboard (clienți cu cost și generări pe lună, ultimele generări, cost luna curentă).
- README: setup local, variabile de mediu, deploy Vercel + Postgres (Supabase/Neon) + Supabase Storage, migrații în producție.

**Total teste: 63 (10 fișiere), toate verzi. typecheck, lint, build: verzi.**

## Cum pornești

```
pnpm install
pnpm dev
```
Apoi deschizi http://localhost:3000. Nu trebuie niciun `.env`.

## Ce urmează
- Toate milestone-urile M0–M7 sunt gata. Următorul pas e „Polish” (SPEC §12): stări goale, skeleton loaders, scurtături în editor, editor vizual de template, duplicare proiect, căutare globală (Cmd+K).
- Prima generare cu chei reale (Claude + OpenAI/Gemini) trebuie urmărită: integrarea e testată doar cu răspunsuri HTTP simulate.

## Blocat
- Nimic.

## Ce trebuie să facă Onisim
- Ca să folosești AI real, pune cheile în `.env.local` (vezi `.env.example`): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` și/sau `GEMINI_API_KEY`. Apoi în Setări apasă „Test conexiune” la fiecare. Integrarea reală a fost testată doar cu răspunsuri simulate: prima generare cu chei reale merită urmărită.
- Verifică prețul Gemini și completează-l în `src/server/services/costs/prices.ts` (acum e 0, marcat TODO).
- (opțional) Repo-ul GitHub e **public**. Dacă vrei să fie privat: GitHub → Settings → Danger zone → Change visibility.

## Idei pentru mai târziu
- Coadă de joburi (Inngest / QStash) pentru generări lungi pe Vercel Hobby (limita de 60 s).
- „Aplică la banner” care rescrie și textul unei singure variante cu Claude (acum regenerează doar imaginea).
- Driver de storage Vercel Blob (acum doar local și Supabase).
- Retry automat al preview-urilor care nu s-au putut urca.
- Aprobarea să se reseteze automat când varianta e editată după aprobare.
