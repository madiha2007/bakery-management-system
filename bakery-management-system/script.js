const API = "http://127.0.0.1:5000/api";
const CURRENCY = "₹";

const $ = id => document.getElementById(id);
const money = value => CURRENCY + Number(value || 0).toFixed(2);

const DB = {
  Customers: [],
  Products: [],
  Orders: [],
  Payments: []
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHTML(value)
    : date.toLocaleDateString("en-IN");
}

function buildTable(headers, rows) {
  return `<table>
    <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row =>
      `<tr>${row.map(cell => `<td>${cell ?? ""}</td>`).join("")}</tr>`
    ).join("")}</tbody>
  </table>`;
}

async function getData(endpoint) {
  const response = await fetch(`${API}/${endpoint}`);
  if (!response.ok) throw new Error(`Failed to load ${endpoint}`);
  return response.json();
}

/* =====================================================================
   NEW: STOCK MANAGEMENT HELPERS
   Stock numbers and statuses always come from Oracle through Flask.
   ===================================================================== */

// CSS class for each status text that the Oracle trigger can produce
const STATUS_CLASS = {
  "IN STOCK": "in",
  "LOW STOCK": "low",
  "CRITICAL STOCK": "critical",
  "OUT OF STOCK": "out"
};

// Alert texts shown after a change makes a product critical or out of stock
const ALERT_MESSAGES = {
  "CRITICAL STOCK": "⚠️ Critical Stock Alert — only 1 item remaining!",
  "OUT OF STOCK": "🚨 Out of Stock Alert — this product is unavailable!"
};

let stockBusy = false;     // true while a stock request is running
let activeStock = null;    // which product/action the dialog is open for

function statusBadge(status) {
  return `<span class="stock-badge ${STATUS_CLASS[status] || ""}">${escapeHTML(status)}</span>`;
}

function actionButtons(product) {
  const id = escapeHTML(product.PRODUCTID);
  const empty = Number(product.STOCK_QUANTITY) <= 0;
  return `<div class="stock-actions">
    <button type="button" class="stock-btn add" data-action="add" data-id="${id}"
      ${stockBusy ? "disabled" : ""}>➕ Add Stock</button>
    <button type="button" class="stock-btn remove" data-action="remove" data-id="${id}"
      data-empty="${empty ? 1 : 0}" ${stockBusy || empty ? "disabled" : ""}
      ${empty ? 'title="No stock to remove"' : ""}>➖ Remove Stock</button>
  </div>`;
}

// ----- Messages (success / error / stock alerts) -----
const toastArea = document.createElement("div");
toastArea.id = "toastArea";
document.body.appendChild(toastArea);

// sticky = stays until the person closes it (used for stock alerts)
function showToast(message, type = "success", sticky = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", sticky || type === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.textContent = message;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss message");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());

  toast.append(text, close);
  toastArea.appendChild(toast);
  if (!sticky) setTimeout(() => toast.remove(), 4500);
}

// ----- Remember which alerts were already shown (this browser tab only) -----
const ALERT_STORAGE_KEY = "bakeryShownStockAlerts";

