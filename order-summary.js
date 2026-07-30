import { getFirebaseServices } from "./firebase-client.mjs";

const STATUS_FLOW = ["Ny", "Pågår", "Klar", "Levererad"];
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

const ui = {
  status: document.getElementById("orderShareStatus"),
  content: document.getElementById("orderShareContent"),
  product: document.getElementById("sharedProduct"),
  reference: document.getElementById("sharedReference"),
  orderStatus: document.getElementById("sharedStatus"),
  customer: document.getElementById("sharedCustomer"),
  quantity: document.getElementById("sharedQuantity"),
  dueDate: document.getElementById("sharedDueDate"),
  deliveryMethod: document.getElementById("sharedDeliveryMethod"),
  addressRow: document.getElementById("sharedAddressRow"),
  address: document.getElementById("sharedAddress"),
  notesRow: document.getElementById("sharedNotesRow"),
  notes: document.getElementById("sharedNotes"),
  paymentRow: document.getElementById("sharedPaymentRow"),
  paymentStatus: document.getElementById("sharedPaymentStatus"),
  itemPriceLabel: document.getElementById("sharedItemPriceLabel"),
  itemPrice: document.getElementById("sharedItemPrice"),
  shippingCost: document.getElementById("sharedShippingCost"),
  total: document.getElementById("sharedTotal"),
  updatedAt: document.getElementById("sharedUpdatedAt")
};

loadSharedOrder();

async function loadSharedOrder() {
  const shareToken = readShareToken();

  if (!shareToken) {
    showUnavailable();
    return;
  }

  try {
    const firebase = await getFirebaseServices();
    const snapshot = await firebase.firestoreApi.getDoc(
      firebase.firestoreApi.doc(firebase.db, "orderShares", shareToken)
    );

    if (!snapshot.exists()) {
      showUnavailable();
      return;
    }

    const order = snapshot.data();

    if (order.active !== true || Number(order.expiresAt) <= Date.now()) {
      showUnavailable();
      return;
    }

    renderSharedOrder(order);
  } catch (error) {
    console.error(error);
    showUnavailable();
  }
}

function readShareToken() {
  try {
    const shareToken = decodeURIComponent(window.location.hash.slice(1)).trim();
    return TOKEN_PATTERN.test(shareToken) ? shareToken : "";
  } catch {
    return "";
  }
}

function renderSharedOrder(order) {
  const quantity = Math.max(1, Number(order.quantity) || 1);
  const unitPrice = Math.max(0, Number(order.unitPrice) || 0);
  const itemTotal = Math.max(0, Number(order.itemTotal) || quantity * unitPrice);
  const shippingCost = Math.max(0, Number(order.shippingCost) || 0);
  const total = Math.max(0, Number(order.total) || itemTotal + shippingCost);
  const status = STATUS_FLOW.includes(order.status) ? order.status : "Ny";
  const hasConfirmedPrice = unitPrice > 0 || itemTotal > 0;

  ui.product.textContent = asString(order.product) || "Beställning";
  ui.reference.textContent = `Orderreferens: ${asString(order.orderId)}`;
  ui.orderStatus.textContent = status;
  ui.orderStatus.className = `order-status status-${status}`;
  ui.customer.textContent = asString(order.customer) || "–";
  ui.quantity.textContent = `${quantity} st`;
  ui.dueDate.textContent = formatDate(order.dueDate);
  ui.deliveryMethod.textContent = asString(order.deliveryMethod) || "–";

  const address = asString(order.address);
  ui.addressRow.hidden = !address;
  ui.address.textContent = address;

  const notes = asString(order.notes);
  ui.notesRow.hidden = !notes;
  ui.notes.textContent = notes;

  const paymentStatus = asString(order.paymentStatus);
  ui.paymentRow.hidden = !paymentStatus || paymentStatus === "Ej aktuell";
  ui.paymentStatus.textContent = paymentStatus;

  ui.itemPriceLabel.textContent = hasConfirmedPrice
    ? `${quantity} × ${formatCurrency(unitPrice)}`
    : "Prisförslag";
  ui.itemPrice.textContent = hasConfirmedPrice ? formatCurrency(itemTotal) : "Kommer snart";
  ui.shippingCost.textContent = formatCurrency(shippingCost);
  ui.total.textContent = hasConfirmedPrice ? formatCurrency(total) : "Kommer snart";
  ui.updatedAt.textContent = `Senast uppdaterad ${formatDateTime(order.updatedAt)}. Länken gäller till ${formatDate(order.expiresAt)}.`;

  ui.status.hidden = true;
  ui.content.hidden = false;
}

function showUnavailable() {
  ui.content.hidden = true;
  ui.status.hidden = false;
  ui.status.classList.add("is-error");
  ui.status.textContent =
    "Länken är ogiltig, har gått ut eller har stängts av. Be Nailsbyy.g om en ny länk.";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDate(value) {
  const date = typeof value === "number"
    ? new Date(value)
    : new Date(`${asString(value)}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Inte bestämt ännu";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return "nyligen";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function asString(value) {
  return String(value || "").trim();
}
