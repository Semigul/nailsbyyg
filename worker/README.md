# Ordernotiser via Cloudflare

Denna Worker skickar Web Push-notiser till Nailsbyy.g-adminappen utan Firebase Blaze.

## Vad den gor

- sparar Gretas Web Push-prenumeration i en privat Durable Object
- verifierar adminen mot dokumentet `admins/{uid}` i Firestore
- verifierar att ordern finns och tillhor den inloggade kunden
- skickar bara produkt, antal och en kort orderreferens i notisen
- skickar aldrig kundens namn, kontaktuppgift eller adress i notisen
- ignorerar dubbletter och tar bort utgangna pushprenumerationer

## Engangsinstallation

1. Installera beroenden: `npm install`
2. Logga in pa Cloudflare: `npx wrangler login`
3. Skapa ett VAPID-nyckelpar: `npx web-push generate-vapid-keys`
4. Spara nycklarna utanfor repot:
   - `npx wrangler secret put VAPID_PUBLIC_KEY`
   - `npx wrangler secret put VAPID_PRIVATE_KEY`
5. Publicera: `npm run deploy`
6. Kopiera Worker-adressen som skrivs ut, till exempel
   `https://nailsbyyg-order-notifications.<subdomain>.workers.dev`.
7. Uppdatera den publika adressen i `push-config.js` om Workerns adress andras.
8. Publicera `firestore.rules` och publicera sedan webbplatsen.

Nycklarna far inte laggas i Git eller i `firebase.config.js`. Den publika nyckeln
hamtas automatiskt fran Workern nar Greta aktiverar notiser.

## Lokal kontroll

- `npm test` testar validering och att notisen inte innehaller kunduppgifter.
- `npm run check` bygger Workern lokalt utan att publicera.
