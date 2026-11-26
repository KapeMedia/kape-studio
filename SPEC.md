# KAPE Studio: specificație v1

> Documentul ăsta e sursa de adevăr pentru ce construiești. Când ceva nu e acoperit aici, alege varianta cea mai simplă și scrie decizia în `DECISIONS.md`.

---

## 1. Problema

KAPE Media e o agenție mică de marketing digital din România (2 fondatori + editor), cu aproximativ 10 clienți locali: saloane de înfrumusețare (tratamente faciale, remodelare corporală, epilare definitivă), restaurante și burgerii, un hotel, o firmă de tâmplărie PVC și alții. Pentru clienți facem reclame Meta (Facebook + Instagram) și social media organic.

**Durerea:** bannerele statice (creative pentru ads, story-uri, cover-uri de Facebook, postări) se fac acum manual, în Canva sau în tool-uri AI generice (Higgsfield). Asta înseamnă că:

- durează mult;
- brandul (culori, fonturi, logo) se aplică de mână, de fiecare dată, și apar inconsecvențe;
- feedback-ul se pierde: dacă azi spunem „la clientul X nu folosim roz neon”, săptămâna viitoare AI-ul face iar roz neon;
- tool-urile generice nu știu nimic despre clienții noștri și nu învață nimic de la o folosire la alta;
- textul în română generat de AI iese des cu diacritice greșite.

**Ce vrem:** un workspace al agenției, cu câte un spațiu pentru fiecare client (brand kit + memorie). Din spațiul clientului generezi bannere on-brand din câteva rânduri de brief, le ajustezi într-un editor simplu, dai feedback, iar aplicația ține minte feedback-ul și îl aplică data viitoare.

**Ținta v1:** de la brief la banner aprobat, exportat în toate formatele bifate, într-o singură sesiune, pentru orice client.

---

## 2. Atlas: conceptul pe care îl copiem (structura, nu codul)

Atlas e un tool AI pentru conținut video short-form, folosit de agenție. Am analizat cum e construit. Valoarea lui nu stă în modelul AI (folosește modele ale altora). Stă în **felul în care organizează contextul și îl injectează în prompt la momentul potrivit**. Acesta e conceptul pe care trebuie să-l înțelegi și să-l reproduci pentru imagini statice.

Piesele Atlas și echivalentul lor la noi:

| Atlas | Ce face acolo | Echivalent în KAPE Studio |
|---|---|---|
| **Workspaces** | Un workspace pentru fiecare brand al unei agenții, cu switch între ele | Un space per client, cu switcher în sidebar |
| **Brand profile** | Culori, ofertă, public ideal, voce, plus un câmp separat de „corrections” (corecturi primite) | Brand kit vizual + direcție + reguli învățate |
| **Brain** | Colecție de note (markdown) legate între ele. Fiecare notă are `kind` (memory, doc, brand, skill, native), `status`, `confirmed`, `pinned`, `uses`, `lastUsedAt`, `history` | `brain_entries` per client (și globale pentru agenție), cu aceleași metadate |
| **Memorii pe 2 niveluri** | „short-term” (maxim 7) și „kept” (păstrate după confirmare) | Reguli `trial` (în probă) și `active` (fixe) |
| **Edit rules** | Reguli permanente pe care fiecare editare le respectă automat | Regulile `active` ale clientului intră în fiecare generare |
| **Reguli cu sursă** | Fiecare regulă e notată cu cine a zis-o, când și citatul exact („Yanis, 2026-10-25: «if I give feedback, it should just carry on»”) | Fiecare regulă păstrează link spre feedback-ul, varianta și autorul din care a venit |
| **Skills cu „use when”** | Instrucțiuni lungi încărcate DOAR când sarcina o cere (scrii hook-uri → se încarcă skill-ul de hooks) | Instrucțiuni per format (story, cover, feed) și per stil, încărcate doar pentru formatul și stilul ales |
| **Stiluri versionate** | „Style bank”: fiecare stil are id, versiune live și un prompt complet de direcție. Unele sunt „măsurate” din 20 de reels de referință | `styles` + `style_versions`: fiecare stil are template, prompt vizual, imagini de referință și o versiune; fiecare generare ține minte versiunea folosită |
| **Ierarhie de reguli** | Raw cut → Short form → Format → Style; „cuvintele omului bat tot” | Reguli agenție → format → stil → client → cererea utilizatorului (cererea câștigă) |
| **Brief asamblat** | La fiecare cerere strânge brand + metodă + pagini + audit de performanță | `buildContext()`: snapshot salvat pe fiecare generare |
| **Gate-uri de calitate** | Orice draft trece printr-un check automat (anti-slop) înainte să fie arătat | QA automat pe fiecare variantă înainte de review |
| **Pipeline** | Carduri pe coloane: idea → script → record → edit → draft → posted | Status pe variantă: draft → în review → aprobat → livrat |

**Ideea centrală:** „antrenarea” nu e fine-tuning. E memorie structurată + reguli + rețete (stiluri), compuse inteligent în prompt la fiecare generare. Modelul nu ține minte nimic. Consecvența vine din context.

---

## 3. Fluxul tipic (user story)

