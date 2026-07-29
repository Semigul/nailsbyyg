import { getFirebaseServices } from "./firebase-client.mjs";
import { formatWeightLimit, getPostNordLetterRate } from "./postnord-rates.mjs";

const STORAGE_KEY = "orderkompis.orders.v1";
const VIEW_KEY = "orderkompis.view.v1";
const STATUS_FLOW = ["Ny", "Pågår", "Klar", "Levererad"];
const filterLabels = ["Alla", ...STATUS_FLOW];

const state = {
  orders: [],
  marketplaceItems: [],
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
  totalEstimate: document.getElementById("totalEstimate"),
  totalEstimateHint: document.getElementById("totalEstimateHint"),
  dueDate: document.getElementById("dueDate"),
  deliveryMethod: document.getElementById("deliveryMethod"),
  status: document.getElementById("status"),
  paymentStatus: document.getElementById("paymentStatus"),
  swishReference: document.getElementById("swishReference"),
  notes: document.getElementById("notes"),
  resetButton: document.getElementById("resetButton"),
  newOrderShortcut: document.getElementById("newOrderShortcut"),
  filterCard: document.getElementById("filterCard"),
  ordersList: document.getElementById("ordersList"),
  kanbanBoard: document.getElementById("kanbanBoard"),
  archivePanel: document.getElementById("archivePanel"),
  archiveOrders: document.getElementById("archiveOrders"),
  archiveCount: document.getElementById("archiveCount"),
  viewButtons: document.querySelectorAll("[data-view]"),
  statusChips: document.getElementById("statusChips"),
  totalCount: document.getElementById("totalCount"),
  activeCount: document.getElementById("activeCount"),
  doneCount: document.getElementById("doneCount"),
  orderTemplate: document.getElementById("orderTemplate"),
  marketplaceForm: document.getElementById("marketplaceItemForm"),
  marketplaceItemId: document.getElementById("marketplaceAdminItemId"),
  marketplaceTitle: document.getElementById("marketplaceAdminTitle"),
  marketplaceDescription: document.getElementById("marketplaceAdminDescription"),
  marketplacePrice: document.getElementById("marketplaceAdminPrice"),
  marketplaceShipping: document.getElementById("marketplaceAdminShipping"),
  marketplaceImage: document.getElementById("marketplaceAdminImage"),
  marketplaceImagePreview: document.getElementById("marketplaceAdminImagePreview"),
  marketplaceStatus: document.getElementById("marketplaceAdminStatus"),
  marketplaceSave: document.getElementById("marketplaceAdminSave"),
  marketplaceReset: document.getElementById("marketplaceAdminReset"),
  marketplaceMessage: document.getElementById("marketplaceAdminMessage"),
  marketplaceList: document.getElementById("marketplaceAdminList")
};