function loadShownAlerts() {
  try { return new Set(JSON.parse(sessionStorage.getItem(ALERT_STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}

function saveShownAlerts(shown) {
  try { sessionStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify([...shown])); }
  catch { /* storage unavailable: alerts still work, they just may repeat */ }
}

// Forget alerts for products that are no longer critical/out, so a later drop alerts again
function pruneAlerts(products) {
  const current = new Set(products
    .filter(p => ALERT_MESSAGES[p.STOCK_STATUS])
    .map(p => `${p.PRODUCTID}:${p.STOCK_STATUS}`));
  const shown = loadShownAlerts();
  [...shown].forEach(key => { if (!current.has(key)) shown.delete(key); });
  saveShownAlerts(shown);
}

// Called with the product returned by Flask after a successful stock change
function alertForProduct(product) {
  const message = ALERT_MESSAGES[product.STOCK_STATUS];
  if (!message) return;
  const key = `${product.PRODUCTID}:${product.STOCK_STATUS}`;
  const shown = loadShownAlerts();
  if (shown.has(key)) return;               // already shown: do not repeat
  shown.add(key);
  saveShownAlerts(shown);
  showToast(`${product.PRODUCTNAME}: ${message}`,
    product.STOCK_STATUS === "OUT OF STOCK" ? "alert-out" : "alert-critical", true);
}

function setProducts(products) {
  DB.Products = products;
  pruneAlerts(products);
}

async function refreshProducts() {
  setProducts(await getData("products"));
  renderProducts();
  renderDashboard();
}

// ----- Quantity dialog (built here, so index.html needs no change) -----
const stockDialog = document.createElement("dialog");
stockDialog.id = "stockDialog";
stockDialog.innerHTML = `
  <form id="stockForm" novalidate>
    <h3 id="stockTitle"></h3>
    <p id="stockInfo"></p>
    <label for="stockQty">Quantity</label>
    <input id="stockQty" type="number" min="1" step="1" inputmode="numeric" autocomplete="off">
    <p id="stockError" class="stock-error" role="alert"></p>
    <div class="dialog-actions">
      <button type="button" id="stockCancel" class="btn-secondary">Cancel</button>
      <button type="submit" id="stockConfirm" class="btn-primary">Confirm</button>
    </div>
  </form>`;
document.body.appendChild(stockDialog);

function setStockBusy(flag) {
  stockBusy = flag;
  document.querySelectorAll(".stock-btn").forEach(button => {
    button.disabled = flag || button.dataset.empty === "1";
  });
  $("stockConfirm").disabled = flag;
  $("stockCancel").disabled = flag;
  $("stockQty").disabled = flag;
}

function openStockDialog(product, action) {
  activeStock = { id: product.PRODUCTID, action };
  $("stockTitle").textContent =
    `${action === "add" ? "Add" : "Remove"} stock: ${product.PRODUCTNAME}`;
  $("stockInfo").textContent = `Current stock: ${product.STOCK_QUANTITY}`;
  $("stockConfirm").textContent = action === "add" ? "Add Stock" : "Remove Stock";
  $("stockQty").value = "";
  $("stockError").textContent = "";
  stockDialog.showModal();
  $("stockQty").focus();
}

async function sendStockChange(productId, action, quantity) {
  let response;
  try {
    response = await fetch(`${API}/products/${productId}/${action}-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity })
    });
  } catch {
    throw new Error("Could not reach the Flask server. Is it running?");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Stock update failed.");
  }
  return data;
}

$("stockForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (stockBusy || !activeStock) return;

  // Accept only positive whole numbers: 1, 2, 3 ...
  const text = $("stockQty").value.trim();
  if (!/^[1-9]\d*$/.test(text)) {
    $("stockError").textContent = "Enter a positive whole number (1, 2, 3 ...).";
    return;
  }
  const quantity = Number(text);

  // Early check for a friendlier message; Flask and Oracle check again
  const product = DB.Products.find(p => p.PRODUCTID === activeStock.id);
  if (activeStock.action === "remove" && product && quantity > Number(product.STOCK_QUANTITY)) {
    $("stockError").textContent =
      `Only ${product.STOCK_QUANTITY} in stock. You cannot remove more than that.`;
    return;
  }

  setStockBusy(true);                       // blocks duplicate clicks
  try {
    let result;
    try {
      result = await sendStockChange(activeStock.id, activeStock.action, quantity);
    } catch (error) {
      $("stockError").textContent = error.message;   // dialog stays open
      return;
    }
    stockDialog.close();
    showToast(result.message, "success");
    try {
      await refreshProducts();
      alertForProduct(result.product);
    } catch {
      showToast("Stock was saved, but the table could not refresh. Reload the page.", "error");
    }
  } finally {
    setStockBusy(false);
  }
});

$("stockCancel").addEventListener("click", () => { if (!stockBusy) stockDialog.close(); });
// Stop the Esc key from closing the dialog while a request is running
stockDialog.addEventListener("cancel", event => { if (stockBusy) event.preventDefault(); });

// One click listener for ALL buttons in the table (works after every re-render)
$("productsTable").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || stockBusy) return;
  const product = DB.Products.find(p => String(p.PRODUCTID) === button.dataset.id);
  if (product) openStockDialog(product, button.dataset.action);
});

/* ===================================================================== */

function dashboardAlertText(product) {
  const name = product.PRODUCTNAME;
  if (product.STOCK_STATUS === "OUT OF STOCK") return `🚨 Out of Stock Alert — ${name} is unavailable!`;
  if (product.STOCK_STATUS === "CRITICAL STOCK") return `⚠️ Critical Stock Alert — only 1 ${name} remaining!`;
  return `${name}: ${product.STOCK_QUANTITY} left`;
}

function renderDashboard() {
  const totalSales = DB.Payments.reduce(
    (sum, payment) => sum + Number(payment.AMOUNT || 0), 0
  );

  const cards = [
    ["Total customers", DB.Customers.length],
    ["Total products", DB.Products.length],
    ["Total orders", DB.Orders.length],
    ["Total payments received", money(totalSales)]
  ];

  $("stats").innerHTML = cards.map(([label, value]) =>
    `<div class="stat">
      <div class="label">${label}</div>
      <div class="number">${value}</div>
    </div>`
  ).join("");

  // Products that need attention (anything not IN STOCK), lowest stock first
  const attention = DB.Products
    .filter(p => p.STOCK_STATUS && p.STOCK_STATUS !== "IN STOCK")
    .sort((a, b) => Number(a.STOCK_QUANTITY) - Number(b.STOCK_QUANTITY));
  const shown = attention.slice(0, 8);

  $("lowStockList").innerHTML = attention.length
    ? shown.map(p =>
        `<li class="stock-item ${STATUS_CLASS[p.STOCK_STATUS] || ""}">
          <span>${escapeHTML(dashboardAlertText(p))}</span>${statusBadge(p.STOCK_STATUS)}
        </li>`).join("") +
      (attention.length > shown.length
        ? `<li>${attention.length - shown.length} more products need attention. See Products &amp; Stock.</li>`
        : "")
    : "<li>All products have enough stock.</li>";

  const latest = [...DB.Orders]
    .sort((a, b) => Number(b.ORDERID) - Number(a.ORDERID))
    .slice(0, 5);

  $("recentOrders").innerHTML = buildTable(
    ["Order ID", "Customer", "Date"],
    latest.map(o => [
      escapeHTML(o.ORDERID),
      escapeHTML(`${o.FIRSTNAME || ""} ${o.LASTNAME || ""}`.trim() || "Unknown"),
      formatDate(o.ORDERDATE)
    ])
  );
}

function renderCustomers() {
  const query = $("customerSearch").value.trim().toLowerCase();

  const rows = DB.Customers.filter(c =>
    [c.CUSTOMERID, c.FIRSTNAME, c.LASTNAME, c.EMAIL]
      .join(" ").toLowerCase().includes(query)
  );

  $("customerCount").textContent =
    `Showing ${rows.length} of ${DB.Customers.length} customers`;

  $("customersTable").innerHTML = buildTable(
    ["Customer ID", "First name", "Last name", "Email"],
    rows.map(c => [
      escapeHTML(c.CUSTOMERID),
      escapeHTML(c.FIRSTNAME),
      escapeHTML(c.LASTNAME),
      escapeHTML(c.EMAIL)
    ])
  );
}

function renderProducts() {
  const query = $("productSearch").value.trim().toLowerCase();

  const rows = DB.Products.filter(p =>
    [p.PRODUCTID, p.PRODUCTNAME, p.PRICE, p.STOCK_STATUS]
      .join(" ").toLowerCase().includes(query)
  );

  $("productCount").textContent =
    `Showing ${rows.length} of ${DB.Products.length} products`;

  $("productsTable").innerHTML = buildTable(
    ["Product ID", "Product name", "Price", "Stock quantity", "Stock status", "Actions"],
    rows.map(p => [
      escapeHTML(p.PRODUCTID),
      escapeHTML(p.PRODUCTNAME),
      money(p.PRICE),
      escapeHTML(p.STOCK_QUANTITY),
      statusBadge(p.STOCK_STATUS),
      actionButtons(p)
    ])
  );
}

function renderOrders() {
  $("ordersTable").innerHTML = buildTable(
    ["Order ID", "Customer ID", "Customer name", "Order date", "Payment"],
    DB.Orders.map(o => [
      escapeHTML(o.ORDERID),
      escapeHTML(o.CUSTOMERID),
      escapeHTML(`${o.FIRSTNAME || ""} ${o.LASTNAME || ""}`.trim() || "Unknown"),
      formatDate(o.ORDERDATE),
      Number(o.TOTALPAID || 0) > 0
        ? money(o.TOTALPAID)
        : "No payment yet"
    ])
  );
}

function renderPayments() {
  const total = DB.Payments.reduce(
    (sum, p) => sum + Number(p.AMOUNT || 0), 0
  );

  $("paymentSummary").textContent =
    `${DB.Payments.length} payments, ${money(total)} received in total`;

  $("paymentsTable").innerHTML = buildTable(
    ["Payment ID", "Order ID", "Payment date", "Amount", "Payment method"],
    DB.Payments.map(p => [
      escapeHTML(p.PAYMENTID),
      escapeHTML(p.ORDERID),
      formatDate(p.PAYMENTDATE),
      money(p.AMOUNT),
      escapeHTML(p.PAYMENTMETHOD)
    ])
  );
}

function showSection(name) {
  document.querySelectorAll(".panel").forEach(panel =>
    panel.classList.toggle("active", panel.id === name)
  );

  document.querySelectorAll(".nav-btn").forEach(button =>
    button.classList.toggle("active", button.dataset.section === name)
  );
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

$("customerSearch").addEventListener("input", renderCustomers);
$("productSearch").addEventListener("input", renderProducts);

async function loadDatabaseData() {
  try {
    const [customers, products, orders, payments] = await Promise.all([
      getData("customers"),
      getData("products"),
      getData("orders"),
      getData("payments")
    ]);

    DB.Customers = customers;
    setProducts(products);
    DB.Orders = orders;
    DB.Payments = payments;

    renderDashboard();
    renderCustomers();
    renderProducts();
    renderOrders();
    renderPayments();

    const banner = document.querySelector(".demo-banner");
    banner.textContent = "Live data loaded from Oracle through Flask.";
  } catch (error) {
    console.error("Database connection error:", error);
    document.querySelector(".demo-banner").textContent =
      "Unable to load live data. Check Flask, Oracle, and the API endpoints.";
  }
}

loadDatabaseData();