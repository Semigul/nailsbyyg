import { getFirebaseServices } from "./firebase-client.mjs";

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
  dueDate: document.getElementById("customerDueDate")
};

let firebase;
let customerUser;

init();

async function init() {
  setMinimumDate();
  ui.form.addEventListener("submit", onSubmitOrder);
  ui.newOrderButton.addEventListener("click", resetCustomerForm);
  ui.deliveryMethod.addEventListener("change", updateAddressRequirement);
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
  const now = Date.now();
  const order = {
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
    source: "customer",
    customerId: customerUser.uid,
    createdAt: now,
    updatedAt: now
  };

  submitButton.disabled = true;
  submitButton.textContent = "Skickar…";
  ui.formMessage.textContent = "";

  try {
    const reference = await firebase.firestoreApi.addDoc(
      firebase.firestoreApi.collection(firebase.db, "orders"),
      order
    );

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

function clean(value) {
  return String(value || "").trim();
}
