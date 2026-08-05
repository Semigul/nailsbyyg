import { getFirebaseServices } from "./firebase-client.mjs";

const state = {
  items: []
};

const ui = {
  authCard: document.getElementById("marketplaceAdminAuthCard"),
  loginForm: document.getElementById("marketplaceAdminLoginForm"),
  loginButton: document.getElementById("marketplaceAdminLoginButton"),
  rememberMe: document.getElementById("marketplaceAdminRememberMe"),
  authMessage: document.getElementById("marketplaceAdminAuthMessage"),
  connectionBadge: document.getElementById("marketplaceAdminConnectionBadge"),
  signOutButton: document.getElementById("marketplaceAdminSignOut"),
  content: document.querySelectorAll(".marketplace-admin-content"),
  form: document.getElementById("marketplaceItemForm"),
  itemId: document.getElementById("marketplaceAdminItemId"),
  title: document.getElementById("marketplaceAdminTitle"),
  description: document.getElementById("marketplaceAdminDescription"),
  price: document.getElementById("marketplaceAdminPrice"),
  shipping: document.getElementById("marketplaceAdminShipping"),
  image: document.getElementById("marketplaceAdminImage"),
  imagePreview: document.getElementById("marketplaceAdminImagePreview"),
  status: document.getElementById("marketplaceAdminStatus"),
  saveButton: document.getElementById("marketplaceAdminSave"),
  resetButton: document.getElementById("marketplaceAdminReset"),
  message: document.getElementById("marketplaceAdminMessage"),
  list: document.getElementById("marketplaceAdminList")
};

let firebase;
let unsubscribeItems;

init();

async function init() {
  bindEvents();
  renderItems();
  await connectAdmin();
}

function bindEvents() {
  ui.loginForm.addEventListener("submit", onLogin);
  ui.signOutButton.addEventListener("click", onSignOut);
  ui.form.addEventListener("submit", onSaveItem);
  ui.resetButton.addEventListener("click", resetForm);
  ui.image.addEventListener("change", previewImage);
  ui.list.addEventListener("click", onItemAction);
}

async function connectAdmin() {
  try {
    firebase = await getFirebaseServices();
    ui.loginButton.disabled = false;
    ui.connectionBadge.textContent = "Firebase redo";

    firebase.authApi.onAuthStateChanged(firebase.auth, async (user) => {
      if (!user || user.isAnonymous) {
        if (user?.isAnonymous) {
          await firebase.authApi.signOut(firebase.auth);
        }

        stopSubscription();
        showAdmin(false);
        return;
      }

      await verifyAndOpenAdmin(user);
    });
  } catch (error) {
    console.error(error);
    ui.connectionBadge.textContent = "Firebase kunde inte ansluta";
    ui.connectionBadge.classList.add("is-error");
    ui.authMessage.textContent =
      "Kontrollera Firebase-konfigurationen och internetanslutningen och ladda sedan om sidan.";
  }
}

async function onLogin(event) {
  event.preventDefault();

  if (!firebase) {
    return;
  }

  const formData = new FormData(ui.loginForm);
  ui.loginButton.disabled = true;
  ui.loginButton.textContent = "Loggar in…";
  ui.authMessage.textContent = "";

  try {
    const persistence = ui.rememberMe.checked
      ? firebase.authApi.browserLocalPersistence
      : firebase.authApi.browserSessionPersistence;

    await firebase.authApi.setPersistence(firebase.auth, persistence);
    await firebase.authApi.signInWithEmailAndPassword(
      firebase.auth,
      clean(formData.get("email")),
      clean(formData.get("password"))
    );
  } catch (error) {
    console.error(error);
    ui.authMessage.textContent = authErrorMessage(error);
  } finally {
    ui.loginButton.disabled = false;
    ui.loginButton.textContent = "Logga in";
  }
}

async function onSignOut() {
  if (!firebase) {
    return;
  }

  await firebase.authApi.signOut(firebase.auth);
  ui.loginForm.reset();
  ui.authMessage.textContent = "";
}

