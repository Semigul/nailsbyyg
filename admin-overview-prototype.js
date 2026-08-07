const STATUS_FLOW = ["Ny", "Pågår", "Klar", "Levererad"];
const VARIANTS = {
  A: "Fokuslista",
  B: "Handlingskö",
  C: "En status i taget"
};

export function createAdminOverviewPrototype({ onNewOrder }) {
  let currentVariant = readVariant();

  if (!currentVariant) {
    return {
      active: false,
      render() {},
      setVisible() {}
    };
  }

  const root = document.createElement("section");
  const switcher = document.createElement("nav");
  let orders = [];
  let isVisible = false;
  let listFilter = "Alla";
  let focusedStatus = "Ny";

  root.id = "adminOverviewPrototype";
  root.className = "admin-overview-prototype";
  root.hidden = true;
  root.setAttribute("aria-label", "Prototyp för beställningsöversikt");

  switcher.className = "prototype-switcher";
  switcher.setAttribute("aria-label", "Byt prototypvariant");
  switcher.hidden = true;
  switcher.innerHTML = `
    <button type="button" data-prototype-previous aria-label="Föregående variant">←</button>
    <span data-prototype-label></span>
    <button type="button" data-prototype-next aria-label="Nästa variant">→</button>
  `;

  document.querySelector(".hero")?.insertAdjacentElement("afterend", root);
  document.body.append(switcher);
  document.body.classList.add("prototype-overview-active");

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button || !root.contains(button)) {
      return;
    }

    if (button.matches("[data-prototype-new-order]")) {
      document.body.classList.add("prototype-form-open");
      onNewOrder();
      return;
    }

    if (button.dataset.prototypeFilter) {
      listFilter = button.dataset.prototypeFilter;
      render();
      return;
    }

    if (button.dataset.prototypeStatus) {
      focusedStatus = button.dataset.prototypeStatus;
      render();
      return;
    }

    if (button.dataset.prototypeToggle) {
      const details = root.querySelector(`#${CSS.escape(button.dataset.prototypeToggle)}`);
      const willOpen = details?.hidden === true;

      if (details) {
        details.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
        button.querySelector("[data-toggle-copy]").textContent = willOpen ? "Dölj" : "Visa";
      }
    }
  });

  switcher.addEventListener("click", (event) => {
    if (event.target.closest("[data-prototype-previous]")) {
      cycleVariant(-1);
    }

    if (event.target.closest("[data-prototype-next]")) {
      cycleVariant(1);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isVisible || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable]")) {
      return;
    }

    cycleVariant(event.key === "ArrowLeft" ? -1 : 1);
  });

  function render(nextOrders = orders) {
    orders = [...nextOrders].sort(compareOrders);

    if (!isVisible) {
      return;
    }

    const overview = createOverview(orders);
    const renderVariant = {
      A: renderVariantA,
      B: renderVariantB,
      C: renderVariantC
    }[currentVariant];

    root.dataset.variant = currentVariant;
    root.innerHTML = renderVariant(overview, { listFilter, focusedStatus });
    switcher.querySelector("[data-prototype-label]").textContent =
      `${currentVariant} — ${VARIANTS[currentVariant]}`;
  }

  function setVisible(nextVisible) {
    isVisible = nextVisible;
    root.hidden = !nextVisible;
    switcher.hidden = !nextVisible;
    document.body.classList.toggle("prototype-overview-visible", nextVisible);

    if (!nextVisible) {
      document.body.classList.remove("prototype-form-open");
      return;
    }

    render();
  }

  function cycleVariant(direction) {
    const keys = Object.keys(VARIANTS);
    const nextIndex = (keys.indexOf(currentVariant) + direction + keys.length) % keys.length;
    const url = new URL(window.location.href);

    currentVariant = keys[nextIndex];
    url.searchParams.set("variant", currentVariant);
    window.history.replaceState({}, "", url);
    document.body.classList.remove("prototype-form-open");
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return {
    active: true,
    render,
    setVisible
  };
}