let firebase;
let unsubscribeOrders;
let unsubscribeMarketplace;
let touchDrag;

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
  ui.quantity.addEventListener("input", updateShippingEstimate);
  ui.price.addEventListener("input", updateShippingEstimate);
  ui.weight.addEventListener("input", updateShippingEstimate);
  ui.deliveryMethod.addEventListener("change", updateShippingEstimate);
  ui.resetButton.addEventListener("click", resetForm);
  ui.newOrderShortcut.addEventListener("click", onNewOrderShortcut);
  ui.statusChips.addEventListener("click", onFilterClick);
  ui.ordersList.addEventListener("click", onOrderAction);
  ui.kanbanBoard.addEventListener("click", onOrderAction);
  ui.archiveOrders.addEventListener("click", onOrderAction);
  ui.ordersList.addEventListener("change", onStatusSelectChange);
  ui.kanbanBoard.addEventListener("change", onStatusSelectChange);
  ui.kanbanBoard.addEventListener("dragstart", onDragStart);
  ui.kanbanBoard.addEventListener("dragover", onDragOver);
  ui.kanbanBoard.addEventListener("dragleave", onDragLeave);
  ui.kanbanBoard.addEventListener("drop", onDrop);
  ui.kanbanBoard.addEventListener("dragend", clearDropTargets);
  ui.kanbanBoard.addEventListener("pointerdown", onTouchDragStart);
  ui.kanbanBoard.addEventListener("pointermove", onTouchDragMove);
  ui.kanbanBoard.addEventListener("pointerup", onTouchDragEnd);
  ui.kanbanBoard.addEventListener("pointercancel", onTouchDragEnd);
  ui.viewButtons.forEach((button) => button.addEventListener("click", onViewChange));
  ui.marketplaceForm.addEventListener("submit", onSaveMarketplaceItem);
  ui.marketplaceReset.addEventListener("click", resetMarketplaceForm);
  ui.marketplaceImage.addEventListener("change", previewMarketplaceImage);
  ui.marketplaceList.addEventListener("click", onMarketplaceAdminAction);
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
        stopMarketplaceSubscription();
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
    subscribeToMarketplace();
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
    state.marketplaceItems = [];
    render();
    renderMarketplaceAdmin();
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

function subscribeToMarketplace() {
  stopMarketplaceSubscription();
  unsubscribeMarketplace = firebase.firestoreApi.onSnapshot(
    firebase.firestoreApi.collection(firebase.db, "marketplaceItems"),
    (snapshot) => {
      state.marketplaceItems = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
      renderMarketplaceAdmin();
    },
    (error) => {
      console.error(error);
      ui.marketplaceMessage.textContent = "Kunde inte synka marknadsplatsen.";
    }
  );
}