async function verifyAndOpenAdmin(user) {
  try {
    const adminSnapshot = await firebase.firestoreApi.getDoc(
      firebase.firestoreApi.doc(firebase.db, "admins", user.uid)
    );

    if (!adminSnapshot.exists() || adminSnapshot.data().role !== "admin") {
      await firebase.authApi.signOut(firebase.auth);
      ui.authMessage.textContent =
        "Kontot saknar adminbehörighet. Kontrollera att UID:t finns som dokument i collectionen admins.";
      return;
    }

    ui.connectionBadge.textContent = "Firebase synkad";
    ui.connectionBadge.classList.remove("is-error");
    showAdmin(true);
    subscribeToItems();
  } catch (error) {
    console.error(error);
    ui.authMessage.textContent =
      "Adminbehörigheten kunde inte verifieras. Kontrollera dokumentet i admins och Firestore-reglerna.";
  }
}

function showAdmin(isVisible) {
  ui.authCard.hidden = isVisible;
  ui.signOutButton.hidden = !isVisible;
  ui.content.forEach((element) => {
    element.hidden = !isVisible;
  });

  if (!isVisible) {
    state.items = [];
    renderItems();
    resetForm();
  }
}

function subscribeToItems() {
  stopSubscription();
  unsubscribeItems = firebase.firestoreApi.onSnapshot(
    firebase.firestoreApi.collection(firebase.db, "marketplaceItems"),
    (snapshot) => {
      state.items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
      renderItems();
    },
    (error) => {
      console.error(error);
      ui.message.textContent = "Kunde inte synka marknadsplatsen.";
    }
  );
}

function stopSubscription() {
  if (unsubscribeItems) {
    unsubscribeItems();
    unsubscribeItems = undefined;
  }
}

async function onSaveItem(event) {
  event.preventDefault();

  if (!firebase?.auth.currentUser) {
    return;
  }

  const formData = new FormData(ui.form);
  const id = ui.itemId.value || `item_${Date.now()}_${Math.round(Math.random() * 10000)}`;
  const existingItem = state.items.find((item) => item.id === id);
  const imageFile = ui.image.files?.[0];

  if (!existingItem && !imageFile) {
    ui.message.textContent = "Välj en bild på varan.";
    return;
  }

  if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 5 * 1024 * 1024)) {
    ui.message.textContent = "Bilden måste vara en bildfil och högst 5 MB.";
    return;
  }

  ui.saveButton.disabled = true;
  ui.saveButton.textContent = imageFile ? "Laddar upp…" : "Sparar…";
  ui.message.textContent = "";

  try {
    const imageUrl = imageFile
      ? await uploadImage(id, imageFile)
      : existingItem.imageUrl;
    const now = Date.now();
    const item = {
      id,
      title: clean(formData.get("title")),
      description: clean(formData.get("description")),
      price: Math.max(0, Number(formData.get("price")) || 0),
      shippingCost: Math.max(0, Number(formData.get("shippingCost")) || 0),
      imageUrl,
      status: clean(formData.get("itemStatus")) || "available",
      reservedBy: existingItem?.reservedBy || "",
      reservedOrderId: existingItem?.reservedOrderId || "",
      createdAt: existingItem?.createdAt || now,
      updatedAt: now
    };

    if (item.status === "available") {
      item.reservedBy = "";
      item.reservedOrderId = "";
    }

    await firebase.firestoreApi.setDoc(
      firebase.firestoreApi.doc(firebase.db, "marketplaceItems", id),
      item
    );
    resetForm();
  } catch (error) {
    console.error(error);
    ui.message.textContent = `Varan kunde inte sparas: ${clean(error?.message)}`;
  } finally {
    ui.saveButton.disabled = false;
    ui.saveButton.textContent = "Publicera vara";
  }
}

function renderItems() {
  ui.list.innerHTML = "";

  if (state.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Inga begagnade saker är publicerade ännu.";
    ui.list.append(empty);
    return;
  }

  state.items.forEach((item) => {
    const card = document.createElement("article");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    const actions = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    card.className = "marketplace-admin-item";
    card.dataset.itemId = item.id;
    image.src = item.imageUrl;
    image.alt = item.title;
    body.className = "marketplace-admin-item-body";
    title.textContent = item.title;
    meta.textContent =
      `${Number(item.price) || 0} kr • Frakt ${Number(item.shippingCost) || 0} kr • ${statusLabel(item.status)}`;
    actions.className = "item-actions";
    editButton.type = "button";
    editButton.className = "mini";
    editButton.dataset.action = "edit-marketplace-item";
    editButton.textContent = "Redigera";
    deleteButton.type = "button";
    deleteButton.className = "mini danger";
    deleteButton.dataset.action = "delete-marketplace-item";
    deleteButton.textContent = "Ta bort";
    actions.append(editButton, deleteButton);
    body.append(title, meta, actions);
    card.append(image, body);
    ui.list.append(card);
  });
}

