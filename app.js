import { getFirebaseServices } from "./firebase-client.mjs";
import { formatWeightLimit, getPostNordLetterRate } from "./postnord-rates.mjs";

const STORAGE_KEY = "orderkompis.orders.v1";
const VIEW_KEY = "orderkompis.view.v1";
const STATUS_FLOW = ["Ny", "Pågår", "Klar", "Levererad"];
const filterLabels = ["Alla", ...STATUS_FLOW];

const state = {
  orders: [],
  currentFilter: "Alla",
  currentView: loadView()
};

const ui = {
  adminAuthCard: document.getElementById("adminAuthCard"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminLoginButton: document.getElementById("adminLoginButton"),
  adminRememberMe: document.getElementById("adminRememberMe"),
  adminAuthMessage: document.getElementById("adminAuthMessage"),
  connectionBadge: document.getElementById("connectionBadge"),
  signOutButton: document.getElementById("signOutButton"),
  adminContent: document.querySelectorAll(".admin-content"),
  form: document.getElementById("orderForm"),
  formTitle: document.getElementById("formTitle"),
  orderId: document.getElementById("orderId"),
  customer: document.getElementById("customer"),
  contact: document.getElementById("contact"),
  address: document.getElementById("address"),
  product: document.getElementById("product"),
  quantity: document.getElementById("quantity"),
  price: document.getElementById("price"),
  weight: document.getElementById("weight"),
  shippingEstimate: document.getElementById("shippingEstimate"),
  shippingHint: document.getElementById("shippingHint"),
  dueDate: document.getElementById("dueDate"),
  deliveryMethod: document.getElementById("deliveryMethod"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes"),
  resetButton: document.getElementById("resetButton"),
  newOrderShortcut: document.getElementById("newOrderShortcut"),
  filterCard: document.getElementById("filterCard"),
  ordersList: document.getElementById("ordersList"),
  kanbanBoard: document.getElementById("kanbanBoard"),
  viewButtons: document.querySelectorAll("[data-view]"),
  statusChips: document.getElementById("statusChips"),
  totalCount: document.getElementById("totalCount"),
  activeCount: document.getElementById("activeCount"),
  doneCount: document.getElementById("doneCount"),
  orderTemplate: document.getElementById("orderTemplate")
};

let firebase;
let unsubscribeOrders;

init();

async function init() {
  setDefaultDate();
  buildFilterChips();
  bindEvents();
  render();
  await connectAdmin();
}

function bindEvents() {
  ui.adminLoginForm.addEventListener("submit", onAdminLogin);
  ui.signOutButton.addEventListener("click", onAdminSignOut);
  ui.form.addEventListener("submit", onSaveOrder);
  ui.weight.addEventListener("input", updateShippingEstimate);
  ui.resetButton.addEventListener("click", resetForm);
  ui.newOrderShortcut.addEventListener("click", onNewOrderShortcut);
  ui.statusChips.addEventListener("click", onFilterClick);
  ui.ordersList.addEventListener("click", onOrderAction);
  ui.kanbanBoard.addEventListener("click", onOrderAction);
  ui.kanbanBoard.addEventListener("dragstart", onDragStart);
  ui.kanbanBoard.addEventListener("dragover", onDragOver);
  ui.kanbanBoard.addEventListener("dragleave", onDragLeave);
  ui.kanbanBoard.addEventListener("drop", onDrop);
  ui.kanbanBoard.addEventListener("dragend", clearDropTargets);
  ui.viewButtons.forEach((button) => button.addEventListener("click", onViewChange));
}

async function connectAdmin() {
  try {
    firebase = await getFirebaseServices();
    ui.adminLoginButton.disabled = false;
    ui.connectionBadge.textContent = "Firebase redo";

    firebase.authApi.onAuthStateChanged(firebase.auth, async (user) => {
      if (!user || user.isAnonymous) {
        if (user?.isAnonymous) {
          await firebase.authApi.signOut(firebase.auth);
        }

        stopOrderSubscription();
        showAdmin(false);
        return;
      }

      await verifyAndOpenAdmin(user);
    });
  } catch (error) {
    console.error(error);
    ui.connectionBadge.textContent = "Firebase kunde inte ansluta";
    ui.connectionBadge.classList.add("is-error");
    ui.adminAuthMessage.textContent =
      "Kontrollera Firebase-konfigurationen och internetanslutningen och ladda sedan om sidan.";
  }
}

async function onAdminLogin(event) {
  event.preventDefault();

  if (!firebase) {
    return;
  }

  const formData = new FormData(ui.adminLoginForm);
  ui.adminLoginButton.disabled = true;
  ui.adminLoginButton.textContent = "Loggar in…";
  ui.adminAuthMessage.textContent = "";

  try {
    const persistence = ui.adminRememberMe.checked
      ? firebase.authApi.browserLocalPersistence
      : firebase.authApi.browserSessionPersistence;

    await firebase.authApi.setPersistence(firebase.auth, persistence);
    await firebase.authApi.signInWithEmailAndPassword(
      firebase.auth,
      asString(formData.get("email")),
      asString(formData.get("password"))
    );
  } catch (error) {
    console.error(error);
    ui.adminAuthMessage.textContent = authErrorMessage(error);
  } finally {
    ui.adminLoginButton.disabled = false;
    ui.adminLoginButton.textContent = "Logga in";
  }
}

async function onAdminSignOut() {
  if (!firebase) {
    return;
  }

  await firebase.authApi.signOut(firebase.auth);
  ui.adminLoginForm.reset();
  ui.adminAuthMessage.textContent = "";
}

async function verifyAndOpenAdmin(user) {
  try {
    const adminSnapshot = await firebase.firestoreApi.getDoc(
      firebase.firestoreApi.doc(firebase.db, "admins", user.uid)
    );

    if (!adminSnapshot.exists() || adminSnapshot.data().role !== "admin") {
      await firebase.authApi.signOut(firebase.auth);
      ui.adminAuthMessage.textContent =
        "Kontot saknar adminbehörighet. Kontrollera att UID:t finns som dokument i collectionen admins.";
      return;
    }

    ui.connectionBadge.textContent = "Firebase synkad";
    ui.connectionBadge.classList.remove("is-error");
    showAdmin(true);
    await migrateLegacyOrders();
    subscribeToOrders();
  } catch (error) {
    console.error(error);
    ui.adminAuthMessage.textContent =
      "Adminbehörigheten kunde inte verifieras. Kontrollera dokumentet i admins och Firestore-reglerna.";
  }
}

function showAdmin(isVisible) {
  ui.adminAuthCard.hidden = isVisible;
  ui.signOutButton.hidden = !isVisible;
  ui.adminContent.forEach((element) => {
    element.hidden = !isVisible;
  });

  if (!isVisible) {
    state.orders = [];
    render();
  }
}

function subscribeToOrders() {
  stopOrderSubscription();

  const ordersQuery = firebase.firestoreApi.query(
    firebase.firestoreApi.collection(firebase.db, "orders"),
    firebase.firestoreApi.orderBy("updatedAt", "desc")
  );

  unsubscribeOrders = firebase.firestoreApi.onSnapshot(
    ordersQuery,
    (snapshot) => {
      state.orders = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }));
      render();
    },
    (error) => {
      console.error(error);
      ui.connectionBadge.textContent = "Synkfel";
      ui.connectionBadge.classList.add("is-error");
    }
  );
}