function renderVariantA(overview, viewState) {
  const filteredOrders = viewState.listFilter === "Alla"
    ? overview.active
    : overview.byStatus[viewState.listFilter];

  return `
    <div class="prototype-disclaimer">Prototyp · Biljett #28 · Ändrar inte beställningar</div>
    <div class="variant-a-shell">
      <header class="variant-a-header">
        <div>
          <p class="prototype-kicker">Orderhantering</p>
          <h1>Beställningar</h1>
          <p>${overview.openCount} att göra · ${overview.dueSoonCount} snart</p>
        </div>
        <button class="prototype-primary" type="button" data-prototype-new-order>
          <span aria-hidden="true">＋</span> Ny beställning
        </button>
      </header>

      <nav class="variant-a-filters" aria-label="Filtrera på status">
        ${["Alla", ...STATUS_FLOW].map((status) => `
          <button
            type="button"
            data-prototype-filter="${status}"
            class="${viewState.listFilter === status ? "is-active" : ""}"
            aria-pressed="${viewState.listFilter === status}"
          >
            <span>${status}</span>
            <strong>${status === "Alla" ? overview.active.length : overview.counts[status]}</strong>
          </button>
        `).join("")}
      </nav>

      <section class="variant-a-list" aria-label="Aktiva beställningar">
        <div class="prototype-section-heading">
          <h2>${viewState.listFilter === "Alla" ? "Aktiva beställningar" : viewState.listFilter}</h2>
          <span>${filteredOrders.length} st</span>
        </div>
        ${renderCompactRows(filteredOrders, "a")}
      </section>

      ${renderSecondaryLinks(overview.archive.length)}
      ${renderState(overview, "A", { filter: viewState.listFilter })}
    </div>
  `;
}

function renderVariantB(overview) {
  const actionable = overview.active.filter((order) => order.status !== "Levererad");
  const priority = actionable.slice(0, 3);
  const later = actionable.slice(3);

  return `
    <div class="prototype-disclaimer">Prototyp · Biljett #28 · Ändrar inte beställningar</div>
    <div class="variant-b-shell">
      <header class="variant-b-header">
        <p class="prototype-kicker">Dagens orderhantering</p>
        <h1>Vad behöver göras?</h1>
        <p>Börja uppifrån. Det viktigaste ligger först.</p>
        <button class="prototype-primary" type="button" data-prototype-new-order>
          ＋ Skapa ny beställning
        </button>
      </header>

      <section class="variant-b-flow" aria-label="Statusflöde">
        ${STATUS_FLOW.map((status, index) => `
          <div class="${overview.counts[status] > 0 ? "has-orders" : ""}">
            <span>${index + 1}</span>
            <strong>${status}</strong>
            <small>${overview.counts[status]}</small>
          </div>
        `).join("")}
      </section>

      <section class="variant-b-queue">
        <div class="prototype-section-heading">
          <div>
            <p class="prototype-kicker">Nästa steg</p>
            <h2>Gör nu</h2>
          </div>
          <span>${actionable.length} kvar</span>
        </div>
        ${renderTaskCards(priority)}
      </section>

      ${later.length > 0 ? `
        <details class="variant-b-later">
          <summary>Senare <span>${later.length}</span></summary>
          <div>${renderTaskCards(later)}</div>
        </details>
      ` : ""}

      ${overview.byStatus.Levererad.length > 0 ? `
        <section class="variant-b-delivered">
          <div class="prototype-section-heading">
            <h2>Redo att arkivera</h2>
            <span>${overview.byStatus.Levererad.length}</span>
          </div>
          ${renderCompactRows(overview.byStatus.Levererad, "b")}
        </section>
      ` : ""}

      ${renderSecondaryLinks(overview.archive.length)}
      ${renderState(overview, "B", { queue: actionable.map((order) => order.id) })}
    </div>
  `;
}

