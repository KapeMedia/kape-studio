# CLAUDE.md — KAPE Studio

Citește asta la începutul fiecărei sesiuni. Specificația completă e în `SPEC.md`. Citește-o integral înainte să scrii cod.

## Ce construim

KAPE Studio este aplicația web internă a agenției KAPE Media (marketing digital, Oradea/Craiova, România). Cu ea generăm bannere statice on-brand (feed, story, cover Facebook, landscape) pentru clienții agenției. Fiecare client are un spațiu separat, cu brand kit și un „brain” care învață din feedback-ul echipei. Inspirația pentru concept este Atlas, un tool de conținut video pe care agenția îl folosește. `SPEC.md` explică ce luăm din el.

Utilizatori: 2 fondatori + 1 editor. Nu e SaaS, nu are clienți externi, nu are billing.

## Cum lucrezi (autonom)

Proprietarul (Onisim) NU e disponibil cât lucrezi. Nu are cum să-ți răspundă la întrebări.

1. **Nu te opri să întrebi.** Când ceva e ambiguu, alege varianta cea mai simplă care respectă SPEC.md, notează decizia în `DECISIONS.md` (dată, decizie, motiv, cum se schimbă) și mergi mai departe.
2. **Lucrează pe milestone-uri, în ordine** (SPEC.md, secțiunea 12). Un milestone e gata doar când îndeplinește criteriile de acceptare și trec `typecheck`, `lint`, `test` și `build`.
3. **Commit după fiecare milestone** (și mai des dacă e util), cu mesaje clare (`feat(m3): generation pipeline with mock providers`). Fă push pe branch-ul de lucru.
4. **Ține la zi `PROGRESS.md`** după fiecare milestone: ce e gata, ce urmează, ce e blocat și lista „Ce trebuie să facă Onisim” (conturi, chei, decizii). Fișierul ăsta e primul lucru pe care îl citește dimineața.
5. **Fără chei, nimic nu se oprește.** Tot ce ține de AI are un provider `mock`, folosit automat când lipsește cheia. Baza de date merge local cu PGlite. Aplicația trebuie să ruleze cap-coadă fără niciun cont extern.
6. **Nu ieși din scope.** Ce e în SPEC.md la „Nu intră în v1” nu se construiește. Ideile bune merg în `PROGRESS.md` la „Idei pentru mai târziu”.
7. **Dacă rețeaua blochează ceva** (registry shadcn, Google Fonts, API-uri externe), găsește o cale care nu cere rețea: scrii componenta de mână, folosești fonturi din pachete npm, mock. Notezi asta în DECISIONS.md.
8. Dacă termini toate milestone-urile, treci la „Polish” din SPEC.md. Nu inventa feature-uri noi.

## Convenții

- Codul, numele de variabile și commit-urile sunt în engleză. **Tot textul din interfață e în română, cu diacritice corecte** (ș, ț cu virgulă dedesubt: U+0219, U+021B; NU ş, ţ cu sedilă).
- TypeScript strict. Fără `any`, cu excepția granițelor cu librării externe, comentate.
- Logica de business stă în `src/server/**` (servicii pure, testabile). Route handlers și server actions rămân subțiri.
- Toți providerii externi (LLM, imagine, storage) stau în spatele unei interfețe din `src/server/providers/**`.
- Validare cu Zod pe toate input-urile și pe toate output-urile JSON de la LLM.
- Niciodată chei în cod sau în commit-uri. `.env.local` e în `.gitignore`. Ține la zi `.env.example`.
- Testează cu Vitest logica importantă: context builder, promovarea regulilor din brain, layout-ul template-urilor, încadrarea textului, normalizarea diacriticelor, calculul costurilor.

## Comenzi (de completat după M0)

```
pnpm dev        # pornește aplicația (PGlite + mock automat dacă lipsesc cheile)
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:generate / pnpm db:migrate / pnpm db:seed
```

## Design

Curat, liniștit, ca un tool modern de productivitate (Linear, Notion, Atlas). Fundal alb, griuri neutre, o singură culoare de accent, mult spațiu liber, sidebar în stânga. Fără gradienturi, fără animații inutile. Nu pierde timp pe design: componente simple și consecvente sunt suficiente.
