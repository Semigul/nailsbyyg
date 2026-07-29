import { getFirebaseServices } from "./firebase-client.mjs";

const MAX_UPLOAD_IMAGES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ui = {
  form: document.getElementById("customerOrderForm"),
  connectionStatus: document.getElementById("customerConnectionStatus"),
  formMessage: document.getElementById("customerFormMessage"),
  success: document.getElementById("customerSuccess"),
  orderReference: document.getElementById("customerOrderReference"),
  newOrderButton: document.getElementById("newCustomerOrder"),
  deliveryMethod: document.getElementById("customerDelivery"),
  addressGroup: document.getElementById("customerAddressGroup"),
  address: document.getElementById("customerAddress"),
  dueDate: document.getElementById("customerDueDate"),
  designImages: document.getElementById("customerDesignImages"),
  fileStatus: document.getElementById("customerFileStatus"),
  imagePreview: document.getElementById("customerImagePreview"),
  marketplaceStatus: document.getElementById("marketplaceStatus"),
  marketplaceGrid: document.getElementById("marketplaceGrid"),
  marketplaceForm: document.getElementById("marketplaceOrderForm"),
  marketplaceItemId: document.getElementById("marketplaceItemId"),
  marketplaceCheckoutImage: document.getElementById("marketplaceCheckoutImage"),
  marketplaceCheckoutTitle: document.getElementById("marketplaceCheckoutTitle"),
  marketplaceCheckoutPrice: document.getElementById("marketplaceCheckoutPrice"),
  marketplaceDelivery: document.getElementById("marketplaceDelivery"),
  marketplaceAddressGroup: document.getElementById("marketplaceAddressGroup"),
  marketplaceAddress: document.getElementById("marketplaceAddress"),
  marketplaceMessage: document.getElementById("marketplaceFormMessage"),
  marketplaceSuccess: document.getElementById("marketplaceSuccess"),
  marketplaceSwishInstructions: document.getElementById("marketplaceSwishInstructions"),
  marketplaceOrderReference: document.getElementById("marketplaceOrderReference"),
  cancelMarketplaceOrder: document.getElementById("cancelMarketplaceOrder"),
  closeMarketplaceSuccess: document.getElementById("closeMarketplaceSuccess")
};

let firebase;
let customerUser;
let previewUrls = [];
let selectedDesignFiles = [];
let marketplaceItems = [];
let unsubscribeMarketplace;

init();

async function init() {
  setMinimumDate();
  ui.form.addEventListener("submit", onSubmitOrder);
  ui.newOrderButton.addEventListener("click", resetCustomerForm);
  ui.deliveryMethod.addEventListener("change", updateAddressRequirement);
  ui.designImages.addEventListener("change", onDesignImagesChange);
  ui.imagePreview.addEventListener("click", onPreviewAction);
  ui.marketplaceGrid.addEventListener("click", onMarketplaceAction);
  ui.marketplaceForm.addEventListener("submit", onSubmitMarketplaceOrder);
  ui.marketplaceDelivery.addEventListener("change", updateMarketplaceAddressRequirement);
  ui.cancelMarketplaceOrder.addEventListener("click", closeMarketplaceCheckout);
  ui.closeMarketplaceSuccess.addEventListener("click", closeMarketplaceCheckout);
  updateAddressRequirement();
  updateMarketplaceAddressRequirement();

  try {
    firebase = await getFirebaseServices();
    customerUser = await waitForInitialAuthUser(firebase.auth, firebase.authApi);

    if (!customerUser) {
      const credential = await firebase.authApi.signInAnonymously(firebase.auth);
      customerUser = credential.user;
    }

    ui.connectionStatus.hidden = true;
    ui.form.hidden = false;
    subscribeToMarketplace();
  } catch (error) {
    console.error(error);
    ui.connectionStatus.classList.add("is-error");
    ui.connectionStatus.textContent =
      "Beställningssystemet kunde inte ansluta. Försök igen senare eller kontakta Nailsbyy.g.";
  }
}

function subscribeToMarketplace() {
  unsubscribeMarketplace?.();
  unsubscribeMarketplace = firebase.firestoreApi.onSnapshot(
    firebase.firestoreApi.collection(firebase.db, "marketplaceItems"),
    (snapshot) => {
      marketplaceItems = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.status === "available")
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
      renderMarketplace();
    },
    (error) => {
      console.error(error);
      ui.marketplaceStatus.classList.add("is-error");
      ui.marketplaceStatus.textContent = "Marknadsplatsen kunde inte hämtas just nu.";
    }
  );
}