function renderVariantC(overview, viewState) {
  const statusOrders = overview.byStatus[viewState.focusedStatus];
  const statusIndex = STATUS_FLOW.indexOf(viewState.focusedStatus);

  return `
    <div class="prototype-disclaimer">Prototyp · Biljett #28 · Ändrar inte beställningar</div>
    <div class="variant-c-shell">
      <header class="variant-c-header">
        <div>
          <p class="prototype-kicker">Orderhantering</p>
          <h1>Följ flödet</h1>
        </div>
        <button type="button" class="variant-c-add" data-prototype-new-order aria-label="Ny beställning">＋</button>
      </header>

      <nav class="variant-c-stages" aria-label="Välj status">
        ${STATUS_FLOW.map((status, index) => `
          <button
            type="button"
            data-prototype-status="${status}"
            class="${viewState.focusedStatus === status ? "is-active" : ""} ${index < statusIndex ? "is-past" : ""}"
            aria-pressed="${viewState.focusedStatus === status}"
          >
            <span>${index + 1}</span>
            <strong>${status}</strong>
            <small>${overview.counts[status]}</small>
          </button>
        `).join("")}
      </nav>

      <section class="variant-c-stage">
        <div class="variant-c-stage-heading">
          <div>
            <p>Steg ${statusIndex + 1} av 4</p>
            <h2>${viewState.focusedStatus}</h2>
          </div>
          <span>${statusOrders.length} beställningar</span>
        </div>
        <div class="variant-c-cards">
          ${statusOrders.length > 0
            ? statusOrders.map((order) => renderFocusCard(order)).join("")
            : renderEmptyState("Inga beställningar i det här steget.")}
        </div>
      </section>

      <nav class="variant-c-dock" aria-label="Huvudvägar">
        <button type="button" class="is-current"><span aria-hidden="true">▤</span> Beställningar</button>
        <button type="button" data-prototype-new-order><span aria-hidden="true">＋</span> Ny beställning</button>
        <button type="button"><span aria-hidden="true">⌄</span> Arkiv ${overview.archive.length}</button>
      </nav>

      ${renderState(overview, "C", { focusedStatus: viewState.focusedStatus })}
    </div>
  `;
}

function renderCompactRows(orders, prefix) {
  if (orders.length === 0) {
    return renderEmptyState("Inga beställningar här ännu.");
  }

  return orders.map((order, index) => {
    const detailsId = `prototype-${prefix}-details-${index}`;

    return `
      <article class="prototype-order-row status-border-${statusSlug(order.status)}">
        <div class="prototype-order-main">
          <span class="prototype-status status-${statusSlug(order.status)}">${escapeHtml(order.status)}</span>
          <h3>${escapeHtml(order.customer)}</h3>
          <p>${escapeHtml(order.product)} · ${escapeHtml(formatDueDate(order.dueDate))}</p>
        </div>
        <button
          type="button"
          class="prototype-row-toggle"
          data-prototype-toggle="${detailsId}"
          aria-controls="${detailsId}"
          aria-expanded="false"
        ><span data-toggle-copy>Visa</span><span aria-hidden="true">›</span></button>
        <div class="prototype-row-details" id="${detailsId}" hidden>
          ${renderOrderDetails(order)}
        </div>
      </article>
    `;
  }).join("");
}

function renderTaskCards(orders) {
  if (orders.length === 0) {
    return renderEmptyState("Allt är klart just nu.");
  }

  return orders.map((order) => {
    const currentIndex = Math.max(0, STATUS_FLOW.indexOf(order.status));
    const nextStatus = STATUS_FLOW[Math.min(currentIndex + 1, STATUS_FLOW.length - 1)];

    return `
      <article class="prototype-task-card">
        <div class="prototype-task-number">${currentIndex + 1}</div>
        <div>
          <span class="prototype-status status-${statusSlug(order.status)}">${escapeHtml(order.status)}</span>
          <h3>${escapeHtml(order.customer)}</h3>
          <p>${escapeHtml(order.product)}</p>
          <small>${escapeHtml(formatDueDate(order.dueDate))}</small>
        </div>
        <div class="prototype-suggested-action">
          <small>Nästa</small>
          <strong>${order.status === "Klar" ? "Leverera" : nextStatus}</strong>
        </div>
      </article>
    `;
  }).join("");
}