Onisim deschide KAPE Studio → alege clientul „Epil Point” din sidebar → intră în proiectul „Black Friday 2026” → scrie în brief: „Reducere 40% la epilare definitivă zona inghinală, doar până pe 30 noiembrie, CTA programează-te” → bifează formatele Feed 4:5 și Story 9:16 → alege stilul „Ofertă clară” (sau „Alege tu”) → apasă Generează.

Aplicația propune întâi 3-5 unghiuri (ofertă, durere, rezultat, social proof, urgență), fiecare cu headline, subheadline și CTA. Onisim bifează 2 unghiuri și cere 4 variante. În ~1-2 minute apar 4 bannere în grid. Fiecare are vizual generat de AI, iar textul, logo-ul și fonturile sunt puse de aplicație din brand kit.

Onisim deschide varianta 2 în editor, mărește headline-ul, schimbă culoarea CTA-ului din paleta brandului și scrie un comentariu: „Textul e prea mic pe story și nu mai folosi poze cu femei în costum de baie la clientul ăsta.” Aplicația răspunde: „Am înțeles 2 lucruri: (1) pe story, headline-ul trebuie să fie mai mare: regulă nouă în probă; (2) fără poze în costum de baie: regulă nouă în probă.” Onisim confirmă a doua ca regulă fixă. Aprobă varianta 2 și o exportă în ambele formate (zip). Data viitoare, la orice generare pentru Epil Point, cele două reguli intră automat în prompt.

---

## 4. Glosar

- **Workspace**: agenția KAPE. Unul singur în v1.
- **Client**: un client al agenției. Are brand kit, brain, proiecte.
- **Brand kit**: logo-uri, culori, fonturi, poze proprii, ton, ce să facem și ce să evităm.
- **Proiect**: un grup de lucru în cadrul unui client (o campanie, o lună). Are brief-uri, referințe și generări.
- **Stil**: o rețetă vizuală reutilizabilă: template de layout + direcție vizuală (prompt) + imagini de referință + ghid de copy. Stilurile sunt ale agenției (bibliotecă comună), cu opțiune de override per client în v1.1.
- **Template**: structura de layout (JSON) a unui stil: unde stă imaginea, headline-ul, CTA-ul, logo-ul, pentru fiecare format.
- **Format**: dimensiune + safe zone (Feed 4:5, Story 9:16 etc.).
- **Generare**: o rulare = un brief → N variante.
- **Variantă**: un banner concret (document JSON de layere + imagine de fundal + PNG randat).
- **Brain entry**: o unitate de memorie (regulă, fapt, preferință, notă de referință), la nivel de client sau de agenție.
- **Context snapshot**: tot ce s-a trimis modelelor la o generare, salvat pentru debug („de ce a făcut asta?”).

---

## 5. Stack și arhitectură

| Strat | Alegere | Note |
|---|---|---|
| Framework | Next.js (ultima versiune stabilă, App Router) + TypeScript strict | `pnpm` |
| UI | Tailwind CSS + componente în stil shadcn/ui (Radix) | Dacă CLI-ul shadcn nu are rețea, scrie componentele de mână |
| Fonturi UI | Inter sau Geist din pachete npm (`@fontsource/inter` sau `geist`) | NU `next/font/google`: la build cere rețea |
| ORM | Drizzle ORM + drizzle-kit | |
| DB dev | PGlite (`@electric-sql/pglite`, `drizzle-orm/pglite`), persistat în `./.data/pglite` | Rulează fără niciun cont |
| DB prod | Postgres prin `DATABASE_URL` (Supabase sau Neon), `postgres-js` | Același schema/migrații |
| Storage | Adapter: local (`./.data/uploads`, servit printr-un route handler) în dev; Supabase Storage sau Vercel Blob în prod prin env | Interfața `StorageProvider` |
| Auth | Simplă, internă: parolă de echipă (`TEAM_PASSWORD`) + alegi utilizatorul (Onisim / Andrei / Editor), cookie semnat (`jose`) | Fără conturi externe. În dev, dacă lipsește `TEAM_PASSWORD`, login automat |
| Editor + randare | Konva (`react-konva`), randare în browser (`stage.toDataURL({ pixelRatio })`) | Gratuit, fără licență. Fonturile brandului se încarcă prin `FontFace` înainte de randare |
| Export | Randare în browser pentru fiecare format + `jszip` | |
| LLM | Anthropic SDK (Claude) | Model în `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`. Verifică în SDK/documentație id-ul curent |
| Imagine | OpenAI `gpt-image-2` (Images API: generate + edits cu imagini de referință) și Google Gemini `gemini-3-pro-image-preview` („Nano Banana Pro”) | Id-urile în env. Verifică parametrii în SDK |
| Mock | `MockLLMProvider` + `MockImageProvider` | Automat când lipsește cheia. Ieșiri deterministe |
| Teste | Vitest | Playwright e opțional (browserele s-ar putea să nu se descarce) |
| Deploy | Vercel | Mai târziu. Doar documentezi pașii în README |

### Structura de foldere (orientativ)

```
src/
  app/                      # rute Next.js (UI în română)
  components/               # UI reutilizabil
  editor/                   # Konva: randare template/document, editor, export
  server/
    db/                     # schema Drizzle, client, seed
    providers/
      llm/                  # anthropic.ts, mock.ts, types.ts
      image/                # openai.ts, gemini.ts, mock.ts, types.ts
      storage/              # local.ts, supabase.ts (stub), types.ts
    services/
      brain/                # entries, feedback → reguli, promovare
      context/              # buildContext()
      generation/           # pipeline
      qa/                   # verificări deterministe + vision
      costs/                # tabel de prețuri, calcul
    prompts/                # prompturi versionate, ca fișiere TS
  lib/                      # utilitare (diacritice, culori, contrast, text-fit)
```

