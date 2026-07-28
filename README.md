# Nailsbyy.g Orderhantering

En mobilvänlig admin- och kundapp för beställningar hos Nailsbyy.g.

## Funktioner

- Stora knappar och tydliga färger
- Skapa, redigera och ta bort ordrar
- Snabbknapp för att hoppa till nästa status
- Filter per status
- Kanban-board och listvy
- Kundsida för nya beställningar
- Realtidssynk med Firebase Firestore
- Skyddad admininloggning
- PostNord-frakt baserad på vikt

## Starta lokalt

Appen använder JavaScript-moduler och ska köras via en lokal server:

```bash
cd "/Users/madeleine/Documents/GitHub/NailsbyG "
python3 -m http.server 5500
```

Öppna sedan `http://localhost:5500`.

Kundvy (standard): `http://localhost:5500/` eller `http://localhost:5500/kund.html`

Adminvy: `http://localhost:5500/admin.html`

## Firebase

Firebase är aktiverat i appens kod. Följ dessa steg i Firebase Console:

1. Skapa Firestore Standard `(default)` i Production mode.
2. Aktivera Authentication med Anonymous och Email/Password.
3. Skapa adminanvändaren under Authentication → Users.
4. Skapa collectionen `admins`. Dokumentets ID ska vara adminanvändarens UID och innehålla `role: "admin"`.
5. Kopiera `firebase.config.sample.js` till `firebase.config.js` och fyll i webbkonfigurationen.
6. Öppna Firestore → Rules, ersätt innehållet med `firestore.rules` och klicka Publish.
7. Lägg till `localhost` och den publicerade domänen under Authentication → Settings → Authorized domains.

Kunder autentiseras anonymt och får endast skapa validerade orderdokument. Endast användare som har ett dokument i `admins` får läsa, ändra eller radera ordrar.

## Publicera till GitHub Pages

Engångsinställning:

1. Skapa ett GitHub-repo och pusha koden till branch `main`.
2. Skapa repository secret `FIREBASE_CONFIG` under Settings → Secrets and variables → Actions. Värdet ska vara Firebase-konfigurationen som ett JSON-objekt.
3. Öppna Settings → Pages och välj GitHub Actions som source.

Release med två klick:

1. Öppna Actions → Publicera till GitHub Pages.
2. Klicka Run workflow → Run workflow.

Workflown publicerar även automatiskt när en ändring pushas till `main`.

### Snabb preflight innan release

```bash
cd "/Users/madeleine/Documents/GitHub/NailsbyG "
.github/skills/github-pages-release/scripts/preflight.sh
```

## Agenter och skills för release

Följande är nu skapade för att hjälpa er jobba strukturerat:

- Agent: `.github/agents/gh-pages-release.agent.md`
- Agent: `.github/agents/mobile-usability-check.agent.md`
- Agent: `.github/agents/product-builder.agent.md`
- Skill: `.github/skills/github-pages-release/SKILL.md`
- Skill: `.github/skills/feature-change/SKILL.md`
- Skill: `.github/skills/mobile-ui-refinement/SKILL.md`
- Prompt: `.github/prompts/release-pages.prompt.md`
- Prompt: `.github/prompts/kid-mobile-review.prompt.md`
- Prompt: `.github/prompts/build-feature-ui.prompt.md`
- Kravfil: `.github/instructions/release-requirements.instructions.md`

Skriv `/` i chatten i VS Code för att köra promptarna.

### Rekommenderat arbetsflode for andringar

1. Starta prompten `Build Feature + UI`.
2. Beskriv andringen i enkel text.
3. Lat `Product Builder` gora implementation + mobilanpassning.
4. Kor `Kid Mobile Review` prompten for snabb UX-kontroll.
5. Kor `Release To GitHub Pages` innan deploy.

## Teknisk översikt

- `index.html`: struktur
- `kund.html`: kundens beställningssida
- `styles.css`: gemensam mobil-först design
- `app.js`: adminflöde och Firestore-synk
- `customer.js`: kundbeställningar
- `firebase-client.mjs`: gemensam Firebase-anslutning
- `firestore.rules`: produktionsregler för Firestore
- `firebase.config.sample.js`: mall för Firebase-konfiguration
