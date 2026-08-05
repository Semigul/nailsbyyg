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
- Separata sidor för integritetspolicy och köp- och beställningsvillkor
- Säker kundlänk med aktuell order-, pris- och leveranssammanställning
- Realtidssynk med Firebase Firestore
- Marknadsplats för begagnade saker med bilder i Cloudinary
- Säker reservation som skapar en ny order i adminvyn
- Manuell Swish-status: väntar, betald eller återbetald
- Skyddad admininloggning
- PostNord-frakt baserad på vikt
- Automatisk bildmoderering (pending/approved/rejected)
- Installerbar privat adminapp med pushnotis vid nya kundbeställningar
- Kompakta orderkort som kan fällas ut vid behov

## Starta lokalt

Appen använder JavaScript-moduler och ska köras via en lokal server:

```bash
cd "/Users/madeleine/Documents/GitHub/NailsbyG "
python3 -m http.server 5500
```

Öppna sedan `http://localhost:5500`.

Kundvy (standard): `http://localhost:5500/` eller `http://localhost:5500/kund.html`

Adminvy: `http://localhost:5500/admin.html`

Loppisadmin: `http://localhost:5500/loppis-admin.html`

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

- Dependabot kontrollerar npm-paket varje vecka och öppnar uppdaterings-PR:ar.
- `npm audit --audit-level=high` stoppar releasen vid sårbarheter med hög eller kritisk nivå i webbappen. För `functions` och `worker` granskas samma nivå via `scripts/check-subproject-audit.mjs`, och worker-granskningen fokuserar på produktionsberoenden.
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
6. Firebase Storage behöver inte aktiveras. Bilder lagras i Cloudinary.
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

### Kundlänkar för ordersammanställning

Admin kan trycka på `Kundlänk` på en order och skicka länken direkt till kunden. Kunden
behöver inget konto. Sammanställningen uppdateras automatiskt när ordern ändras och visar
endast de kunduppgifter som behövs för ordern. Kontaktuppgifter och Swish-referens delas inte.

Varje länk har en slumpad 48 tecken lång nyckel, gäller i 90 dagar och kan stängas av från
adminvyn. Nyckeln ligger i länkens fragment efter `#`, så GitHub Pages får inte nyckeln i
sidförfrågan. Firestore tillåter bara läsning av det exakta dokumentet och förbjuder publik
listning av samlingen `orderShares`.

### Adminapp på iPhones hemskärm och ordernotiser

Adminvyn kan installeras som en hemskärmsapp på iPhone:

1. Publicera den senaste versionen av webbplatsen, Firestore-reglerna och Cloudflare Workern.
2. Öppna `admin.html` i Safari på Gretas iPhone.
3. Tryck på Dela och välj `Lägg till på hemskärmen`.
4. Öppna Nailsbyy.g från hemskärmen och logga in som admin.
5. Tryck på `Aktivera notiser` och tillåt notiser.

En pushnotis skickas när en kund skapar en vanlig beställning eller reserverar en
marknadsplatsvara. Order som skapas manuellt av admin och senare ändringar av en order
skickar ingen notis. Låsskärmsnotisen visar endast produkt, antal och en kort orderreferens;
kundens namn och kontaktuppgifter visas först efter att Greta öppnat den inloggningsskyddade
adminappen.

Pushnotiserna använder standardiserad Web Push via en Cloudflare Worker och har ingen avgift
per meddelande. Firebase kan ligga kvar på Spark-planen; Blaze och Firebase Functions behövs
inte för notiserna. Workern verifierar den inloggade kunden mot Firestore innan den skickar
notisen och lagrar Gretas pushprenumeration privat hos Cloudflare. Installationsstegen finns
i `worker/README.md`.

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

## Marknadsplats och Swish

Längst ned i `admin.html` finns en länk till den skyddade sidan `loppis-admin.html`, där admin
kan publicera och redigera begagnade saker. Bilden laddas upp till Cloudinary och övriga
uppgifter sparas i Firestore-samlingen `marketplaceItems`.

På ordersidan finns även en toggle för synligheten. Loppishörnan är dold som standard. När
togglen aktiveras visas länken på `kund.html` och den publika sidan `loppis.html` öppnas för
kunder. Inställningen sparas i dokumentet `publicSettings/marketplace`.

När en kund beställer en tillgänglig vara sker reservationen och orderskapandet i samma
Firestore-transaktion. Ordern får status `Ny`, typen `marketplace` och betalningsstatus
`Väntar på Swish`. När admin väljer `Betald` markeras varan som såld. Vid `Återbetald` blir
varan tillgänglig igen.

Swish-numret kan visas efter reservationen genom att lägga till följande i den lokala
`firebase.config.js`:

```js
window.MARKETPLACE_CONFIG = {
  swishNumber: "DITT_SWISHNUMMER"
};
```

Om numret lämnas tomt får kunden i stället information om att Swish-uppgifterna skickas
manuellt till kontaktuppgiften i beställningen.

## Teknisk översikt

- `index.html`: struktur
- `kund.html`: kundens beställningssida
- `integritet.html`: integritetspolicy länkad från kundsidan
- `kopvillkor.html`: köp- och beställningsvillkor länkade från kundsidan
- `bestallning.html`: skrivskyddad ordersammanställning via säker kundlänk
- `loppis.html`: separat kundsida för begagnade saker
- `loppis-admin.html`: skyddad sida för att hantera Loppishörnan
- `styles.css`: gemensam mobil-först design
- `app.js`: adminflöde och Firestore-synk
- `customer.js`: kundbeställningar
- `marketplace-admin.js`: publicering och redigering av begagnade saker
- `order-summary.js`: hämtar och visar delad ordersammanställning
- `firebase-client.mjs`: gemensam Firebase-anslutning
- `firestore.rules`: produktionsregler för Firestore
- `firebase.config.sample.js`: mall för Firebase-konfiguration
