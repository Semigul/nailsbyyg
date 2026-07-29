// Kopiera denna fil till firebase.config.js och fyll i era uppgifter.
// Filen firebase.config.js är medvetet inte med i git.
window.FIREBASE_CONFIG = {
  apiKey: "DIN_API_KEY",
  authDomain: "ditt-projekt.firebaseapp.com",
  projectId: "ditt-projekt-id",
  storageBucket: "ditt-projekt.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Cloudinary for kunders bilduppladdning.
// Rekommenderat: signerad upload med signEndpoint.
window.CLOUDINARY_CONFIG = {
  cloudName: "DIN_CLOUD_NAME",
  signEndpoint: "DIN_FUNCTION_URL_FOR_SIGNERING",
  // Optional fallback for unsigned mode:
  uploadPreset: "DIN_UNSIGNED_UPLOAD_PRESET",
  folder: "nailsbyyg-orders"
};

// Valfritt: visas först efter att kunden har reserverat en marknadsplatsvara.
// Lämna tomt om Swish-uppgifterna ska skickas manuellt till kunden.
window.MARKETPLACE_CONFIG = {
  swishNumber: ""
};
