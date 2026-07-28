const { randomUUID } = require("crypto");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;
const visionClient = new vision.ImageAnnotatorClient();
const FLAGGED_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);

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