function renderMarketplace() {
  ui.marketplaceGrid.innerHTML = "";
  ui.marketplaceStatus.classList.remove("is-error");

  if (marketplaceItems.length === 0) {
    ui.marketplaceGrid.hidden = true;
    ui.marketplaceStatus.hidden = false;
    ui.marketplaceStatus.textContent = "Det finns inga saker till salu just nu. Titta gärna in igen!";
    return;
  }

  const fragment = document.createDocumentFragment();

  marketplaceItems.forEach((item) => {
    const card = document.createElement("article");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const price = document.createElement("strong");
    const shipping = document.createElement("small");
    const button = document.createElement("button");

    card.className = "marketplace-item";
    card.dataset.itemId = item.id;
    image.src = item.imageUrl;
    image.alt = item.title;
    image.loading = "lazy";
    body.className = "marketplace-item-body";
    title.textContent = item.title;
    description.textContent = item.description;
    price.textContent = `${Number(item.price) || 0} kr`;
    shipping.textContent = Number(item.shippingCost) > 0
      ? `Frakt ${Number(item.shippingCost)} kr tillkommer om den postas`
      : "Ingen fraktkostnad";
    button.type = "button";
    button.className = "primary marketplace-buy";
    button.dataset.action = "buy-marketplace-item";
    button.textContent = "Beställ";

    body.append(title, description, price, shipping, button);
    card.append(image, body);
    fragment.append(card);
  });

  ui.marketplaceGrid.append(fragment);
  ui.marketplaceGrid.hidden = false;
  ui.marketplaceStatus.hidden = true;
}

function onMarketplaceAction(event) {
  const button = event.target.closest('[data-action="buy-marketplace-item"]');
  const card = button?.closest(".marketplace-item");
  const item = marketplaceItems.find((entry) => entry.id === card?.dataset.itemId);

  if (!item) {
    return;
  }

  ui.marketplaceItemId.value = item.id;
  ui.marketplaceCheckoutTitle.textContent = item.title;
  ui.marketplaceCheckoutPrice.textContent =
    `${Number(item.price) || 0} kr + eventuell frakt`;
  ui.marketplaceCheckoutImage.src = item.imageUrl;
  ui.marketplaceCheckoutImage.alt = item.title;
  ui.marketplaceGrid.hidden = true;
  ui.marketplaceStatus.hidden = true;
  ui.marketplaceSuccess.hidden = true;
  ui.marketplaceForm.hidden = false;
  ui.marketplaceMessage.textContent = "";
  ui.marketplaceForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function onSubmitMarketplaceOrder(event) {
  event.preventDefault();

  if (!firebase || !customerUser) {
    return;
  }

  const formData = new FormData(ui.marketplaceForm);
  const itemId = clean(formData.get("marketplaceItemId"));
  const item = marketplaceItems.find((entry) => entry.id === itemId);

  if (!item) {
    ui.marketplaceMessage.textContent = "Varan är inte längre tillgänglig.";
    return;
  }

  const submitButton = ui.marketplaceForm.querySelector('button[type="submit"]');
  const orderReference = firebase.firestoreApi.doc(firebase.firestoreApi.collection(firebase.db, "orders"));
  const itemReference = firebase.firestoreApi.doc(firebase.db, "marketplaceItems", itemId);
  const now = Date.now();
  const deliveryMethod = clean(formData.get("deliveryMethod"));
  const shippingCost = deliveryMethod === "Hämtas" ? 0 : Number(item.shippingCost) || 0;
  const dueDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const order = {
    customer: clean(formData.get("customer")),
    contact: clean(formData.get("contact")),
    product: item.title,
    quantity: 1,
    deliveryMethod,
    address: clean(formData.get("address")),
    dueDate,
    notes: "",
    price: Number(item.price) || 0,
    weight: 0,
    shippingCost,
    status: "Ny",
    designImagePaths: [],
    approvedDesignImageUrls: [],
    moderationStatus: "approved",
    moderationReason: "",
    moderationUpdatedAt: now,
    source: "marketplace",
    orderType: "marketplace",
    marketplaceItemId: item.id,
    marketplaceImageUrl: item.imageUrl,
    paymentStatus: "Väntar på Swish",
    swishReference: "",
    customerId: customerUser.uid,
    createdAt: now,
    updatedAt: now
  };

  submitButton.disabled = true;
  submitButton.textContent = "Reserverar…";
  ui.marketplaceMessage.textContent = "";

  try {
    await firebase.firestoreApi.runTransaction(firebase.db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemReference);
      const currentItem = itemSnapshot.data();

      if (!itemSnapshot.exists() || currentItem?.status !== "available") {
        throw new Error("Varan hann tyvärr reserveras av någon annan.");
      }

      transaction.set(orderReference, order);
      transaction.set(itemReference, {
        ...currentItem,
        status: "reserved",
        reservedBy: customerUser.uid,
        reservedOrderId: orderReference.id,
        updatedAt: now
      });
    });

    ui.marketplaceOrderReference.textContent =
      `Referens: ${orderReference.id.slice(0, 8).toUpperCase()}`;
    ui.marketplaceSwishInstructions.textContent = getSwishInstructions();
    ui.marketplaceForm.hidden = true;
    ui.marketplaceSuccess.hidden = false;
    ui.marketplaceSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    ui.marketplaceMessage.textContent = toUserError(error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Reservera och beställ";
  }
}