async function onItemAction(event) {
  const button = event.target.closest("button[data-action]");
  const card = button?.closest(".marketplace-admin-item");
  const item = state.items.find((entry) => entry.id === card?.dataset.itemId);

  if (!item) {
    return;
  }

  if (button.dataset.action === "edit-marketplace-item") {
    ui.itemId.value = item.id;
    ui.title.value = item.title;
    ui.description.value = item.description;
    ui.price.value = String(item.price);
    ui.shipping.value = String(item.shippingCost);
    ui.status.value = item.status;
    ui.imagePreview.src = item.imageUrl;
    ui.imagePreview.alt = item.title;
    ui.imagePreview.hidden = false;
    ui.saveButton.textContent = "Spara ändringar";
    ui.form.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete-marketplace-item") {
    const shouldDelete = window.confirm(`Ta bort "${item.title}" från marknadsplatsen?`);

    if (!shouldDelete) {
      return;
    }

    try {
      await firebase.firestoreApi.deleteDoc(
        firebase.firestoreApi.doc(firebase.db, "marketplaceItems", item.id)
      );
    } catch (error) {
      console.error(error);
      ui.message.textContent = "Varan kunde inte tas bort.";
    }
  }
}

function resetForm() {
  ui.form.reset();
  ui.itemId.value = "";
  ui.shipping.value = "0";
  ui.status.value = "available";
  ui.imagePreview.hidden = true;
  ui.imagePreview.removeAttribute("src");
  ui.message.textContent = "";
  ui.saveButton.textContent = "Publicera vara";
}

function previewImage() {
  const file = ui.image.files?.[0];

  if (!file) {
    return;
  }

  ui.imagePreview.src = URL.createObjectURL(file);
  ui.imagePreview.alt = "Förhandsvisning av varan";
  ui.imagePreview.hidden = false;
}

async function uploadImage(itemId, file) {
  const config = window.CLOUDINARY_CONFIG || {};
  const cloudName = clean(config.cloudName);
  const signEndpoint = clean(config.signEndpoint);
  const uploadPreset = clean(config.uploadPreset);
  const folder = `${clean(config.folder) || "nailsbyyg-orders"}/marketplace`;
  const formData = new FormData();

  formData.append("file", file);

  if (signEndpoint) {
    const idToken = await firebase.auth.currentUser.getIdToken();
    const signatureResponse = await fetch(signEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ orderId: itemId, fileIndex: 0, folder })
    });
    const signed = await signatureResponse.json();

    if (!signatureResponse.ok) {
      throw new Error(signed?.error || "Cloudinary-signeringen misslyckades.");
    }

    formData.append("api_key", signed.apiKey);
    formData.append("timestamp", String(signed.timestamp));
    formData.append("signature", signed.signature);
    formData.append("folder", signed.folder);
    formData.append("public_id", signed.publicId);
    formData.append("max_file_size", String(signed.maxFileSize));

    return sendImage(signed.cloudName || cloudName, formData);
  }

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary är inte konfigurerat.");
  }

  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("public_id", `${itemId}_${Date.now()}`);
  return sendImage(cloudName, formData);
}

async function sendImage(cloudName, formData) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || "Bilduppladdningen misslyckades.");
  }

  return result.secure_url;
}

function statusLabel(status) {
  return {
    available: "Tillgänglig",
    reserved: "Reserverad",
    sold: "Såld"
  }[status] || status;
}

function clean(value) {
  return String(value || "").trim();
}

function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Fel e-postadress eller lösenord.";
    case "auth/too-many-requests":
      return "För många försök. Vänta en stund och försök igen.";
    case "auth/network-request-failed":
      return "Kunde inte nå Firebase. Kontrollera internetanslutningen.";
    default:
      return "Inloggningen misslyckades. Kontrollera uppgifterna och försök igen.";
  }
}
