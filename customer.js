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
  imagePreview: document.getElementById("customerImagePreview")
};

let firebase;
let customerUser;
let previewUrls = [];
let selectedDesignFiles = [];

init();

async function init() {
  setMinimumDate();
  ui.form.addEventListener("submit", onSubmitOrder);
  ui.newOrderButton.addEventListener("click", resetCustomerForm);
  ui.deliveryMethod.addEventListener("change", updateAddressRequirement);
  ui.designImages.addEventListener("change", onDesignImagesChange);
  ui.imagePreview.addEventListener("click", onPreviewAction);
  updateAddressRequirement();

  try {
    firebase = await getFirebaseServices();
    customerUser = firebase.auth.currentUser;

    if (!customerUser) {
      const credential = await firebase.authApi.signInAnonymously(firebase.auth);
      customerUser = credential.user;
    }

    ui.connectionStatus.hidden = true;
    ui.form.hidden = false;
  } catch (error) {
    console.error(error);
    ui.connectionStatus.classList.add("is-error");
    ui.connectionStatus.textContent =
      "Beställningssystemet kunde inte ansluta. Försök igen senare eller kontakta Nailsbyy.g.";
  }
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
    ui.formMessage.textContent = "Beställningen kunde inte skickas. Kontrollera anslutningen och försök igen.";
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
    return;
  }

  selectedDesignFiles = validation.files;
  ui.formMessage.textContent = "";
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
  renderImagePreview(selectedDesignFiles);
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

    if (!response.ok) {
      throw new Error("Signerad Cloudinary-uppladdning misslyckades.");
    }

    const result = await response.json();

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

    if (!response.ok) {
      throw new Error("Cloudinary-uppladdning misslyckades.");
    }

    const result = await response.json();

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

  if (!response.ok) {
    throw new Error("Kunde inte skapa signatur för bilduppladdning.");
  }

  return response.json();
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
