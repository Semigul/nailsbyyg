# Moderation Function

Denna mapp innehaller en Cloud Function som modererar uppladdade designbilder med Google Cloud Vision SafeSearch.

## Flode

1. Kund laddar upp bild till `order-designs/{uid}/{orderId}/...`.
2. Function triggas pa Storage `onObjectFinalized`.
3. Bilden analyseras med SafeSearch.
4. Om flaggad: bilden tas bort och ordern markeras `rejected`.
5. Om godkand: URL laggs till i `approvedDesignImageUrls`.
6. Admin visar endast `approvedDesignImageUrls`.

## Deploy

1. Installera Firebase CLI: `npm i -g firebase-tools`
2. Logga in: `firebase login`
3. I projektroten, valj projekt: `firebase use <project-id>`
4. Installera beroenden: `cd functions && npm install`
5. Deploya functions: `npm run deploy`

## Krav

- Billing/API tillgang for Cloud Vision API
- Firebase project med Firestore + Storage
