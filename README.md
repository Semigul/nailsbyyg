# Nailsbyy.g Orderhantering

En mobilvänlig admin- och kundapp för beställningar hos Nailsbyy.g.

## Funktioner

- Stora knappar och tydliga färger
- Skapa, redigera och ta bort ordrar
- Snabbknapp för att hoppa till nästa status
- Filter per status
- Kanban-board och listvy
- Kundsida för nya beställningar
- Kundsida med bilduppladdning för önskad design
- Realtidssynk med Firebase Firestore
- Skyddad admininloggning
- PostNord-frakt baserad på vikt
- Automatisk bildmoderering (pending/approved/rejected)

## Starta lokalt

Appen använder JavaScript-moduler och ska köras via en lokal server:

```bash
cd "/Users/madeleine/Documents/GitHub/NailsbyG "
python3 -m http.server 5500
```

Öppna sedan `http://localhost:5500`.

Kundvy (standard): `http://localhost:5500/` eller `http://localhost:5500/kund.html`

Adminvy: `http://localhost:5500/admin.html`

## Automatiska tester

Installera testverktygen en gång:

```bash
npm install
npx playwright install chromium
```

Kör alla kod- och E2E-kontroller:

```bash
npm test
```

Kör beroende- och Firebase-kontroller:

```bash
npm run security
```

E2E-sviten kör kundflödet och adminflödet i mobil viewport med en isolerad Firebase-mock. Testdata skickas aldrig till produktion.

`npm install` aktiverar repots versionerade `pre-push`-hook. Varje `git push` kör därefter `npm test` och stoppas om någon kontroll misslyckas.

Vid ny funktionalitet ska motsvarande test läggas till eller uppdateras i `tests/e2e/`. Projektets Feature Change-skill och Product Builder-agent behandlar detta som ett leveranskrav.

## Säkerhetskontroller

- Dependabot kontrollerar npm-paket och GitHub Actions varje vecka och öppnar uppdaterings-PR:ar.
- `npm audit --audit-level=high` stoppar releasen vid sårbarheter med hög eller kritisk nivå.
- CodeQL analyserar JavaScript-koden vid pull requests, push till `main` och en gång i veckan.
- Firebase finns som exakt version i `package.json` så att npm audit och Dependabot kan kontrollera paketet.
- `scripts/check-firebase-version.mjs` stoppar releasen om Firebase-versionen i `package.json` inte matchar CDN-versionen i `firebase-client.mjs`.

När Firebase uppdateras ska samma exakta version ändras i både `package.json` och `firebase-client.mjs`. Kör därefter `npm install` för att uppdatera låsfilen.

## Firebase

Firebase är aktiverat i appens kod. Följ dessa steg i Firebase Console:

1. Skapa Firestore Standard `(default)` i Production mode.
2. Aktivera Authentication med Anonymous och Email/Password.
3. Skapa adminanvändaren under Authentication → Users.
4. Skapa collectionen `admins`. Dokumentets ID ska vara adminanvändarens UID och innehålla `role: "admin"`.
5. Kopiera `firebase.config.sample.js` till `firebase.config.js` och fyll i webbkonfigurationen.
6. Aktivera Firebase Storage (blaze/spark enligt projektbehov).
7. Öppna Firestore → Rules, ersätt innehållet med `firestore.rules` och klicka Publish.
8. Öppna Storage → Rules, ersätt innehållet med `storage.rules` och klicka Publish.
9. Lägg till `localhost` och den publicerade domänen under Authentication → Settings → Authorized domains.

### Automatisk moderering av uppladdade bilder

Kunduppladdade designbilder går via moderering:

- `pending`: bilder granskas
- `approved`: godkända bilder visas i admin
- `rejected`: bilder blockeras och visas inte i admin

Deploy av modereringsfunktion:

```bash
cd "/Users/madeleine/Documents/GitHub/NailsbyG "
cd functions
npm install
npm run deploy
```

Mer detaljer finns i `functions/README.md`.

Kunder autentiseras anonymt och får endast skapa validerade orderdokument. Endast användare som har ett dokument i `admins` får läsa, ändra eller radera ordrar.

## Cloudinary (bilduppladdning utan Firebase Storage-plan)

Ja, du behöver ett Cloudinary-konto för att kunna ladda upp kundbilder.

1. Skapa konto i Cloudinary.
2. Skapa ett unsigned upload preset i Cloudinary Console (fallback).
3. Deploya signeringsfunktionen i `functions/index.js`.
4. Fyll i `window.CLOUDINARY_CONFIG` i `firebase.config.js` lokalt.

Format:

```js
window.CLOUDINARY_CONFIG = {
	cloudName: "DIN_CLOUD_NAME",
	signEndpoint: "DIN_FUNCTION_URL_FOR_SIGNERING",
	uploadPreset: "DIN_UNSIGNED_UPLOAD_PRESET",
	folder: "nailsbyyg-orders"
};
```

För strict 5 MB server-side kontroll, använd signerad upload via `signEndpoint`.
`uploadPreset` kan behållas som fallback.

Sätt function-secrets innan deploy:

```bash
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
firebase functions:secrets:set CLOUDINARY_API_KEY
firebase functions:secrets:set CLOUDINARY_API_SECRET
```

För deploy via GitHub Actions kan samma värden läggas in i `FIREBASE_CONFIG` secret som:

- `cloudinaryCloudName`
- `cloudinarySignEndpoint`
- `cloudinaryUploadPreset`
- `cloudinaryFolder` (valfritt)

Alternativt som objekt under nyckeln `cloudinary`.

## Publicera till GitHub Pages

Engångsinställning:

1. Skapa ett GitHub-repo och pusha koden till branch `main`.
2. Skapa repository secret `FIREBASE_CONFIG` under Settings → Secrets and variables → Actions. Värdet ska vara Firebase-konfigurationen som ett JSON-objekt.
3. Öppna Settings → Pages och välj GitHub Actions som source.

Release med två klick:

1. Öppna Actions → Publicera till GitHub Pages.
2. Klicka Run workflow → Run workflow.

Workflown kör E2E-tester, beroendekontroll och CodeQL vid pull requests och push till `main`. GitHub Pages publiceras endast när alla releasegrindar har passerat.

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
