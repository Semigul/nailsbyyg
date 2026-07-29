import { readFile } from "node:fs/promises";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const firebaseClientUrl = new URL("../firebase-client.mjs", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
const firebaseClient = await readFile(firebaseClientUrl, "utf8");
const runtimeVersionMatch = firebaseClient.match(
  /const FIREBASE_VERSION = "([^"]+)";/
);
const trackedVersion = packageJson.dependencies?.firebase;

if (!runtimeVersionMatch) {
  throw new Error("FIREBASE_VERSION saknas i firebase-client.mjs.");
}

if (!trackedVersion) {
  throw new Error("Firebase saknas i package.json och kan därför inte säkerhetsskannas.");
}

const runtimeVersion = runtimeVersionMatch[1];

if (trackedVersion !== runtimeVersion) {
  throw new Error(
    `Firebase-versionerna skiljer sig: CDN använder ${runtimeVersion}, ` +
      `men package.json använder ${trackedVersion}. Uppdatera båda samtidigt.`
  );
}

console.log(`Firebase ${runtimeVersion} är synkad mellan CDN och package.json.`);