function updateMarketplaceAddressRequirement() {
  const shouldPost = ui.marketplaceDelivery.value === "Postas";
  ui.marketplaceAddressGroup.hidden = !shouldPost;
  ui.marketplaceAddress.required = shouldPost;

  if (!shouldPost) {
    ui.marketplaceAddress.value = "";
  }
}

function closeMarketplaceCheckout() {
  ui.marketplaceForm.reset();
  ui.marketplaceItemId.value = "";
  ui.marketplaceMessage.textContent = "";
  ui.marketplaceForm.hidden = true;
  ui.marketplaceSuccess.hidden = true;
  updateMarketplaceAddressRequirement();
  renderMarketplace();
}

function getSwishInstructions() {
  const swishNumber = clean(window.MARKETPLACE_CONFIG?.swishNumber);

  if (swishNumber) {
    return `Swisha totalsumman till ${swishNumber} och skriv orderreferensen som meddelande.`;
  }

  return "Nailsbyy.g skickar Swish-nummer och totalsumma till kontaktuppgiften du fyllde i.";
}

function waitForInitialAuthUser(auth, authApi) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = authApi.onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
}

async function onSubmitOrder(event) {
  event.preventDefault();

  if (!firebase || !customerUser) {
    return;
  }

  const submitButton = ui.form.querySelector('button[type="submit"]');
  const formData = new FormData(ui.form);
  const imageValidation = validateImageSelection(selectedDesignFiles);

  if (!imageValidation.ok) {
    ui.formMessage.textContent = imageValidation.message;
    return;
  }

  const now = Date.now();
  const orderDraft = {
    customer: clean(formData.get("customer")),
    contact: clean(formData.get("contact")),
    product: clean(formData.get("product")),
    quantity: Number(formData.get("quantity")),
    deliveryMethod: clean(formData.get("deliveryMethod")),
    address: clean(formData.get("address")),
    dueDate: clean(formData.get("dueDate")),
    notes: clean(formData.get("notes")),
    price: 0,
    weight: 0,
    shippingCost: 0,
    status: "Ny",
    designImagePaths: [],
    approvedDesignImageUrls: [],
    moderationStatus: "approved",
    moderationReason: "",
    moderationUpdatedAt: now,
    source: "customer",
    orderType: "custom",
    marketplaceItemId: "",
    marketplaceImageUrl: "",
    paymentStatus: "Ej aktuell",
    swishReference: "",
    customerId: customerUser.uid,
    createdAt: now,
    updatedAt: now
  };

  submitButton.disabled = true;
  submitButton.textContent = "Skickar…";
  ui.formMessage.textContent = "";

  try {
    const reference = firebase.firestoreApi.doc(firebase.firestoreApi.collection(firebase.db, "orders"));
    const approvedDesignImageUrls = await uploadDesignImages(reference.id, imageValidation.files);
    const order = {
      ...orderDraft,
      approvedDesignImageUrls,
      moderationStatus: "approved"
    };

    await firebase.firestoreApi.setDoc(reference, order);

    ui.orderReference.textContent = `Referens: ${reference.id.slice(0, 8).toUpperCase()}`;
    ui.form.hidden = true;
    ui.success.hidden = false;
    ui.success.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    ui.formMessage.textContent = toUserError(error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Skicka beställning";
  }
}

function resetCustomerForm() {
  clearPreviewUrls();
  selectedDesignFiles = [];
  ui.imagePreview.innerHTML = "";
  ui.imagePreview.hidden = true;
  ui.form.reset();
  updateFileStatus([]);
  setMinimumDate();
  updateAddressRequirement();
  ui.formMessage.textContent = "";
  ui.success.hidden = true;
  ui.form.hidden = false;
  ui.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateAddressRequirement() {
  const shouldPost = ui.deliveryMethod.value === "Postas";
  ui.addressGroup.hidden = !shouldPost;
  ui.address.required = shouldPost;

  if (!shouldPost) {
    ui.address.value = "";
  }
}

function setMinimumDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const value = date.toISOString().slice(0, 10);
  ui.dueDate.min = value;
  ui.dueDate.value = value;
}

function onDesignImagesChange() {
  const validation = validateImageSelection(ui.designImages.files);

  if (!validation.ok) {
    ui.formMessage.textContent = validation.message;
    ui.designImages.value = "";
    selectedDesignFiles = [];
    clearPreviewUrls();
    ui.imagePreview.innerHTML = "";
    ui.imagePreview.hidden = true;
    updateFileStatus([]);
    return;
  }

  selectedDesignFiles = validation.files;
  ui.formMessage.textContent = "";
  updateFileStatus(selectedDesignFiles);
  renderImagePreview(selectedDesignFiles);
}

function onPreviewAction(event) {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;

  if (action !== "remove-image") {
    return;
  }

  const index = Number(target.dataset.index);

  if (!Number.isInteger(index) || index < 0 || index >= selectedDesignFiles.length) {
    return;
  }

  selectedDesignFiles.splice(index, 1);
  syncFileInputFromSelection();
  updateFileStatus(selectedDesignFiles);
  renderImagePreview(selectedDesignFiles);
}

function updateFileStatus(files) {
  if (files.length === 0) {
    ui.fileStatus.textContent = "Inga bilder valda";
    return;
  }

  ui.fileStatus.textContent = files.length === 1 ? "1 bild vald" : `${files.length} bilder valda`;
}

function validateImageSelection(fileList) {
  const files = Array.from(fileList || []);

  if (files.length > MAX_UPLOAD_IMAGES) {
    return {
      ok: false,
      files: [],
      message: `Välj högst ${MAX_UPLOAD_IMAGES} bilder.`
    };
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return {
        ok: false,
        files: [],
        message: "Alla uppladdade filer måste vara bilder."
      };
    }

    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        files: [],
        message: "En eller flera bilder är större än 5 MB."
      };
    }
  }

  return {
    ok: true,
    files,
    message: ""
  };
}