### Variabile de mediu (`.env.example`)

```
# Gol = mod mock / local
DATABASE_URL=
STORAGE_DRIVER=local            # local | supabase | vercel-blob
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=kape-studio
TEAM_PASSWORD=
AUTH_SECRET=                    # pentru cookie-ul semnat; în dev se generează unul și se loghează un warning
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
DEFAULT_IMAGE_PROVIDER=openai   # openai | gemini | mock
```

Pagina **Setări** arată, pentru fiecare provider: activ / mock (lipsă cheie) / eroare la ultimul apel.

---

## 6. Modelul de date

Toate tabelele au `id` (uuid), `createdAt`, `updatedAt`. Ajustează unde e nevoie și notează în DECISIONS.md.

- **users**: `name`, `role` (`owner` | `editor`). Seed: Onisim, Andrei, Editor.
- **clients**: `name`, `slug`, `industry` (beauty | food | hospitality | other), `description`, `audience`, `tone`, `dos` (text), `donts` (text), `activeOffers` (text), `colors` (json: `[{ name, hex, role: primary|secondary|accent|background|text }]`), `archivedAt`.
- **brand_assets**: `clientId`, `type` (`logo` | `logo_light` | `photo` | `font` | `other`), `name`, `storageKey`, `mimeType`, `width`, `height`, `meta` (json; pentru fonturi: `family`, `weight`, `style`, `role: heading|body`).
- **projects**: `clientId`, `name`, `description`, `status` (`active` | `archived`).
- **references**: `clientId`, `projectId?`, `storageKey`, `note`, `kind` (`inspiration` | `approved_example` | `rejected_example`), `sourceVariantId?`.
- **formats**: `key` (`feed_4x5`, `feed_1x1`, `story_9x16`, `landscape_191`, `fb_cover`), `label`, `width`, `height`, `safeZone` (json: `{ top, right, bottom, left }` în px, plus `avoidRects` opțional), `notes`, `enabled`. Seed din secțiunea 8. Editabile în UI.
- **templates**: `name`, `description`, `definition` (json, schema din secțiunea 9).
- **styles**: `name`, `slug`, `description`, `whenToUse`, `currentVersionId`, `archivedAt`.
- **style_versions**: `styleId`, `version` (int), `templateId`, `visualPrompt` (text), `avoid` (text), `copyGuidance` (text: lungime headline, ton), `referenceAssetKeys` (json array), `textMode` (`overlay` | `full_ai`), `changelog`.
- **generations**: `clientId`, `projectId`, `createdBy`, `brief` (json: mesaj, ofertă, CTA, note, formate, stil, nr. variante, unghiuri alese), `status` (`queued` | `running` | `done` | `failed`), `error`, `contextSnapshot` (json), `llmProvider`, `imageProvider`, `costUsd` (numeric), `usage` (json).
- **variants**: `generationId`, `clientId`, `index`, `angle`, `copy` (json: headline, subheadline, cta, extra), `styleVersionId`, `masterFormatKey`, `document` (json: documentul editabil), `backgroundAssetKey`, `previewKey` (PNG randat), `status` (`draft` | `in_review` | `approved` | `rejected` | `delivered`), `qa` (json: rezultate), `rationale`.
- **feedback**: `variantId`, `clientId`, `authorId`, `text`, `interpretation` (json: ce a înțeles LLM-ul), `createdBrainEntryIds` (json).
- **brain_entries**: `clientId?` (null = regulă de agenție), `kind` (`rule` | `fact` | `preference`), `text`, `status` (`trial` | `active` | `archived`), `scope` (json: `{ formats?: string[], styles?: string[] }`, gol = peste tot), `confirmations` (int), `uses` (int), `lastUsedAt`, `pinned` (bool), `source` (json: `{ feedbackId?, variantId?, authorId, quote, date }`), `createdBy` (`user` | `ai`).
- **brain_entry_events**: `entryId`, `type` (`created` | `confirmed` | `promoted` | `edited` | `archived` | `used`), `data` (json), `actorId?`. Asta e istoricul (ca `history` din Atlas).
- **llm_calls**: `generationId?`, `purpose` (`angles` | `copy` | `feedback_interpret` | `qa_vision` | `image`), `provider`, `model`, `inputTokens`, `outputTokens`, `imageCount`, `costUsd`, `durationMs`, `ok`, `error`. Pentru costuri și debug.

---

## 7. Brand kit

Pagina clientului → tab **Brand kit**:

