const FIREBASE_MODULES = {
  "firebase-app.js": `
    const state = globalThis.__NAILSBYYG_E2E_FIREBASE__;
    export function getApps() { return state.apps; }
    export function getApp() { return state.apps[0]; }
    export function initializeApp(config) {
      const app = { config };
      state.apps.push(app);
      return app;
    }
  `,
  "firebase-auth.js": `
    const state = globalThis.__NAILSBYYG_E2E_FIREBASE__;
    const LOCAL_AUTH_KEY = "nailsbyyg.e2e.auth.local";
    const SESSION_AUTH_KEY = "nailsbyyg.e2e.auth.session";

    export const browserLocalPersistence = { type: "local" };
    export const browserSessionPersistence = { type: "session" };

    function emitAuth(auth) {
      queueMicrotask(() => {
        state.authListeners.forEach((listener) => listener(auth.currentUser));
      });
    }

    function user(uid, isAnonymous) {
      return {
        uid,
        isAnonymous,
        async getIdToken() {
          return "e2e-token";
        }
      };
    }

    function readStoredUser() {
      const sessionUser = sessionStorage.getItem(SESSION_AUTH_KEY);
      const localUser = localStorage.getItem(LOCAL_AUTH_KEY);
      const serializedUser = sessionUser || localUser;

      state.persistence = sessionUser ? "session" : "local";

      if (!serializedUser) {
        return null;
      }

      const storedUser = JSON.parse(serializedUser);
      return user(storedUser.uid, storedUser.isAnonymous);
    }

    function clearStoredUser() {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }

    function persistUser(currentUser) {
      clearStoredUser();

      if (!currentUser) {
        return;
      }

      const storage = state.persistence === "session" ? sessionStorage : localStorage;
      const key = state.persistence === "session" ? SESSION_AUTH_KEY : LOCAL_AUTH_KEY;
      storage.setItem(key, JSON.stringify({
        uid: currentUser.uid,
        isAnonymous: currentUser.isAnonymous
      }));
    }

    export function getAuth() {
      return state.auth;
    }

    export function onAuthStateChanged(auth, listener) {
      state.authListeners.push(listener);

      if (!state.authInitialized) {
        state.authInitialized = true;
        queueMicrotask(() => {
          auth.currentUser = readStoredUser();
          listener(auth.currentUser);
        });
      } else {
        queueMicrotask(() => listener(auth.currentUser));
      }

      return () => {
        state.authListeners = state.authListeners.filter((item) => item !== listener);
      };
    }

    export async function setPersistence(auth, persistence) {
      state.persistence = persistence?.type === "session" ? "session" : "local";
      persistUser(auth.currentUser);
    }

    export async function signInAnonymously(auth) {
      auth.currentUser = user("customer-e2e", true);
      persistUser(auth.currentUser);
      emitAuth(auth);
      return { user: auth.currentUser };
    }

    export async function signInWithEmailAndPassword(auth) {
      auth.currentUser = user("admin-e2e", false);
      persistUser(auth.currentUser);
      emitAuth(auth);
      return { user: auth.currentUser };
    }

    export async function signOut(auth) {
      auth.currentUser = null;
      clearStoredUser();
      emitAuth(auth);
    }
  `,
  "firebase-firestore.js": `
    const state = globalThis.__NAILSBYYG_E2E_FIREBASE__;
    const DATABASE_KEY = "nailsbyyg.e2e.database";

    function persistDatabase() {
      sessionStorage.setItem(DATABASE_KEY, JSON.stringify({
        orders: state.orders,
        marketplaceItems: state.marketplaceItems
      }));
    }

    function collectionData(name) {
      return name === "marketplaceItems" ? state.marketplaceItems : state.orders;
    }

    function collectionSnapshot(name) {
      const docs = Object.entries(collectionData(name))
        .sort(([, left], [, right]) => (right.updatedAt || 0) - (left.updatedAt || 0))
        .map(([id, value]) => ({
          id,
          data() {
            return { ...value };
          }
        }));

      return { docs };
    }

    function notifyCollection(name) {
      const snapshot = collectionSnapshot(name);
      queueMicrotask(() => {
        (state.listeners[name] || []).forEach((listener) => listener(snapshot));
      });
    }

    export function getFirestore() {
      return state.db;
    }

    export function collection(_db, name) {
      return { kind: "collection", name };
    }

    export function doc(source, ...segments) {
      if (source?.kind === "collection") {
        const prefix = source.name === "marketplaceItems" ? "item" : "order";
        const id = segments[0] || prefix + "-e2e-" + state.nextDocumentId++;
        return { kind: "document", collection: source.name, id };
      }

      return {
        kind: "document",
        collection: segments[0],
        id: segments[1]
      };
    }

    export async function getDoc(reference) {
      if (reference.collection === "admins" && reference.id === "admin-e2e") {
        return {
          exists() {
            return true;
          },
          data() {
            return { role: "admin" };
          }
        };
      }

      const value = collectionData(reference.collection)[reference.id];
      return {
        exists() {
          return Boolean(value);
        },
        data() {
          return value ? { ...value } : undefined;
        }
      };
    }

    export function orderBy() {
      return {};
    }

    export function query(collectionReference) {
      return collectionReference;
    }

    export function onSnapshot(queryReference, listener) {
      const name = queryReference.name;
      state.listeners[name] = state.listeners[name] || [];
      state.listeners[name].push(listener);
      queueMicrotask(() => listener(collectionSnapshot(name)));
      return () => {
        state.listeners[name] = state.listeners[name].filter((item) => item !== listener);
      };
    }

    export async function setDoc(reference, value, options = {}) {
      const documents = collectionData(reference.collection);
      const current = documents[reference.id] || {};
      documents[reference.id] = options.merge
        ? { ...current, ...value }
        : { ...value };
      persistDatabase();
      notifyCollection(reference.collection);
    }

    export async function deleteDoc(reference) {
      delete collectionData(reference.collection)[reference.id];
      persistDatabase();
      notifyCollection(reference.collection);
    }

    export async function runTransaction(_db, callback) {
      const writes = [];
      const transaction = {
        async get(reference) {
          const value = collectionData(reference.collection)[reference.id];
          return {
            exists() {
              return Boolean(value);
            },
            data() {
              return value ? { ...value } : undefined;
            }
          };
        },
        set(reference, value, options = {}) {
          writes.push({ reference, value, options });
        }
      };

      const result = await callback(transaction);
      writes.forEach(({ reference, value, options }) => {
        const documents = collectionData(reference.collection);
        const current = documents[reference.id] || {};
        documents[reference.id] = options.merge ? { ...current, ...value } : { ...value };
      });
      persistDatabase();
      [...new Set(writes.map(({ reference }) => reference.collection))]
        .forEach((name) => notifyCollection(name));
      return result;
    }
  `,
  "firebase-storage.js": `
    const state = globalThis.__NAILSBYYG_E2E_FIREBASE__;
    export function getStorage() {
      return state.storage;
    }
  `
};