function renderImagePreview(files) {
  clearPreviewUrls();
  ui.imagePreview.innerHTML = "";

  if (files.length === 0) {
    ui.imagePreview.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();

  files.forEach((file, index) => {
    const objectUrl = URL.createObjectURL(file);
    previewUrls.push(objectUrl);

    const wrapper = document.createElement("div");
    wrapper.className = "customer-preview-item";

    const img = document.createElement("img");
    img.className = "customer-preview-thumb";
    img.src = objectUrl;
    img.alt = `Förhandsvisning: ${file.name}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "customer-preview-remove";
    removeButton.dataset.action = "remove-image";
    removeButton.dataset.index = String(index);
    removeButton.setAttribute("aria-label", `Ta bort bild ${index + 1}`);
    removeButton.textContent = "Ta bort";

    wrapper.append(img, removeButton);
    fragment.append(wrapper);
  });

  ui.imagePreview.append(fragment);
  ui.imagePreview.hidden = false;
}

async function uploadDesignImages(orderId, files) {
  if (files.length === 0) {
    return [];
  }

  const cloudinary = getCloudinaryConfig();

  if (cloudinary.signEndpoint) {
    return uploadDesignImagesSigned(orderId, files, cloudinary);
  }

  return uploadDesignImagesUnsigned(orderId, files, cloudinary);
}

async function uploadDesignImagesSigned(orderId, files, cloudinary) {
  const uploads = files.map(async (file, index) => {
    const signed = await requestCloudinarySignature(orderId, index, cloudinary.folder, cloudinary.signEndpoint);
    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", signed.apiKey);
    formData.append("timestamp", String(signed.timestamp));
    formData.append("signature", signed.signature);
    formData.append("folder", signed.folder);
    formData.append("public_id", signed.publicId);
    formData.append("max_file_size", String(signed.maxFileSize));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signed.cloudName || cloudinary.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const result = await readJsonSafe(response);

    if (!response.ok) {
      const cloudinaryMessage = readCloudinaryError(result);
      throw new Error(cloudinaryMessage || "Signerad Cloudinary-uppladdning misslyckades.");
    }

    if (!result.secure_url) {
      throw new Error("Cloudinary svarade utan bild-URL.");
    }

    return result.secure_url;
  });

  return Promise.all(uploads);
}

async function uploadDesignImagesUnsigned(orderId, files, cloudinary) {
  if (!cloudinary.uploadPreset) {
    throw new Error("Cloudinary uploadPreset saknas.");
  }

  const uploads = files.map(async (file, index) => {
    const formData = new FormData();
    const timestamp = Date.now();
    const publicId = `${orderId}_${timestamp}_${index}`;

    formData.append("file", file);
    formData.append("upload_preset", cloudinary.uploadPreset);
    formData.append("folder", cloudinary.folder);
    formData.append("public_id", publicId);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const result = await readJsonSafe(response);

    if (!response.ok) {
      const cloudinaryMessage = readCloudinaryError(result);
      throw new Error(cloudinaryMessage || "Cloudinary-uppladdning misslyckades.");
    }

    if (!result.secure_url) {
      throw new Error("Cloudinary svarade utan bild-URL.");
    }

    return result.secure_url;
  });

  return Promise.all(uploads);
}

async function requestCloudinarySignature(orderId, fileIndex, folder, signEndpoint) {
  const idToken = await customerUser.getIdToken();
  const response = await fetch(signEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      orderId,
      fileIndex,
      folder
    })
  });

  const result = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(result?.error || "Kunde inte skapa signatur för bilduppladdning.");
  }

  return result;
}

function getCloudinaryConfig() {
  const config = window.CLOUDINARY_CONFIG;

  if (!config || typeof config !== "object") {
    throw new Error("Cloudinary är inte konfigurerat.");
  }

  const cloudName = clean(config.cloudName);
  const uploadPreset = clean(config.uploadPreset);
  const signEndpoint = clean(config.signEndpoint);
  const folder = clean(config.folder) || "nailsbyyg-orders";

  if (!cloudName && !signEndpoint) {
    throw new Error("Cloudinary kräver cloudName eller signEndpoint.");
  }

  return {
    cloudName,
    uploadPreset,
    signEndpoint,
    folder
  };
}

function clearPreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function syncFileInputFromSelection() {
  if (typeof DataTransfer === "undefined") {
    return;
  }

  const transfer = new DataTransfer();
  selectedDesignFiles.forEach((file) => transfer.items.add(file));
  ui.designImages.files = transfer.files;
}

function clean(value) {
  return String(value || "").trim();
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readCloudinaryError(result) {
  if (!result) {
    return "";
  }

  if (typeof result.error === "string") {
    return result.error;
  }

  if (result.error && typeof result.error.message === "string") {
    return result.error.message;
  }

  return "";
}

function toUserError(error) {
  const message = clean(error?.message);

  if (!message) {
    return "Beställningen kunde inte skickas. Kontrollera anslutningen och försök igen.";
  }

  if (/upload preset/i.test(message)) {
    return "Cloudinary-preseten verkar felkonfigurerad. Kontrollera upload preset och allowed origins.";
  }

  if (/cors|origin/i.test(message)) {
    return "Cloudinary blockerar denna domän. Lägg till semigul.github.io i allowed origins.";
  }

  if (/permission|missing or insufficient permissions|firestore/i.test(message)) {
    return "Behörighet nekades i Firebase. Kontrollera Firestore-rules och inloggning.";
  }

  return `Fel: ${message}`;
}
