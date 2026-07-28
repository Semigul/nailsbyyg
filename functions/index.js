const { randomUUID, createHash } = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;
const visionClient = new vision.ImageAnnotatorClient();
const FLAGGED_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);
const DEFAULT_CLOUDINARY_FOLDER = "nailsbyyg-orders";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const CLOUDINARY_CLOUD_NAME = defineSecret("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

exports.signCloudinaryUpload = onRequest({
  cors: true,
  memory: "256MiB",
  timeoutSeconds: 30,
  secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]
}, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = getBearerToken(req.headers.authorization || "");

    if (!token) {
      res.status(401).json({ error: "Missing auth token" });
      return;
    }

    await admin.auth().verifyIdToken(token);

    const orderId = String(req.body?.orderId || "").trim();
    const fileIndex = Number(req.body?.fileIndex);

    if (!/^[a-zA-Z0-9_-]{6,120}$/.test(orderId) || !Number.isInteger(fileIndex) || fileIndex < 0) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const folder = sanitizeFolder(String(req.body?.folder || DEFAULT_CLOUDINARY_FOLDER));
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${orderId}_${timestamp}_${fileIndex}`;
    const cloudName = CLOUDINARY_CLOUD_NAME.value();
    const apiKey = CLOUDINARY_API_KEY.value();
    const apiSecret = CLOUDINARY_API_SECRET.value();

    const signingParams = {
      folder,
      max_file_size: MAX_FILE_SIZE_BYTES,
      public_id: publicId,
      timestamp
    };

    const signature = signCloudinaryParams(signingParams, apiSecret);

    res.status(200).json({
      cloudName,
      apiKey,
      folder,
      publicId,
      signature,
      timestamp,
      maxFileSize: MAX_FILE_SIZE_BYTES
    });
  } catch (error) {
    logger.error("Cloudinary signering misslyckades", error);
    res.status(500).json({ error: "Signing failed" });
  }
});

exports.moderateDesignImage = onObjectFinalized({
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  const objectPath = event.data.name || "";
  const bucketName = event.data.bucket;

  if (!objectPath || !bucketName) {
    return;
  }

  const match = objectPath.match(/^order-designs\/([^/]+)\/([^/]+)\/[^/]+$/);

  if (!match) {
    return;
  }

  const [, customerId, orderId] = match;
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnapshot = await orderRef.get();

  if (!orderSnapshot.exists) {
    logger.warn("Order saknas for uppladdad bild", { orderId, objectPath });
    return;
  }

  const order = orderSnapshot.data() || {};
  const imagePaths = Array.isArray(order.designImagePaths) ? order.designImagePaths : [];

  if (!imagePaths.includes(objectPath)) {
    logger.warn("Bildpath finns inte i ordern", { orderId, objectPath });
    return;
  }

  const gsUri = `gs://${bucketName}/${objectPath}`;
  const [safeSearchResult] = await visionClient.safeSearchDetection(gsUri);
  const annotation = safeSearchResult.safeSearchAnnotation || {};
  const blockedReason = getBlockedReason(annotation);

  if (blockedReason) {
    await storage.bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });

    await orderRef.set({
      designImagePaths: FieldValue.arrayRemove(objectPath),
      moderationStatus: "rejected",
      moderationReason: `Automatisk moderering: ${blockedReason}`,
      moderationUpdatedAt: Date.now()
    }, { merge: true });

    return;
  }

  const approvedUrl = await ensureDownloadUrl(bucketName, objectPath);

  await orderRef.set({
    approvedDesignImageUrls: FieldValue.arrayUnion(approvedUrl),
    moderationReason: "",
    moderationUpdatedAt: Date.now()
  }, { merge: true });

  const refreshedSnapshot = await orderRef.get();
  const refreshed = refreshedSnapshot.data() || {};
  const approvedCount = Array.isArray(refreshed.approvedDesignImageUrls)
    ? refreshed.approvedDesignImageUrls.length
    : 0;
  const expectedCount = Array.isArray(refreshed.designImagePaths)
    ? refreshed.designImagePaths.length
    : 0;

  const moderationStatus = expectedCount === 0 || approvedCount >= expectedCount ? "approved" : "pending";

  await orderRef.set({
    moderationStatus,
    moderationUpdatedAt: Date.now()
  }, { merge: true });

  logger.info("Moderering slutford", { orderId, objectPath, moderationStatus });
});

function getBlockedReason(annotation) {
  const reasons = [];

  if (FLAGGED_LEVELS.has(annotation.adult)) {
    reasons.push("vuxet innehall");
  }

  if (FLAGGED_LEVELS.has(annotation.violence)) {
    reasons.push("valdsamt innehall");
  }

  if (FLAGGED_LEVELS.has(annotation.racy)) {
    reasons.push("olampligt innehall");
  }

  return reasons.length > 0 ? reasons.join(", ") : "";
}

async function ensureDownloadUrl(bucketName, objectPath) {
  const file = storage.bucket(bucketName).file(objectPath);
  const [metadata] = await file.getMetadata();
  const existingTokens = metadata.metadata?.firebaseStorageDownloadTokens || "";
  const token = existingTokens.split(",").map((value) => value.trim()).find(Boolean) || randomUUID();

  if (!existingTokens) {
    await file.setMetadata({
      metadata: {
        ...(metadata.metadata || {}),
        firebaseStorageDownloadTokens: token
      }
    });
  }

  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

function signCloudinaryParams(params, apiSecret) {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

function sanitizeFolder(rawFolder) {
  const normalized = String(rawFolder || "")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || !normalized.startsWith(DEFAULT_CLOUDINARY_FOLDER)) {
    return DEFAULT_CLOUDINARY_FOLDER;
  }

  return normalized;
}

function getBearerToken(headerValue) {
  const match = String(headerValue).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}