export async function installFirebaseMock(page) {
  await page.addInitScript(() => {
    let storedDatabase = {};

    try {
      storedDatabase = JSON.parse(sessionStorage.getItem("nailsbyyg.e2e.database") || "{}");
    } catch {
      storedDatabase = {};
    }

    globalThis.FIREBASE_CONFIG = {
      apiKey: "e2e-api-key",
      authDomain: "e2e.local",
      projectId: "e2e-project",
      appId: "e2e-app"
    };
    globalThis.CLOUDINARY_CONFIG = {
      cloudName: "e2e-cloud",
      uploadPreset: "e2e-preset",
      folder: "nailsbyyg-orders"
    };
    globalThis.MARKETPLACE_CONFIG = {
      swishNumber: "0701234567"
    };

    globalThis.__NAILSBYYG_E2E_FIREBASE__ = {
      apps: [],
      auth: { currentUser: null },
      authInitialized: false,
      authListeners: [],
      persistence: "local",
      db: {},
      storage: {},
      orders: storedDatabase.orders || {},
      marketplaceItems: storedDatabase.marketplaceItems || {},
      listeners: {},
      nextDocumentId: 1
    };
  });

  await page.route("https://www.gstatic.com/firebasejs/**", async (route) => {
    const fileName = new URL(route.request().url()).pathname.split("/").pop();
    const body = FIREBASE_MODULES[fileName];

    if (!body) {
      await route.abort();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      headers: { "Access-Control-Allow-Origin": "*" },
      body
    });
  });

  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
}

export async function readMockOrders(page) {
  return page.evaluate(() => Object.values(globalThis.__NAILSBYYG_E2E_FIREBASE__.orders));
}

export async function readMockMarketplaceItems(page) {
  return page.evaluate(() => Object.values(globalThis.__NAILSBYYG_E2E_FIREBASE__.marketplaceItems));
}
