const FIREBASE_VERSION = "12.16.0";
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
const FIREBASE_FIRESTORE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
const FIREBASE_STORAGE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-storage.js`;

let servicesPromise;

export function getFirebaseServices() {
  if (!servicesPromise) {
    servicesPromise = connectFirebase();
  }

  return servicesPromise;
}

async function connectFirebase() {
  await loadProjectConfig();

  const config = window.FIREBASE_CONFIG;

  if (!isValidConfig(config)) {
    throw new Error("Firebase-konfigurationen saknas eller innehåller platshållare.");
  }

  const [appApi, authApi, firestoreApi, storageApi] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_AUTH_URL),
    import(FIREBASE_FIRESTORE_URL),
    import(FIREBASE_STORAGE_URL)
  ]);

  const app = appApi.getApps().length > 0 ? appApi.getApp() : appApi.initializeApp(config);

  return {
    app,
    auth: authApi.getAuth(app),
    authApi,
    db: firestoreApi.getFirestore(app),
    firestoreApi,
    storage: storageApi.getStorage(app),
    storageApi
  };
}

async function loadProjectConfig() {
  if (window.FIREBASE_CONFIG) {
    return;
  }

  await import("./firebase.config.js");
}

function isValidConfig(config) {
  if (!config || typeof config !== "object") {
    return false;
  }

  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];

  return requiredKeys.every((key) => {
    const value = String(config[key] || "");
    return value && !/DIN_|ditt-projekt|abcdef123456/i.test(value);
  });
}
