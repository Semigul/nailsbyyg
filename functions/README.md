# Functions

Denna mapp innehaller funktioner for bilduppladdning och moderering.

## Funktioner

1. `signCloudinaryUpload`
- HTTPS endpoint som skapar signerade Cloudinary-parametrar.
- API secret stannar pa serversidan.
- Tvingar `max_file_size` till 5 MB server-side.

2. `moderateDesignImage` (valfri)
- Storage-trigger som modererar Firebase Storage-bilder med SafeSearch.
- Behovs bara om ni fortsatt anvander Firebase Storage-baserat flode.

## Deploy

1. Installera Firebase CLI: `npm i -g firebase-tools`
2. Logga in: `firebase login`
3. I projektroten, valj projekt: `firebase use <project-id>`
4. Installera beroenden: `cd functions && npm install`
5. Spara Cloudinary-hemligheterna om signerad bilduppladdning ska anvandas.
6. Deploya functions: `npm run deploy`
7. Publicera Firestore-reglerna fran projektroten:
	- `firebase deploy --only firestore:rules`

## Krav

- Firebase project med Firestore
- For signed Cloudinary: hemligheter
	- `CLOUDINARY_CLOUD_NAME`
	- `CLOUDINARY_API_KEY`
	- `CLOUDINARY_API_SECRET`
- For `moderateDesignImage`: Cloud Vision API + Firebase Storage

Pushnotiserna ligger i stallet i `worker/` och anvander Cloudflare utan Firebase Blaze.