function renderFocusCard(order) {
  return `
    <article class="prototype-focus-card">
      <div class="prototype-focus-card-topline">
        <span>${escapeHtml(formatDueDate(order.dueDate))}</span>
        <span class="prototype-status status-${statusSlug(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <h3>${escapeHtml(order.customer)}</h3>
      <p>${escapeHtml(order.product)}</p>
      <dl>
        <div><dt>Antal</dt><dd>${escapeHtml(order.quantity || 1)}</dd></div>
        <div><dt>Leverans</dt><dd>${escapeHtml(order.deliveryMethod || "Postas")}</dd></div>
        <div><dt>Pris</dt><dd>${escapeHtml(calculateTotal(order))} kr</dd></div>
      </dl>
      <button type="button" class="prototype-card-action">Öppna beställning <span aria-hidden="true">→</span></button>
    </article>
  `;
}

function renderOrderDetails(order) {
  return `
    <dl>
      <div><dt>Antal</dt><dd>${escapeHtml(order.quantity || 1)}</dd></div>
      <div><dt>Leverans</dt><dd>${escapeHtml(order.deliveryMethod || "Postas")}</dd></div>
      <div><dt>Pris</dt><dd>${escapeHtml(calculateTotal(order))} kr</dd></div>
    </dl>
  `;
}

function renderSecondaryLinks(archiveCount) {
  return `
    <nav class="prototype-secondary" aria-label="Sekundära verktyg">
      <button type="button"><span>Arkiv</span><strong>${archiveCount}</strong><span aria-hidden="true">→</span></button>
      <button type="button"><span>Fler verktyg</span><span aria-hidden="true">→</span></button>
    </nav>
  `;
}

function renderState(overview, variant, variantState) {
  const relevantState = {
    variant,
    ...variantState,
    counts: overview.counts,
    archiveCount: overview.archive.length,
    activeOrders: overview.active.map(({ id, customer, product, status, dueDate }) => ({
      id,
      customer,
      product,
      status,
      dueDate
    }))
  };

  return `
    <details class="prototype-state">
      <summary>Visa prototypens tillstånd</summary>
      <pre>${escapeHtml(JSON.stringify(relevantState, null, 2))}</pre>
    </details>
  `;
}

function renderEmptyState(message) {
  return `<div class="prototype-empty"><span aria-hidden="true">✓</span><p>${escapeHtml(message)}</p></div>`;
}

function createOverview(orders) {
  const archive = orders.filter((order) => Number(order.archivedAt) > 0);
  const active = orders.filter((order) => !(Number(order.archivedAt) > 0));
  const byStatus = Object.fromEntries(
    STATUS_FLOW.map((status) => [status, active.filter((order) => order.status === status)])
  );
  const counts = Object.fromEntries(STATUS_FLOW.map((status) => [status, byStatus[status].length]));
  const dueSoonLimit = new Date();

  dueSoonLimit.setDate(dueSoonLimit.getDate() + 7);

  return {
    active,
    archive,
    byStatus,
    counts,
    openCount: active.filter((order) => order.status !== "Levererad").length,
    dueSoonCount: active.filter((order) => {
      const dueDate = new Date(`${order.dueDate}T12:00:00`);
      return order.status !== "Levererad" && Number.isFinite(dueDate.getTime()) && dueDate <= dueSoonLimit;
    }).length
  };
}

function compareOrders(first, second) {
  const statusDifference = STATUS_FLOW.indexOf(first.status) - STATUS_FLOW.indexOf(second.status);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  return String(first.dueDate || "9999-12-31").localeCompare(String(second.dueDate || "9999-12-31"));
}

function calculateTotal(order) {
  return Math.max(0, Number(order.quantity) || 1) * Math.max(0, Number(order.price) || 0)
    + Math.max(0, Number(order.shippingCost) || 0);
}

function formatDueDate(value) {
  if (!value) {
    return "Inget datum";
  }

  const date = new Date(`${value}T12:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(date);
}

function statusSlug(status) {
  return String(status || "Ny")
    .toLocaleLowerCase("sv-SE")
    .replaceAll("å", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replace(/[^a-z0-9]+/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readVariant() {
  const variant = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return Object.hasOwn(VARIANTS, variant) ? variant : "";
}