function stopMarketplaceSubscription() {
  if (unsubscribeMarketplace) {
    unsubscribeMarketplace();
    unsubscribeMarketplace = undefined;
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
  const deliveryMethod = asString(formData.get("deliveryMethod"));
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
    shippingCost: deliveryMethod === "Hämtas" ? 0 : shippingRate?.price || 0,
    dueDate: asString(formData.get("dueDate")),
    deliveryMethod,
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
    orderType: existingOrder?.orderType || "custom",
    marketplaceItemId: asString(existingOrder?.marketplaceItemId),
    marketplaceImageUrl: asString(existingOrder?.marketplaceImageUrl),
    paymentStatus: asString(formData.get("paymentStatus")) || "Ej aktuell",
    swishReference: asString(formData.get("swishReference")),
    customerId: existingOrder?.customerId || null,
    archivedAt: Number(existingOrder?.archivedAt) || null,
    createdAt: existingOrder?.createdAt || now,
    updatedAt: now
  };

  ui.form.querySelector('button[type="submit"]').disabled = true;

  try {
    await persistOrder(order);
    await syncMarketplaceItemWithPayment(order);
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
      const order = state.orders.find((item) => item.id === orderId);

      if (order?.marketplaceItemId && order.paymentStatus !== "Betald") {
        await setMarketplaceItemStatus(order.marketplaceItemId, "available", {
          reservedBy: "",
          reservedOrderId: ""
        });
      }

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

  if (action === "archive") {
    const shouldArchive = window.confirm("Arkivera ordern? Du kan återställa den senare.");

    if (!shouldArchive) {
      return;
    }

    await updateArchiveState(order, Date.now());
    return;
  }

  if (action === "restore") {
    await updateArchiveState(order, null);
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
  ui.paymentStatus.value = order.paymentStatus || "Ej aktuell";
  ui.swishReference.value = order.swishReference || "";
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
  ui.paymentStatus.value = "Ej aktuell";
  updateShippingEstimate();
}

function render() {
  renderOrders();
  renderArchive();
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
    const orders = activeOrders().filter((order) => order.status === statusName);
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

function createOrderCard(order, isDraggable = false, isArchived = false) {
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
  const editButton = fragment.querySelector('[data-action="edit"]');
  const archiveButton = fragment.querySelector('[data-action="archive"]');
  const actions = fragment.querySelector(".item-actions");

  card.dataset.orderId = order.id;
  card.draggable = isDraggable && !isArchived;

  if (isDraggable && !isArchived) {
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
  const paymentStatus = asString(order.paymentStatus) || "Ej aktuell";

  meta.textContent = isDraggable
    ? `${deliveryMethod} • ${weightText} • Frakt ${shippingCost} kr • Totalt ${totalWithShipping} kr • ${formatDate(order.dueDate)}`
    : `${order.quantity} st • ${deliveryMethod} • Varor ${total} kr • Frakt ${shippingCost} kr • Totalt ${totalWithShipping} kr • Klart ${formatDate(order.dueDate)}`;

  if (order.orderType === "marketplace" || order.source === "marketplace") {
    card.classList.add("is-marketplace-order");
    const payment = document.createElement("p");
    payment.className = "order-payment";
    payment.textContent = `Marknadsplats • Betalning: ${paymentStatus}`;

    if (order.swishReference) {
      payment.textContent += ` • Swish: ${order.swishReference}`;
    }

    card.insertBefore(payment, notes);

    if (order.marketplaceImageUrl) {
      const image = document.createElement("img");
      image.className = "order-marketplace-thumb";
      image.src = order.marketplaceImageUrl;
      image.alt = order.product;
      image.loading = "lazy";
      card.insertBefore(image, orderImages);
    }
  }

  if (order.status === "Levererad") {
    nextButton.disabled = true;
    nextButton.textContent = "Slutförd";
  }

  if (isArchived) {
    card.classList.add("is-archived");
    card.draggable = false;
    nextButton.remove();
    editButton.remove();
    archiveButton.dataset.action = "restore";
    archiveButton.textContent = "Återställ";
    archiveButton.classList.remove("archive-action");
  } else {
    const statusControl = document.createElement("label");
    const statusLabel = document.createElement("span");
    const statusSelect = document.createElement("select");

    statusControl.className = "mobile-status-control";
    statusLabel.textContent = "Flytta till";
    statusSelect.className = "mobile-status-select";
    statusSelect.dataset.statusSelect = "";
    statusSelect.setAttribute("aria-label", `Flytta order för ${order.customer} till status`);

    STATUS_FLOW.forEach((statusName) => {
      const option = document.createElement("option");
      option.value = statusName;
      option.textContent = statusName;
      option.selected = order.status === statusName;
      statusSelect.append(option);
    });

    statusControl.append(statusLabel, statusSelect);
    card.insertBefore(statusControl, actions);
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

function renderArchive() {
  const orders = state.orders
    .filter((order) => isArchivedOrder(order))
    .sort((first, second) => Number(second.archivedAt) - Number(first.archivedAt));

  ui.archiveCount.textContent = String(orders.length);
  ui.archiveOrders.innerHTML = "";

  if (orders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "archive-empty";
    empty.textContent = "Arkivet är tomt.";
    ui.archiveOrders.append(empty);
    return;
  }

  orders.forEach((order) => {
    ui.archiveOrders.append(createOrderCard(order, false, true));
  });
}

async function updateArchiveState(order, archivedAt) {
  try {
    await persistOrder({
      ...order,
      archivedAt,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error(error);
    window.alert(archivedAt ? "Ordern kunde inte arkiveras." : "Ordern kunde inte återställas.");
  }
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

  clearDropTargets();
  await moveOrderToStatus(orderId, nextStatusName);
}

async function onStatusSelectChange(event) {
  const select = event.target.closest("[data-status-select]");

  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const card = select.closest(".order-item");
  await moveOrderToStatus(card?.dataset.orderId, select.value);
}

function onTouchDragStart(event) {
  const handle = event.target.closest(".order-item header");

  if (!handle || (event.pointerType !== "touch" && event.pointerType !== "pen")) {
    return;
  }

  const card = handle.closest(".order-item");

  if (!card?.dataset.orderId) {
    return;
  }

  event.preventDefault();
  try {
    handle.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic pointer events used by tests do not create an active browser pointer.
  }
  touchDrag = {
    pointerId: event.pointerId,
    orderId: card.dataset.orderId,
    handle,
    nextStatusName: null
  };
  card.classList.add("is-dragging");
  document.body.classList.add("is-touch-dragging");
}

function onTouchDragMove(event) {
  if (!touchDrag || event.pointerId !== touchDrag.pointerId) {
    return;
  }

  event.preventDefault();
  const edgeDistance = 76;

  if (event.clientY < edgeDistance) {
    window.scrollBy(0, -18);
  } else if (event.clientY > window.innerHeight - edgeDistance) {
    window.scrollBy(0, 18);
  }

  const elementAtPointer = document.elementFromPoint(event.clientX, event.clientY);
  const column = elementAtPointer?.closest(".kanban-column");
  clearColumnDropTargets();
  touchDrag.nextStatusName = column?.dataset.status || null;
  column?.classList.add("is-drop-target");
}

async function onTouchDragEnd(event) {
  if (!touchDrag || event.pointerId !== touchDrag.pointerId) {
    return;
  }

  event.preventDefault();
  const { orderId, nextStatusName, handle, pointerId } = touchDrag;

  if (handle.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture(pointerId);
  }
  touchDrag = undefined;
  document.body.classList.remove("is-touch-dragging");
  clearDropTargets();
  await moveOrderToStatus(orderId, nextStatusName);
}

async function moveOrderToStatus(orderId, nextStatusName) {
  const order = state.orders.find((item) => item.id === orderId);

  if (
    !order ||
    isArchivedOrder(order) ||
    !nextStatusName ||
    !STATUS_FLOW.includes(nextStatusName) ||
    order.status === nextStatusName
  ) {
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

function clearColumnDropTargets() {
  document.querySelectorAll(".kanban-column.is-drop-target").forEach((column) => {
    column.classList.remove("is-drop-target");
  });
}

function clearDropTargets() {
  clearColumnDropTargets();

  document.querySelectorAll(".order-item.is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });
}

function renderSummary() {
  const orders = activeOrders();
  const total = orders.length;
  const done = orders.filter((order) => order.status === "Klar" || order.status === "Levererad").length;
  const active = total - done;

  ui.totalCount.textContent = String(total);
  ui.activeCount.textContent = String(active);
  ui.doneCount.textContent = String(done);
}

function updateShippingEstimate() {
  const rawWeight = ui.weight.value.trim();
  const weight = Number(rawWeight);
  const quantity = Math.max(0, Number(ui.quantity.value) || 0);
  const unitPrice = Math.max(0, Number(ui.price.value) || 0);
  const productTotal = quantity * unitPrice;
  const shippingRate = getPostNordLetterRate(weight);
  const isPickup = ui.deliveryMethod.value === "Hämtas";

  ui.shippingEstimate.classList.remove("is-error");
  ui.totalEstimate.classList.remove("is-error");

  if (isPickup) {
    ui.shippingEstimate.textContent = "0 kr";
    ui.shippingHint.textContent = "Ingen frakt vid hämtning.";
    ui.totalEstimate.value = `${productTotal} kr`;
    ui.totalEstimate.textContent = `${productTotal} kr`;
    ui.totalEstimateHint.textContent = `${quantity} × ${unitPrice} kr, utan frakt.`;
    return;
  }

  if (!rawWeight || weight <= 0) {
    ui.shippingEstimate.textContent = "–";
    ui.shippingHint.textContent = "Ange totalvikten för att beräkna frakten.";
    ui.totalEstimate.value = "–";
    ui.totalEstimate.textContent = "–";
    ui.totalEstimateHint.textContent = "Ange vikten för att visa pris inklusive frakt.";
    return;
  }

  if (!shippingRate) {
    ui.shippingEstimate.textContent = "Över 2 kg";
    ui.shippingEstimate.classList.add("is-error");
    ui.shippingHint.textContent = "Sverigebrev kan väga högst 2 000 gram.";
    ui.totalEstimate.value = "–";
    ui.totalEstimate.textContent = "–";
    ui.totalEstimate.classList.add("is-error");
    ui.totalEstimateHint.textContent = "Välj ett annat fraktsätt för att räkna ut totalen.";
    return;
  }

  ui.shippingEstimate.textContent = `${shippingRate.price} kr`;
  ui.shippingHint.textContent = `Frimärkt brev upp till ${formatWeightLimit(shippingRate.maxWeight)}.`;
  ui.totalEstimate.value = `${productTotal + shippingRate.price} kr`;
  ui.totalEstimate.textContent = `${productTotal + shippingRate.price} kr`;
  ui.totalEstimateHint.textContent =
    `${quantity} × ${unitPrice} kr + ${shippingRate.price} kr frakt.`;
}

async function onSaveMarketplaceItem(event) {
  event.preventDefault();

  if (!firebase?.auth.currentUser) {
    return;
  }

  const formData = new FormData(ui.marketplaceForm);
  const id = ui.marketplaceItemId.value || `item_${Date.now()}_${Math.round(Math.random() * 10000)}`;
  const existingItem = state.marketplaceItems.find((item) => item.id === id);
  const imageFile = ui.marketplaceImage.files?.[0];

  if (!existingItem && !imageFile) {
    ui.marketplaceMessage.textContent = "Välj en bild på varan.";
    return;
  }

  if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 5 * 1024 * 1024)) {
    ui.marketplaceMessage.textContent = "Bilden måste vara en bildfil och högst 5 MB.";
    return;
  }

  ui.marketplaceSave.disabled = true;
  ui.marketplaceSave.textContent = imageFile ? "Laddar upp…" : "Sparar…";
  ui.marketplaceMessage.textContent = "";

  try {
    const imageUrl = imageFile
      ? await uploadMarketplaceImage(id, imageFile)
      : existingItem.imageUrl;
    const now = Date.now();
    const item = {
      id,
      title: asString(formData.get("title")),
      description: asString(formData.get("description")),
      price: Math.max(0, Number(formData.get("price")) || 0),
      shippingCost: Math.max(0, Number(formData.get("shippingCost")) || 0),
      imageUrl,
      status: asString(formData.get("itemStatus")) || "available",
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
    resetMarketplaceForm();
  } catch (error) {
    console.error(error);
    ui.marketplaceMessage.textContent = `Varan kunde inte sparas: ${asString(error?.message)}`;
  } finally {
    ui.marketplaceSave.disabled = false;
    ui.marketplaceSave.textContent = "Publicera vara";
  }
}

function renderMarketplaceAdmin() {
  ui.marketplaceList.innerHTML = "";

  if (state.marketplaceItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Inga begagnade saker är publicerade ännu.";
    ui.marketplaceList.append(empty);
    return;
  }

  state.marketplaceItems.forEach((item) => {
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
      `${Number(item.price) || 0} kr • Frakt ${Number(item.shippingCost) || 0} kr • ${marketplaceStatusLabel(item.status)}`;
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
    ui.marketplaceList.append(card);
  });
}

async function onMarketplaceAdminAction(event) {
  const button = event.target.closest("button[data-action]");
  const card = button?.closest(".marketplace-admin-item");
  const item = state.marketplaceItems.find((entry) => entry.id === card?.dataset.itemId);

  if (!item) {
    return;
  }

  if (button.dataset.action === "edit-marketplace-item") {
    ui.marketplaceItemId.value = item.id;
    ui.marketplaceTitle.value = item.title;
    ui.marketplaceDescription.value = item.description;
    ui.marketplacePrice.value = String(item.price);
    ui.marketplaceShipping.value = String(item.shippingCost);
    ui.marketplaceStatus.value = item.status;
    ui.marketplaceImagePreview.src = item.imageUrl;
    ui.marketplaceImagePreview.alt = item.title;
    ui.marketplaceImagePreview.hidden = false;
    ui.marketplaceSave.textContent = "Spara ändringar";
    ui.marketplaceForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
      ui.marketplaceMessage.textContent = "Varan kunde inte tas bort.";
    }
  }
}

function resetMarketplaceForm() {
  ui.marketplaceForm.reset();
  ui.marketplaceItemId.value = "";
  ui.marketplaceShipping.value = "0";
  ui.marketplaceStatus.value = "available";
  ui.marketplaceImagePreview.hidden = true;
  ui.marketplaceImagePreview.removeAttribute("src");
  ui.marketplaceMessage.textContent = "";
  ui.marketplaceSave.textContent = "Publicera vara";
}

function previewMarketplaceImage() {
  const file = ui.marketplaceImage.files?.[0];

  if (!file) {
    return;
  }

  ui.marketplaceImagePreview.src = URL.createObjectURL(file);
  ui.marketplaceImagePreview.alt = "Förhandsvisning av varan";
  ui.marketplaceImagePreview.hidden = false;
}

async function uploadMarketplaceImage(itemId, file) {
  const config = window.CLOUDINARY_CONFIG || {};
  const cloudName = asString(config.cloudName);
  const signEndpoint = asString(config.signEndpoint);
  const uploadPreset = asString(config.uploadPreset);
  const folder = `${asString(config.folder) || "nailsbyyg-orders"}/marketplace`;
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

    return sendMarketplaceImage(
      signed.cloudName || cloudName,
      formData
    );
  }

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary är inte konfigurerat.");
  }

  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("public_id", `${itemId}_${Date.now()}`);
  return sendMarketplaceImage(cloudName, formData);
}

async function sendMarketplaceImage(cloudName, formData) {
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

async function syncMarketplaceItemWithPayment(order) {
  if (!order.marketplaceItemId) {
    return;
  }

  if (order.paymentStatus === "Betald") {
    await setMarketplaceItemStatus(order.marketplaceItemId, "sold");
  } else if (order.paymentStatus === "Återbetald") {
    await setMarketplaceItemStatus(order.marketplaceItemId, "available", {
      reservedBy: "",
      reservedOrderId: ""
    });
  } else if (order.paymentStatus === "Väntar på Swish") {
    await setMarketplaceItemStatus(order.marketplaceItemId, "reserved");
  }
}

async function setMarketplaceItemStatus(itemId, status, extra = {}) {
  await firebase.firestoreApi.setDoc(
    firebase.firestoreApi.doc(firebase.db, "marketplaceItems", itemId),
    {
      status,
      ...extra,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

function marketplaceStatusLabel(status) {
  return {
    available: "Tillgänglig",
    reserved: "Reserverad",
    sold: "Såld"
  }[status] || status;
}

function visibleOrders() {
  const orders = activeOrders();

  if (state.currentFilter === "Alla") {
    return orders;
  }

  return orders.filter((order) => order.status === state.currentFilter);
}

function activeOrders() {
  return state.orders.filter((order) => !isArchivedOrder(order));
}

function isArchivedOrder(order) {
  return Number(order.archivedAt) > 0;
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
    orderType: asString(order.orderType) || "custom",
    marketplaceItemId: asString(order.marketplaceItemId),
    marketplaceImageUrl: asString(order.marketplaceImageUrl),
    paymentStatus: asString(order.paymentStatus) || "Ej aktuell",
    swishReference: asString(order.swishReference),
    customerId: order.customerId || null,
    archivedAt: Number(order.archivedAt) || null,
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