- Logo principal (PNG transparent / SVG) + logo pentru fundal închis (opțional). Preview pe fundal deschis și închis.
- Culori: listă cu nume, hex și rol (primary, secondary, accent, background, text). Color picker + input hex.
- Fonturi: upload `.ttf` / `.otf` / `.woff2`; setezi familia și rolul (heading / body). Preview cu text românesc: „Șapte țânțari sâcâitori în grădină: ĂÂÎȘȚ ăâîșț”. Dacă nu se încarcă niciun font, fallback pe Inter.
- Poze proprii: grid de upload (salon, produse, echipă, mâncare). Se folosesc ca imagini de referință pentru modelul de imagine și ca fundal direct.
- Text: descriere, public, ton, ce facem (do), ce evităm (don't), oferte active.

Toate câmpurile sunt opționale. Un client fără brand kit complet poate genera în continuare, cu fallback-uri.

---

## 8. Formate (seed)

| key | label | width × height | Safe zone / note |
|---|---|---|---|
| `feed_4x5` | Feed 4:5 (master) | 1080 × 1350 | Padding vizual 64 px. Meta recomandă 4:5 pentru imagini single în Feed |
| `feed_1x1` | Feed 1:1 / carusel | 1080 × 1080 | Padding 64 px. Cardurile de carusel sunt tăiate la 1:1 |
| `story_9x16` | Story 9:16 | 1080 × 1920 | Safe zone unificată Stories/Reels: sus 250 px liber (~14%), jos 340 px liber (~18%), lateral 64 px |
| `landscape_191` | Landscape 1.91:1 | 1200 × 628 | Padding 48 px |
| `fb_cover` | Cover Facebook | 1640 × 624 (afișat ~820 × 312) | Text și logo doar în zona centrală (~78% din lățime). Colțul stânga-jos e acoperit de poza de profil: `avoidRects`. Notă: specificațiile Meta pentru cover se schimbă; trebuie să rămână editabile |

Valorile se pot edita din **Bibliotecă → Formate**. Editorul desenează safe zone-ul ca overlay (on/off).

---

## 9. Template-uri și stiluri

### 9.1 Schema unui template (`templates.definition`)

Un template descrie layout-ul pentru **fiecare format**, în coordonate relative (0–1) față de canvas, ca un singur template să meargă pe toate formatele.

```ts
type TemplateDefinition = {
  layouts: Record<FormatKey, Layout>; // cel puțin feed_4x5; celelalte se derivă dacă lipsesc (vezi 9.3)
};
type Layout = { layers: Layer[] };
type Box = { x: number; y: number; w: number; h: number }; // relativ 0–1
type Layer =
  | { id: string; type: 'image'; role: 'background' | 'photo'; box: Box; fit: 'cover' | 'contain'; radius?: number }
  | { id: string; type: 'overlay'; box: Box; fill: ColorRef; opacity: number; gradient?: 'top' | 'bottom' | 'none' }
  | { id: string; type: 'text'; role: 'headline' | 'subheadline' | 'cta' | 'body' | 'price' | 'badge';
      box: Box; font: 'heading' | 'body'; weight?: number; maxSize: number; minSize: number; // px la rezoluția formatului
      align: 'left' | 'center' | 'right'; color: ColorRef; uppercase?: boolean; lineHeight?: number;
      background?: { fill: ColorRef; paddingX: number; paddingY: number; radius: number } } // pentru butoane/badge-uri
  | { id: string; type: 'logo'; box: Box; variant: 'auto' | 'default' | 'light' }
  | { id: string; type: 'shape'; shape: 'rect' | 'circle' | 'line'; box: Box; fill: ColorRef; radius?: number };
type ColorRef = { brand: 'primary' | 'secondary' | 'accent' | 'background' | 'text' } | { hex: string };
```

**Documentul unei variante** (`variants.document`) = layout-ul template-ului „rezolvat” pentru un format concret: coordonate absolute, text completat, culori hex rezolvate, chei de asset. Editorul lucrează pe document, nu pe template. Documentul păstrează `templateId` și `formatKey`, iar varianta ține un document per format (`documents: Record<FormatKey, Doc>`) după ce se cere export pe mai multe formate.

### 9.2 Încadrarea textului

- Textul se micșorează automat de la `maxSize` la `minSize` până încape în box (măsurare cu fontul real încărcat; în teste, cu un measurer injectabil).
- Dacă nici la `minSize` nu încape: se marchează în QA (`text_overflow`) și se trunchiază vizual cu „…” doar în preview, nu în date.
- Line break automat pe cuvinte. Fără cratimare.

### 9.3 Derivarea formatelor

Dacă un template nu are layout pentru un format:

- `feed_1x1` din `feed_4x5`: aceleași box-uri, comprimate vertical, cu min/max pe text.
- `story_9x16`: conținutul din 4:5 centrat vertical în zona sigură, imaginea extinsă pe tot canvasul.
- `landscape_191` și `fb_cover`: imaginea pe tot canvasul, textul în jumătatea stângă (sau centrul, pentru cover), logo sus.

Scrie derivarea ca funcție pură testată. Template-urile seed au layout explicit pentru `feed_4x5` și `story_9x16`.

### 9.4 Stiluri seed (5–6)

Creează aceste stiluri cu câte un template și o versiune 1. Promptul vizual descrie DOAR imaginea; textul îl pune template-ul.

1. **Ofertă clară**: poză mare sus (60%), bandă de culoare primară jos cu headline mare, preț/discount ca badge, CTA ca buton. Pentru reduceri.
2. **Foto full + gradient**: poză pe tot ecranul, gradient închis jos, headline alb + CTA. Universal.
3. **Minimal premium**: fundal de culoare (background/secondary), un singur obiect sau o scenă mică în centru, mult spațiu liber, tipografie elegantă. Pentru beauty / premium.
4. **Testimonial**: citat mare între ghilimele, nume, poză mică rotundă sau fundal discret. Social proof.
5. **Anunț / eveniment**: dată + titlu foarte mare, fundal grafic simplu în culorile brandului.
6. **Produs pe fundal colorat** (food): produsul centrat pe culoare plină, headline sus, CTA jos.

`textMode: overlay` la toate. `full_ai` există ca opțiune pe stil (secțiunea 10.6), dar niciun stil seed nu îl folosește.

### 9.5 Bibliotecă → Stiluri (UI)

- Listă de stiluri cu un preview (randat cu un mock de fundal și text demo).
- Edit stil = formular (descriere, când se folosește, prompt vizual, ce să evite, ghid de copy, template, imagini de referință). Salvarea creează o **versiune nouă**; versiunea curentă se schimbă doar la „Publică versiunea”.
- Editorul de template în v1 poate fi un editor JSON cu preview live. Un editor vizual de template e „Polish”.

---

## 10. Pipeline-ul de generare

Pașii (fiecare apel LLM sau de imagine se loghează în `llm_calls`):

### 10.1 Brief

Panoul din stânga al paginii de proiect:

- Mesaj / ofertă (textarea, obligatoriu)
- CTA (opțional; dacă lipsește, îl propune Claude)
- Note (ce să evite de data asta, detalii)
- Formate (checkbox-uri; default `feed_4x5`)
- Stil (dropdown cu stilurile + „Alege tu”)
- Număr de variante (default 4, maxim 8)
- Imagini de referință pentru generarea asta (upload sau din brand kit)
- Provider imagine (default din setări)
- Buton „Propune unghiuri” (opțional) și buton „Generează”

### 10.2 Unghiuri (ideation)

`POST /api/generations/angles` → Claude primește contextul (10.3) + brief-ul și întoarce 3–5 unghiuri, JSON validat cu Zod:

```ts
{ angles: { id: string; type: 'oferta' | 'durere' | 'rezultat' | 'social_proof' | 'urgenta' | 'altul';
            headline: string; subheadline?: string; cta: string; why: string }[] }
```

Utilizatorul bifează unghiuri, poate edita textele inline, apoi generează. Dacă sare peste pasul ăsta, la generare Claude alege unghiuri diferite pentru fiecare variantă.

### 10.3 Context builder (`buildContext`)

Funcție pură (+ citiri din DB) care întoarce un obiect structurat și un string de prompt. **Ordinea și prioritatea contează**:

1. Rolul: „Ești directorul de creație al agenției KAPE Media…”
2. Reguli de agenție `active` (brain entries cu `clientId = null`)
3. Instrucțiuni de format (safe zone, ce înseamnă story vs. feed vs. cover), DOAR pentru formatele cerute
4. Stilul: descriere, ghid de copy, prompt vizual, ce să evite (versiunea curentă)
5. Clientul: descriere, industrie, public, ton, do / don't, oferte active, numele culorilor
6. Reguli `active` ale clientului (filtrate după scope: format/stil), fiecare cu data și citatul-sursă scurt
7. Reguli `trial` ale clientului, marcate „în probă”
8. Exemple: 3–5 variante aprobate recent (copy + descrierea vizualului; preferabil același stil/format) și 1–3 respinse, cu motivul
9. Brief-ul utilizatorului
10. Regula de prioritate scrisă explicit: „Dacă brief-ul contrazice o regulă, urmează brief-ul. Dacă o regulă a clientului contrazice stilul, urmează regula clientului.”

Snapshot-ul (obiectul + string-ul final + id-urile entry-urilor folosite) se salvează pe `generations.contextSnapshot`. La fiecare entry folosit: `uses++`, `lastUsedAt`, plus event `used`.

UI: pe fiecare generare există un panou „De ce a făcut asta?”, care arată snapshot-ul lizibil (reguli aplicate, stil, versiune, exemple).

### 10.4 Copy + direcție vizuală (Claude)

Un apel Claude per generare (nu per variantă) întoarce, pentru fiecare variantă:

```ts
{ variants: { index: number; angle: string; headline: string; subheadline?: string; cta: string;
              extra?: { price?: string; badge?: string };
              visualPrompt: string;      // în engleză, descrie DOAR imaginea; fără text, fără logo
              negativeSpace: 'top' | 'bottom' | 'left' | 'right' | 'center'; // unde lasă loc pentru text, după template
              useBrandPhotoKey?: string; // dacă e mai bine să folosim o poză reală din brand kit decât să generăm
              rationale: string }[] }
```

Cerințe pentru prompt:

- Copy în română, cu diacritice corecte, concis (headline ≤ 7 cuvinte, dacă ghidul stilului nu spune altfel).
- `visualPrompt` include stilul, paleta (hex-urile brandului ca mood), compoziția și explicit „no text, no letters, no logos, no watermarks”, plus zona liberă pentru text.
- Respectă regulile (do/don't, regulile brain).
- Folosește tool use / output structurat, cu validare Zod și un retry la JSON invalid.

### 10.5 Imaginea

Pentru fiecare variantă (în paralel, limită de concurență 4):

- Dacă `useBrandPhotoKey` e setat → fundalul e poza reală (fără apel de generare).
- Altfel, `ImageProvider.generate({ prompt, aspect, size, referenceImages, n: 1 })`. `referenceImages` = maxim 4 dintre: pozele de stil, pozele brandului relevante, referințele încărcate în brief.
- Mărimea: cere cea mai apropiată mărime suportată de provider pentru aspectul formatului master. Template-ul face `cover`, deci decuparea e ok.
- Imaginea se salvează în storage → `backgroundAssetKey`.
- Eroare la o variantă → varianta e marcată `failed` cu mesaj; celelalte continuă.

**Interfața providerului:**

```ts
interface ImageProvider {
  id: 'openai' | 'gemini' | 'mock';
  isConfigured(): boolean;
  generate(input: { prompt: string; aspect: '4:5' | '1:1' | '9:16' | '16:9' | '1.91:1';
                    referenceImages?: { data: Buffer; mimeType: string }[]; quality?: 'low' | 'medium' | 'high' }):
    Promise<{ image: Buffer; mimeType: string; usage?: { inputTokens?: number; outputTokens?: number }; raw?: unknown }>;
}
```

- **OpenAI**: `gpt-image-2` prin SDK-ul oficial. Cu referințe → endpoint-ul de edits, cu imaginile ca input. Calitatea default: `medium`.
- **Gemini**: `gemini-3-pro-image-preview` prin `@google/genai`, cu `responseModalities` imagine și `aspectRatio` (mapează la cel mai apropiat suportat). Referințele ca `inlineData`.
- **Mock**: generează local un PNG (gradient din culorile brandului + forme simple + textul „MOCK” mic într-un colț), cu `sharp` sau cu un SVG randat. Determinist pe seed. Durează 300–800 ms, ca să se vadă stările de loading.

### 10.6 Compoziția

- Pe server: se rezolvă documentul variantei din template + format + copy + culori + asset-uri (funcție pură `resolveDocument`).
- În browser: Konva randează documentul. După prima randare, clientul încarcă un preview PNG (`previewKey`), folosit în grid, în QA și în export.
- **Mod `full_ai`** (opțional pe stil): imaginea generată conține și textul (promptul include textul exact, între ghilimele). Documentul are doar imaginea + logo-ul real. QA-ul vision verifică textul (10.7).

### 10.7 QA automat

Rulează după ce preview-ul există. Rezultatul ajunge în `variants.qa` și apare ca badge-uri pe card (ok / avertisment / eroare).

**Verificări deterministe (cod):**

- `safe_zone`: niciun layer text/logo în afara safe zone-ului formatului (și nici în `avoidRects`).
- `text_overflow`: textul nu încape la `minSize`.
- `min_font`: text sub 28 px la 1080 de lățime (sub 40 px pe story) → avertisment.
- `contrast`: raportul de contrast WCAG între culoarea textului și culoarea medie a zonei din spate (din preview) sub 3:1 → avertisment.
- `logo_present`: clientul are logo, dar documentul n-are layer de logo → avertisment.
- `diacritics`: textul conține ş/ţ (sedilă, U+015F/U+0163) în loc de ș/ț (virgulă, U+0219/U+021B) → se corectează automat și se notează. Normalizarea se aplică oricum peste tot textul din aplicație.

**Verificare vision (Claude, doar când e configurat):** primește preview-ul + copy-ul așteptat + regulile clientului și întoarce JSON `{ issues: { severity, message }[] }`: text ilizibil, text greșit (în `full_ai`), încălcarea unei reguli din brain, before/after sau mesaje despre corp (avertisment de policy Meta pentru nișa beauty), artefacte AI evidente (mâini, fețe).

### 10.8 Review

- Grid cu variantele (preview, unghi, badge QA, status). Click → editor.
- Acțiuni pe card: Aprobă, Respinge (cu motiv opțional), Regenerează imaginea, Duplică, Deschide în editor.
- Aprobarea creează automat un `reference` `approved_example`; respingerea cu motiv, un `rejected_example`. Sunt folosite în pasul 8 al contextului.

---

## 11. Brain: feedback → reguli

### 11.1 Feedback

În editor și pe cardul variantei există un câmp de comentariu. La trimitere: `POST /api/feedback` → Claude primește comentariul + varianta (copy, stil, format) + regulile existente ale clientului și întoarce:

```ts
{ oneOff: { instruction: string } | null,   // ce trebuie schimbat DOAR la bannerul ăsta
  rules: { text: string;                     // regulă scurtă, la imperativ, reutilizabilă: „Pe story, headline-ul minim 90 px.”
           scope: { formats?: string[]; styles?: string[] };
           matchesExistingRuleId?: string;   // dacă e aceeași idee ca o regulă existentă
           isAgencyWide: boolean }[],        // dacă pare valabilă pentru toți clienții (doar sugestie, nu se aplică automat)
  summary: string }                          // „Am înțeles: …” în română
```

Comportament:

- Fiecare regulă nouă → `brain_entry` cu `status: trial`, `createdBy: ai`, `source` (feedbackId, variantId, autor, citatul exact, data).
- Dacă `matchesExistingRuleId` → nu dublezi regula: `confirmations++` pe cea existentă, plus event `confirmed`.
- **Promovare:** o regulă `trial` devine `active` când (a) utilizatorul apasă „Confirmă”, sau (b) `confirmations >= 2` (aceeași idee a apărut de 2 ori). Event `promoted`.
- `isAgencyWide` → în UI apare butonul „Fă-o regulă de agenție”. Nu se aplică automat.
- `oneOff` → apare butonul „Aplică la banner”: regenerează copy-ul și/sau imaginea variantei cu instrucțiunea (fără să creeze regulă).
- UI-ul arată imediat `summary` și chip-urile regulilor create, fiecare cu [Confirmă] [Editează] [Șterge].

### 11.2 Limite și întreținere

- Maximum 15 reguli `trial` per client. Peste limită, cea mai veche neconfirmată → `archived`.
- `trial` neconfirmate și nefolosite de 30 de zile → `archived` (job la pornire sau la deschiderea clientului; fără cron în v1).
- Nimic nu se șterge definitiv din UI în v1: „Șterge” = `archived`, cu opțiunea „Restaurează”.

### 11.3 Pagina Brain (tab în client) și Bibliotecă → Reguli agenție

- Secțiuni: Reguli fixe, Reguli în probă, Fapte/preferințe, Arhivate.
- Fiecare entry: textul (editabil inline), scope, sursa (link spre variantă, cu citatul și autorul), `uses`, `lastUsedAt`, pinned, istoricul (events).
- „Adaugă regulă” manual (`createdBy: user`, direct `active`).
- Pinned = mereu în context, primele din listă.

---

## 12. Milestone-uri (în ordinea asta)

Fiecare milestone: criteriile de acceptare îndeplinite + `typecheck`, `lint`, `test`, `build` verzi + commit + `PROGRESS.md` actualizat.

### M0: Fundația

- Next.js + TS strict + Tailwind + componente UI de bază (Button, Input, Textarea, Select, Dialog, Tabs, Card, Badge, Toast, DropdownMenu, Tooltip).
- Drizzle + PGlite în dev (+ `postgres-js` când există `DATABASE_URL`), migrații, `db:seed`.
- Auth simplu (secțiunea 5). Layout: sidebar (logo KAPE Studio, Dashboard, listă clienți + „Client nou”, Bibliotecă, Setări), header cu utilizatorul.
- Seed: 3 utilizatori, 2 clienți demo („Demo Beauty Salon”, industrie beauty; „Demo Smash Burgers”, industrie food) cu culori, formatele din 8, un proiect demo fiecare.
- Storage local + route handler pentru servirea fișierelor.
- **Acceptare:** `pnpm dev` pornește fără niciun `.env`; te loghezi, vezi clienții demo.

### M1: Clienți, brand kit, proiecte

- CRUD clienți (inclusiv arhivare), tab-urile clientului: Prezentare, Brand kit, Brain (gol deocamdată), Proiecte, Istoric.
- Brand kit complet (secțiunea 7): upload logo/poze/fonturi, culori, câmpuri text. Fonturile încărcate se văd în preview.
- CRUD proiecte; în pagina proiectului, referințe încărcate (inspirație).
- **Acceptare:** creezi un client de la zero, îi încarci logo, 2 culori, un font și 3 poze, apoi creezi un proiect.

### M2: Bibliotecă (formate, template-uri, stiluri)

- Pagini Bibliotecă: Formate (editabile), Template-uri (editor JSON + preview live Konva), Stiluri (secțiunea 9.5), cu versionare.
- Seed: template-urile și stilurile din 9.4.
- Renderer Konva pentru document + `resolveDocument` + derivarea formatelor (9.3) + încadrarea textului (9.2), cu teste.
- **Acceptare:** fiecare stil seed are un preview corect în feed 4:5 și story 9:16, cu culorile și fontul unui client demo selectat.

### M3: Generare cap-coadă (cu mock)

- Interfețe LLM / Image + providerii mock. Selectarea providerului după chei.
- Brief (10.1), unghiuri (10.2), `buildContext` (10.3) cu teste, copy + vizual (10.4), imagini (10.5), compoziție (10.6), grid de review (10.8). Status-uri și polling.
- Panoul „De ce a făcut asta?”.
- `llm_calls` populat (cost 0 pentru mock).
- **Acceptare:** pe un client demo, generezi 4 variante în mod mock, le vezi în grid cu text și culori de brand, aprobi una, respingi una.

### M4: Editor + export

- Pagina variantei: canvas Konva + panou cu proprietăți. Selectezi layer, editezi textul inline, muți/redimensionezi (Transformer), alegi culori din paleta brandului (și hex liber), alegi fontul brandului, schimbi imaginea (upload / din brand kit / regenerează), undo/redo (minim 20 de pași), toggle pentru safe zone, salvare (document versionat simplu: `documentVersion` incrementat).
- Comutare între formate: dacă formatul n-are document, se derivă (9.3), apoi se poate ajusta separat.
- Export: bifezi formatele → randare la rezoluție full → zip cu nume `client_proiect_stil_format_v{index}.png`. Și export individual PNG.
- **Acceptare:** editezi o variantă, o exporți în 4:5 + 9:16 + 1:1, iar zip-ul conține 3 PNG-uri corecte, cu fontul brandului și diacritice corecte.

### M5: Feedback + brain

- Secțiunea 11 completă: feedback → interpretare (mock determinist: de exemplu, propozițiile care conțin „nu”, „evită” sau „mereu” devin reguli; restul, one-off), reguli trial, confirmare, promovare la 2 confirmări, arhivare, pagina Brain, reguli de agenție în Bibliotecă.
- Regulile intră efectiv în context (test: o regulă `active` apare în snapshot la generarea următoare; una `archived`, nu).
- **Acceptare:** dai feedback pe o variantă → apare regula în probă → o confirmi → la următoarea generare se vede în „De ce a făcut asta?”.

### M6: Provideri reali + costuri

- Anthropic, OpenAI `gpt-image-2`, Gemini `gemini-3-pro-image-preview`, conform 10.5. Retry cu backoff la 429/5xx, timeout, mesaje de eroare clare în română în UI.
- Tabel de prețuri în `src/server/services/costs/prices.ts` (editabil): gpt-image-2: text input $5/1M tokeni, image input $8/1M, image output $30/1M. Pentru Claude și Gemini pune prețurile publice dacă le găsești, altfel 0 cu `TODO` vizibil în Setări. Cost pe `llm_calls`, însumat pe generare, afișat pe generare și în Setări (total pe lună, pe client).
- Setări: status provideri, provider implicit de imagine, buton „Test conexiune”.
- Teste cu HTTP mock-uit (fără apeluri reale în CI).
- **Acceptare:** cu chei puse, o generare reală funcționează; fără chei, totul rămâne pe mock, fără erori.

### M7: QA + finisare

- QA din 10.7 (determinist complet; vision doar cu cheie, mock altfel).
- Istoric client (toate generările, filtre după status/proiect), Dashboard (clienți + ultimele generări + cost luna curentă).
- README: setup local, variabile de mediu, deploy pe Vercel + Postgres (Supabase/Neon) + storage, migrații în prod.
- **Acceptare:** un banner cu text în afara safe zone-ului pe story primește badge de eroare; README-ul e suficient ca Onisim să pună aplicația live.

### Polish (doar după M7)

Stări goale frumoase, skeleton loaders, scurtături de tastatură în editor, editor vizual de template, duplicare proiect, căutare globală (Cmd+K).

---

## 13. Ecrane (rezumat)

| Rută | Conținut |
|---|---|
| `/login` | Parolă de echipă + alegi utilizatorul |
| `/` | Dashboard: carduri clienți, ultimele generări, cost luna asta |
| `/clients/new` | Formular client |
| `/clients/[slug]` | Tab-uri: Prezentare, Brand kit, Brain, Proiecte, Istoric |
| `/clients/[slug]/projects/[id]` | **Ecranul principal**: brief stânga, rezultate dreapta (grid pe generări, cea mai nouă sus), referințele proiectului |
| `/clients/[slug]/variants/[id]` | Editor + comentarii/feedback + export |
| `/library` | Tab-uri: Stiluri, Template-uri, Formate, Reguli agenție |
| `/settings` | Provideri, costuri, utilizatori |

**Design:** curat și neutru, ca Atlas/Linear. Fundal alb, text gri închis, griuri pentru borduri, un accent (de exemplu un albastru sau un indigo calm), border-radius 8, umbre minime, sidebar fix de ~240 px. Fără dark mode în v1. Nu pierde timp aici.

---

## 14. Prompturi

- Toate prompturile stau în `src/server/prompts/*.ts`, ca funcții care primesc date tipizate și întorc string-uri. Fiecare are o constantă `PROMPT_VERSION`, salvată în `llm_calls`.
- System prompt comun: Claude e directorul de creație al KAPE Media, scrie în română corectă (ș, ț cu virgulă), concis, fără clișee („descoperă”, „transformă-ți”, „experiență unică”) și fără superlative goale, nu inventează cifre, prețuri sau date care nu sunt în brief sau în brand kit.
- Promptul vizual cere explicit lipsa oricărui text sau logo în imagine (în modul `overlay`).

---

## 15. Nu intră în v1 (nu construi)

Video și animații · carusele multi-slide · portal de aprobare pentru client · publicare sau programare în Meta Ads · analiză de performanță · research automat (Meta Ad Library, social media) · fine-tuning / LoRA · integrare ClickUp / Make · multi-workspace · roluri și permisiuni complexe · dark mode · aplicație mobilă.

---

## 16. Chichițe de știut

- **Diacritice:** normalizează ş→ș și ţ→ț peste tot (input, output LLM, export). Testează că fonturile încărcate chiar au glifele ș/ț. Dacă lipsesc, avertisment în preview-ul fontului.
- **Logo-ul nu se generează niciodată cu AI.** Mereu fișierul real, ca layer.
- **Fonturi în Konva:** așteaptă `document.fonts.load()` înainte de randare și export; altfel exportul iese cu fontul fallback.
- **CORS / canvas tainted:** imaginile din storage trebuie servite de pe același origin (route handler), ca `toDataURL` să meargă.
- **Rate limits / timeouts:** generările de imagini pot dura zeci de secunde. Procesarea rulează în fundal (de exemplu `after()` din Next.js sau o promisiune detașată în dev, cu `maxDuration` setat în route), iar UI-ul face polling. Notează în DECISIONS.md abordarea și limitarea pe Vercel.
- **Politica Meta pentru beauty:** before/after și mesajele despre corp sunt restricționate pe anumite categorii. QA-ul vision le semnalează ca avertisment, nu blochează.
- **Nicio dată reală de client în seed sau în commit-uri.** Doar clienți demo.