function stopOrderSubscription() {
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = undefined;
  }
}

function onNewOrderShortcut() {
  resetForm();
  ui.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildFilterChips() {
  ui.statusChips.innerHTML = "";

  filterLabels.forEach((label) => {
    const button = document.createElement("button");
    button.className = `chip ${label === state.currentFilter ? "active" : ""}`;
    button.type = "button";
    button.dataset.filter = label;
    button.textContent = label;
    ui.statusChips.append(button);
  });
}

function onFilterClick(event) {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const filter = target.dataset.filter;

  if (!filter) {
    return;
  }

  state.currentFilter = filter;
  buildFilterChips();
  renderOrders();
}

function onViewChange(event) {
  const view = event.currentTarget.dataset.view;

  if (view !== "board" && view !== "list") {
    return;
  }

  state.currentView = view;
  localStorage.setItem(VIEW_KEY, view);
  renderOrders();
}

async function onSaveOrder(event) {
  event.preventDefault();

  if (!firebase?.auth.currentUser) {
    return;
  }

  const formData = new FormData(ui.form);
  const id = ui.orderId.value || createId();
  const weight = Number(formData.get("weight")) || 0;
  const shippingRate = getPostNordLetterRate(weight);
  const existingOrder = state.orders.find((item) => item.id === id);
  const now = Date.now();

  const order = {
    id,
    customer: asString(formData.get("customer")),
    contact: asString(formData.get("contact")),
    address: asString(formData.get("address")),
    product: asString(formData.get("product")),
    quantity: Number(formData.get("quantity")),
    price: Number(formData.get("price")),
    weight,
    shippingCost: shippingRate?.price || 0,
    dueDate: asString(formData.get("dueDate")),
    deliveryMethod: asString(formData.get("deliveryMethod")),
    status: asString(formData.get("status")),
    notes: asString(formData.get("notes")),
    designImagePaths: Array.isArray(existingOrder?.designImagePaths) ? existingOrder.designImagePaths : [],
    approvedDesignImageUrls: Array.isArray(existingOrder?.approvedDesignImageUrls)
      ? existingOrder.approvedDesignImageUrls
      : [],
    moderationStatus: asString(existingOrder?.moderationStatus) || "approved",
    moderationReason: asString(existingOrder?.moderationReason),
    moderationUpdatedAt: Number(existingOrder?.moderationUpdatedAt) || now,
    source: existingOrder?.source || "admin",
    customerId: existingOrder?.customerId || null,
    createdAt: existingOrder?.createdAt || now,
    updatedAt: now
  };

  ui.form.querySelector('button[type="submit"]').disabled = true;

  try {
    await persistOrder(order);
    resetForm();
  } catch (error) {
    console.error(error);
    window.alert("Ordern kunde inte sparas i Firebase. Försök igen.");
  } finally {
    ui.form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function onOrderAction(event) {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  const card = target.closest(".order-item");

  if (!action || !card) {
    return;
  }

  const orderId = card.dataset.orderId;

  if (!orderId) {
    return;
  }

  if (action === "delete") {
    const shouldDelete = window.confirm("Ta bort ordern?");

    if (!shouldDelete) {
      return;
    }

    try {
      await firebase.firestoreApi.deleteDoc(firebase.firestoreApi.doc(firebase.db, "orders", orderId));
    } catch (error) {
      console.error(error);
      window.alert("Ordern kunde inte tas bort. Försök igen.");
    }
    return;
  }

  const order = state.orders.find((item) => item.id === orderId);

  if (!order) {
    return;
  }

  if (action === "edit") {
    fillForm(order);
    return;
  }

  if (action === "next") {
    try {
      await persistOrder({
        ...order,
        status: nextStatus(order.status),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error(error);
      window.alert("Orderns status kunde inte uppdateras.");
    }
  }
}

function fillForm(order) {
  ui.formTitle.textContent = "Redigera order";
  ui.orderId.value = order.id;
  ui.customer.value = order.customer;
  ui.contact.value = order.contact || "";
  ui.address.value = order.address || "";
  ui.product.value = order.product;
  ui.quantity.value = String(order.quantity);
  ui.price.value = String(order.price);
  ui.weight.value = order.weight ? String(order.weight) : "";
  ui.dueDate.value = order.dueDate;
  ui.deliveryMethod.value = order.deliveryMethod || "Postas";
  ui.status.value = order.status;
  ui.notes.value = order.notes;
  updateShippingEstimate();
  ui.customer.scrollIntoView({ behavior: "smooth", block: "center" });
  ui.customer.focus();
}

function resetForm() {
  ui.form.reset();
  ui.formTitle.textContent = "Ny order";
  ui.orderId.value = "";
  setDefaultDate();
  ui.deliveryMethod.value = "Postas";
  ui.status.value = "Ny";
  updateShippingEstimate();
}

function render() {
  renderOrders();
  renderSummary();
}

function renderOrders() {
  const isBoard = state.currentView === "board";

  document.body.classList.toggle("board-view-active", isBoard);
  ui.kanbanBoard.hidden = !isBoard;
  ui.ordersList.hidden = isBoard;
  ui.filterCard.hidden = isBoard;

  ui.viewButtons.forEach((button) => {
    const isActive = button.dataset.view === state.currentView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (isBoard) {
    renderKanbanBoard();
  } else {
    renderOrderList();
  }
}

function renderOrderList() {
  const orders = visibleOrders();
  ui.ordersList.innerHTML = "";

  if (orders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Inga ordrar här ännu.";
    ui.ordersList.append(empty);
    return;
  }

  orders.forEach((order) => {
    ui.ordersList.append(createOrderCard(order));
  });
}

function renderKanbanBoard() {
  ui.kanbanBoard.innerHTML = "";

  STATUS_FLOW.forEach((statusName) => {
    const orders = state.orders.filter((order) => order.status === statusName);
    const column = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("h3");
    const count = document.createElement("span");
    const list = document.createElement("div");

    column.className = "kanban-column";
    column.dataset.status = statusName;
    header.className = "kanban-column-header";
    title.className = "kanban-column-title";
    count.className = "kanban-count";
    list.className = "kanban-list";

    title.textContent = statusName;
    count.textContent = String(orders.length);
    count.setAttribute("aria-label", `${orders.length} ordrar`);
    header.append(title, count);

    if (orders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "kanban-empty";
      empty.textContent = "Inga ordrar i detta steg";
      list.append(empty);
    } else {
      orders.forEach((order) => list.append(createOrderCard(order, true)));
    }

    column.append(header, list);
    ui.kanbanBoard.append(column);
  });
}

function createOrderCard(order, isDraggable = false) {
  const fragment = ui.orderTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".order-item");
  const title = fragment.querySelector(".order-title");
  const status = fragment.querySelector(".order-status");
  const contact = fragment.querySelector(".order-contact");
  const address = fragment.querySelector(".order-address");
  const meta = fragment.querySelector(".order-meta");
  const notes = fragment.querySelector(".order-notes");
  const orderImages = fragment.querySelector(".order-images");
  const nextButton = fragment.querySelector('[data-action="next"]');

  card.dataset.orderId = order.id;
  card.draggable = isDraggable;

  if (isDraggable) {
    card.title = "Dra kortet till ett annat steg";
  }

  title.textContent = `${order.customer} • ${order.product}`;
  status.textContent = order.status;
  status.classList.add(`status-${order.status}`);

  if (order.contact) {
    contact.textContent = `Kontakt: ${order.contact}`;
  } else {
    contact.remove();
  }

  if (order.address) {
    address.textContent = `Adress: ${order.address}`;
  } else {
    address.remove();
  }

  const total = order.quantity * order.price;
  const weight = Number(order.weight) || 0;
  const currentShippingRate = getPostNordLetterRate(weight);
  const shippingCost = Number.isFinite(Number(order.shippingCost))
    ? Number(order.shippingCost)
    : currentShippingRate?.price || 0;
  const totalWithShipping = total + shippingCost;
  const weightText = weight > 0 ? `${weight} g` : "Ingen vikt";
  const deliveryMethod = order.deliveryMethod || "Postas";

  meta.textContent = isDraggable
    ? `${deliveryMethod} • ${weightText} • Frakt ${shippingCost} kr • Totalt ${totalWithShipping} kr • ${formatDate(order.dueDate)}`
    : `${order.quantity} st • ${deliveryMethod} • Varor ${total} kr • Frakt ${shippingCost} kr • Totalt ${totalWithShipping} kr • Klart ${formatDate(order.dueDate)}`;

  if (order.status === "Levererad") {
    nextButton.disabled = true;
    nextButton.textContent = "Slutförd";
  }

  if (order.notes) {
    notes.textContent = order.notes;
  } else {
    notes.remove();
  }

  const moderationStatus = asString(order.moderationStatus) || "approved";
  const legacyDesignImageUrls = Array.isArray(order.designImageUrls) ? order.designImageUrls : [];
  const approvedDesignImageUrls = Array.isArray(order.approvedDesignImageUrls)
    ? order.approvedDesignImageUrls
    : [];
  const visibleImageUrls = approvedDesignImageUrls.length > 0
    ? approvedDesignImageUrls
    : (moderationStatus === "approved" ? legacyDesignImageUrls : []);

  if (visibleImageUrls.length > 0) {
    visibleImageUrls.forEach((url, index) => {
      const link = document.createElement("a");
      const image = document.createElement("img");

      link.className = "order-image-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.setAttribute("aria-label", `Öppna designbild ${index + 1}`);

      image.className = "order-image-thumb";
      image.src = url;
      image.alt = `Designbild ${index + 1} för ${order.customer}`;
      image.loading = "lazy";

      link.append(image);
      orderImages.append(link);
    });
  } else {
    orderImages.remove();
  }

  if (moderationStatus !== "approved") {
    const moderationNote = document.createElement("p");
    moderationNote.className = `order-moderation-note status-${moderationStatus}`;

    if (moderationStatus === "pending") {
      moderationNote.textContent = "Bilder granskas automatiskt innan de visas.";
    } else {
      const reason = asString(order.moderationReason) || "Bildinnehåll godkändes inte.";
      moderationNote.textContent = `Bilder blockerade: ${reason}`;
    }

    card.insertBefore(moderationNote, card.querySelector(".item-actions"));
  }

  return fragment;
}

function onDragStart(event) {
  const card = event.target.closest(".order-item");

  if (!card || !event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.orderId || "");
  card.classList.add("is-dragging");
}

function onDragOver(event) {
  const column = event.target.closest(".kanban-column");

  if (!column) {
    return;
  }

  event.preventDefault();
  clearDropTargets();
  column.classList.add("is-drop-target");

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function onDragLeave(event) {
  const column = event.target.closest(".kanban-column");

  if (column && !column.contains(event.relatedTarget)) {
    column.classList.remove("is-drop-target");
  }
}

async function onDrop(event) {
  event.preventDefault();

  const column = event.target.closest(".kanban-column");
  const orderId = event.dataTransfer?.getData("text/plain");
  const nextStatusName = column?.dataset.status;
  const order = state.orders.find((item) => item.id === orderId);

  clearDropTargets();

  if (!order || !nextStatusName || !STATUS_FLOW.includes(nextStatusName) || order.status === nextStatusName) {
    return;
  }

  try {
    await persistOrder({
      ...order,
      status: nextStatusName,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error(error);
    window.alert("Orderns status kunde inte uppdateras.");
  }
}

function clearDropTargets() {
  document.querySelectorAll(".kanban-column.is-drop-target").forEach((column) => {
    column.classList.remove("is-drop-target");
  });

  document.querySelectorAll(".order-item.is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });
}

function renderSummary() {
  const total = state.orders.length;
  const done = state.orders.filter((order) => order.status === "Klar" || order.status === "Levererad").length;
  const active = total - done;

  ui.totalCount.textContent = String(total);
  ui.activeCount.textContent = String(active);
  ui.doneCount.textContent = String(done);
}

function updateShippingEstimate() {
  const rawWeight = ui.weight.value.trim();
  const weight = Number(rawWeight);
  const shippingRate = getPostNordLetterRate(weight);

  ui.shippingEstimate.classList.remove("is-error");

  if (!rawWeight || weight <= 0) {
    ui.shippingEstimate.textContent = "–";
    ui.shippingHint.textContent = "Ange totalvikten för att beräkna frakten.";
    return;
  }

  if (!shippingRate) {
    ui.shippingEstimate.textContent = "Över 2 kg";
    ui.shippingEstimate.classList.add("is-error");
    ui.shippingHint.textContent = "Sverigebrev kan väga högst 2 000 gram.";
    return;
  }

  ui.shippingEstimate.textContent = `${shippingRate.price} kr`;
  ui.shippingHint.textContent = `Frimärkt brev upp till ${formatWeightLimit(shippingRate.maxWeight)}.`;
}

function visibleOrders() {
  if (state.currentFilter === "Alla") {
    return state.orders;
  }

  return state.orders.filter((order) => order.status === state.currentFilter);
}

function setDefaultDate() {
  if (!ui.dueDate.value) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    ui.dueDate.value = date.toISOString().slice(0, 10);
  }
}

function readLegacyOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function loadView() {
  return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
}

async function persistOrder(order) {
  if (!firebase?.auth.currentUser) {
    throw new Error("Ingen admin är inloggad.");
  }

  await firebase.firestoreApi.setDoc(
    firebase.firestoreApi.doc(firebase.db, "orders", order.id),
    order,
    { merge: true }
  );
}

async function migrateLegacyOrders() {
  const legacyOrders = readLegacyOrders();

  if (legacyOrders.length === 0) {
    return;
  }

  await Promise.all(
    legacyOrders.map((legacyOrder) => {
      const order = normalizeLegacyOrder(legacyOrder);
      return persistOrder(order);
    })
  );

  localStorage.removeItem(STORAGE_KEY);
}

function normalizeLegacyOrder(order) {
  const now = Date.now();
  const id = asString(order.id) || createId();

  return {
    id,
    customer: asString(order.customer),
    contact: asString(order.contact),
    address: asString(order.address),
    product: asString(order.product),
    quantity: Number(order.quantity) || 1,
    price: Number(order.price) || 0,
    weight: Number(order.weight) || 0,
    shippingCost: Number(order.shippingCost) || 0,
    dueDate: asString(order.dueDate) || new Date(now).toISOString().slice(0, 10),
    deliveryMethod: asString(order.deliveryMethod) || "Postas",
    status: STATUS_FLOW.includes(order.status) ? order.status : "Ny",
    notes: asString(order.notes),
    designImagePaths: Array.isArray(order.designImagePaths) ? order.designImagePaths : [],
    approvedDesignImageUrls: Array.isArray(order.approvedDesignImageUrls)
      ? order.approvedDesignImageUrls
      : (Array.isArray(order.designImageUrls) ? order.designImageUrls : []),
    moderationStatus: asString(order.moderationStatus) || "approved",
    moderationReason: asString(order.moderationReason),
    moderationUpdatedAt: Number(order.moderationUpdatedAt) || now,
    source: asString(order.source) || "legacy",
    customerId: order.customerId || null,
    createdAt: Number(order.createdAt) || Number(order.updatedAt) || now,
    updatedAt: Number(order.updatedAt) || now
  };
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("sv-SE").format(date);
}

function createId() {
  return `order_${Date.now()}_${Math.round(Math.random() * 10000)}`;
}

function nextStatus(currentStatus) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  if (currentIndex < 0) {
    return "Ny";
  }

  const nextIndex = (currentIndex + 1) % STATUS_FLOW.length;
  return STATUS_FLOW[nextIndex];
}

function asString(value) {
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
