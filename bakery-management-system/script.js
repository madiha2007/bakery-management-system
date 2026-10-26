/* script.js - Bakery Management System (DEMONSTRATION VERSION)
   -----------------------------------------------------------
   This file does three simple things:
     1. Stores demo data that copies the rows in the Oracle script.
     2. Draws the tables and totals on the page.
     3. Handles the sidebar buttons and the search boxes.
   It does NOT talk to Oracle, and it contains no passwords. */

// ============ 1. SETTINGS (change these if you like) ============
const CURRENCY = "₹";        // the SQL schema does not store a currency, so this is only for display
const LOW_STOCK_LIMIT = 10;  // Products below this stock are marked "Low stock" (the schema has no reorder-level column)

// ============ 2. DEMO DATA ============
// Each list below has the SAME name and the SAME column names as the table in the SQL file.
// makeRows() just turns compact lists into objects like {CustomerID: 1, FirstName: 'Alice', ...}.
function makeRows(columns, values) {
  return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

// The SQL script uses SYSTIMESTAMP - INTERVAL 'n' DAY for order dates; this does the same.
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

const DB = {
  // Customers(CustomerID, FirstName, LastName, Email). There is no phone column in the schema.
  // Customer 1's email is the one set by the UpdateCustomerEmail procedure in the script.
  Customers: makeRows(["CustomerID", "FirstName", "LastName", "Email"], [
    [1, "Alice", "Smith", "alice.updated@example.com"],
    [2, "Bob", "Johnson", "bob.johnson@example.com"],
    [3, "Catherine", "Williams", "catherine.williams@example.com"],
    [4, "David", "Brown", "david.brown@example.com"],
    [5, "Eva", "Jones", "eva.jones@example.com"],
    [6, "Frank", "Garcia", "frank.garcia@example.com"],
    [7, "Grace", "Martinez", "grace.martinez@example.com"],
    [8, "Henry", "Davis", "henry.davis@example.com"],
    [9, "Irene", "Rodriguez", "irene.rodriguez@example.com"],
    [10, "Jack", "Hernandez", "jack.hernandez@example.com"],
    [11, "Karen", "Lopez", "karen.lopez@example.com"],
    [12, "Liam", "Gonzalez", "liam.gonzalez@example.com"],
    [13, "Mia", "Wilson", "mia.wilson@example.com"],
    [14, "Noah", "Anderson", "noah.anderson@example.com"],
    [15, "Olivia", "Thomas", "olivia.thomas@example.com"]
  ]),

  // Products(ProductID, ProductName, Price, StockQuantity).
  // StockQuantity is added by ALTER TABLE in the SQL script (default 0) and the script never fills it.
  // So the stock numbers below are DEMO numbers only.
  Products: makeRows(["ProductID", "ProductName", "Price", "StockQuantity"], [
    [1, "Chocolate Cake", 25.00, 8],
    [2, "Vanilla Cupcake", 12.50, 40],
    [3, "Red Velvet Cake", 30.00, 5],
    [4, "Blueberry Muffin", 10.00, 24],
    [5, "Croissant", 5.00, 60],
    [6, "Apple Pie", 20.00, 12],
    [7, "Banana Bread", 15.00, 3],
    [8, "Lemon Tart", 18.00, 15],
    [9, "Pecan Pie", 22.00, 0],
    [10, "Cheese Danish", 6.00, 18],
    [11, "Chocolate Chip Cookie", 1.50, 120],
    [12, "Oatmeal Raisin Cookie", 1.25, 95],
    [13, "Brownie", 3.00, 9],
    [14, "Fruit Tart", 28.00, 6],
    [15, "Pistachio Cake", 35.00, 14]
  ]),

  // Categories(CategoryID, CategoryName)
  Categories: makeRows(["CategoryID", "CategoryName"], [
    [1, "Bread"], [2, "Pastries"], [3, "Cakes"], [4, "Cookies"], [5, "Brownies"],
    [6, "Muffins"], [7, "Danishes"], [8, "Cupcakes"], [9, "Tarts"], [10, "Pies"],
    [11, "Sourdough"], [12, "Baguettes"], [13, "Croissants"], [14, "Cheesecakes"], [15, "Fruit Breads"]
  ]),

  // ProductCategoryMap(ProductID, CategoryID): links each product to its category
  ProductCategoryMap: makeRows(["ProductID", "CategoryID"], [
    [1, 3], [2, 8], [3, 3], [4, 6], [5, 13], [6, 10], [7, 1], [8, 9],
    [9, 10], [10, 7], [11, 4], [12, 4], [13, 5], [14, 9], [15, 3]
  ]),

  // Orders(OrderID, OrderDate, CustomerID). No status column and no total column in the schema.
  // Order 32 is the one created by the PlaceOrder(1) call in the script; it has no payment yet.
  Orders: makeRows(["OrderID", "OrderDate", "CustomerID"], [
    [17, daysAgo(15), 1], [18, daysAgo(14), 2], [19, daysAgo(13), 3], [20, daysAgo(12), 4],
    [21, daysAgo(11), 5], [22, daysAgo(10), 6], [23, daysAgo(9), 7], [24, daysAgo(8), 8],
    [25, daysAgo(7), 9], [26, daysAgo(6), 10], [27, daysAgo(5), 11], [28, daysAgo(4), 12],
    [29, daysAgo(3), 13], [30, daysAgo(2), 14], [31, daysAgo(1), 15], [32, daysAgo(0), 1]
  ]),

  // Payments(PaymentID, OrderID, PaymentDate, Amount, PaymentMethod). No status column in the schema.
  // Payment 16 is the 125.00 test payment inserted to demonstrate the trigger.
  Payments: makeRows(["PaymentID", "OrderID", "PaymentDate", "Amount", "PaymentMethod"], [
    [1, 17, daysAgo(0), 50.00, "Credit Card"], [2, 18, daysAgo(0), 30.50, "Cash"],
    [3, 19, daysAgo(0), 25.00, "Debit Card"], [4, 20, daysAgo(0), 40.00, "PayPal"],
    [5, 21, daysAgo(0), 60.00, "Credit Card"], [6, 22, daysAgo(0), 15.75, "Cash"],
    [7, 23, daysAgo(0), 22.50, "Debit Card"], [8, 24, daysAgo(0), 35.25, "Credit Card"],
    [9, 25, daysAgo(0), 45.00, "PayPal"], [10, 26, daysAgo(0), 55.00, "Cash"],
    [11, 27, daysAgo(0), 70.00, "Credit Card"], [12, 28, daysAgo(0), 80.00, "Debit Card"],
    [13, 29, daysAgo(0), 90.00, "PayPal"], [14, 30, daysAgo(0), 100.00, "Cash"],
    [15, 31, daysAgo(0), 110.00, "Credit Card"], [16, 17, daysAgo(0), 125.00, "Credit Card"]
  ])
};

// ============ 3. SMALL HELPER FUNCTIONS ============
const $ = id => document.getElementById(id);
const money = n => CURRENCY + Number(n).toFixed(2);
const fmtDate = d => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
// esc() stops text from being treated as HTML (good habit whenever data is put into a page)
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// These mimic SQL joins: find the matching row in another table using the foreign key.
function customerName(id) {                       // Orders.CustomerID -> Customers
  const c = DB.Customers.find(x => x.CustomerID === id);
  return c ? c.FirstName + " " + c.LastName : "Unknown";
}
function categoryOf(productId) {                  // Products -> ProductCategoryMap -> Categories
  const link = DB.ProductCategoryMap.find(m => m.ProductID === productId);
  const cat = link && DB.Categories.find(c => c.CategoryID === link.CategoryID);
  return cat ? cat.CategoryName : "-";
}
function paidForOrder(orderId) {                  // Payments.OrderID -> Orders (SUM of Amount)
  return DB.Payments.filter(p => p.OrderID === orderId).reduce((sum, p) => sum + p.Amount, 0);
}
function stockBadge(qty) {
  if (qty === 0) return '<span class="badge out">Out of stock</span>';
  if (qty < LOW_STOCK_LIMIT) return '<span class="badge low">Low stock</span>';
  return '<span class="badge ok">In stock</span>';
}

// Builds an HTML table. headers = list of column titles, rows = list of lists of cell HTML,
// rightCols = positions of number columns that should be right-aligned.
function buildTable(headers, rows, rightCols = []) {
  const cls = i => (rightCols.includes(i) ? ' class="right"' : "");
  const head = headers.map((h, i) => `<th${cls(i)}>${h}</th>`).join("");
  const body = rows.map(r => "<tr>" + r.map((c, i) => `<td${cls(i)}>${c}</td>`).join("") + "</tr>").join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ============ 4. DRAWING EACH SECTION ============
function renderDashboard() {
  // Same idea as: SELECT COUNT(*) FROM Customers;  SELECT SUM(Amount) FROM Payments;
  const totalSales = DB.Payments.reduce((sum, p) => sum + p.Amount, 0);
  const cards = [
    { tone: "rose",   label: "Total customers", value: DB.Customers.length, from: "Rows in Customers" },
    { tone: "butter", label: "Total products",  value: DB.Products.length,  from: "Rows in Products" },
    { tone: "mint",   label: "Total orders",    value: DB.Orders.length,    from: "Rows in Orders" },
    { tone: "lilac",  label: "Total sales",     value: money(totalSales),   from: "SUM of Payments.Amount" }
  ];
  $("stats").innerHTML = cards.map(c =>
    `<div class="stat ${c.tone}"><div class="label">${c.label}</div>
     <div class="number">${c.value}</div><div class="from">${c.from}</div></div>`).join("");

  // Low-stock list: Products with StockQuantity below the limit, lowest first
  const low = DB.Products.filter(p => p.StockQuantity < LOW_STOCK_LIMIT)
                         .sort((a, b) => a.StockQuantity - b.StockQuantity);
  $("lowStockList").innerHTML = low.length
    ? low.map(p => `<li><span>${esc(p.ProductName)} (${p.StockQuantity} left)</span>${stockBadge(p.StockQuantity)}</li>`).join("")
    : "<li>All products have enough stock.</li>";

  // Latest 5 orders (highest OrderID first)
  const latest = [...DB.Orders].sort((a, b) => b.OrderID - a.OrderID).slice(0, 5);
  $("recentOrders").innerHTML = buildTable(["Order", "Customer", "Date"],
    latest.map(o => [o.OrderID, esc(customerName(o.CustomerID)), fmtDate(o.OrderDate)]));
}

function renderCustomers() {
  const q = $("customerSearch").value.trim().toLowerCase();
  const list = DB.Customers.filter(c =>
    [c.CustomerID, c.FirstName, c.LastName, c.Email].join(" ").toLowerCase().includes(q));
  $("customerCount").textContent = `Showing ${list.length} of ${DB.Customers.length} customers`;
  $("customersTable").innerHTML = list.length
    ? buildTable(["Customer ID", "First name", "Last name", "Email", "Orders placed"],
        list.map(c => [c.CustomerID, esc(c.FirstName), esc(c.LastName), esc(c.Email),
                       DB.Orders.filter(o => o.CustomerID === c.CustomerID).length]), [4])
    : '<p class="empty">No customers match your search. Try a name, email or ID.</p>';
}

function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const list = DB.Products.filter(p =>
    [p.ProductID, p.ProductName, categoryOf(p.ProductID)].join(" ").toLowerCase().includes(q));
  $("productCount").textContent = `Showing ${list.length} of ${DB.Products.length} products`;
  $("productsTable").innerHTML = list.length
    ? buildTable(["Product ID", "Product name", "Category", "Price", "Stock quantity", "Stock status"],
        list.map(p => [p.ProductID, esc(p.ProductName), esc(categoryOf(p.ProductID)),
                       money(p.Price), p.StockQuantity, stockBadge(p.StockQuantity)]), [3, 4])
    : '<p class="empty">No products match your search. Try a name or category.</p>';
}

function renderOrders() {
  $("ordersTable").innerHTML = buildTable(
    ["Order ID", "Customer ID", "Customer name", "Order date", "Payment"],
    DB.Orders.map(o => {
      const paid = paidForOrder(o.OrderID);
      const payment = paid > 0 ? `<span class="badge ok">Paid</span> ${money(paid)}`
                               : '<span class="badge low">No payment yet</span>';
      return [o.OrderID, o.CustomerID, esc(customerName(o.CustomerID)), fmtDate(o.OrderDate), payment];
    }));
}

function renderPayments() {
  const total = DB.Payments.reduce((sum, p) => sum + p.Amount, 0);
  $("paymentSummary").textContent = `${DB.Payments.length} payments, ${money(total)} received in total`;
  $("paymentsTable").innerHTML = buildTable(
    ["Payment ID", "Order ID", "Payment date", "Amount", "Payment method"],
    DB.Payments.map(p => [p.PaymentID, p.OrderID, fmtDate(p.PaymentDate), money(p.Amount), esc(p.PaymentMethod)]),
    [3]);
}

// ============ 5. SIDEBAR NAVIGATION + SEARCH ============
function showSection(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === name));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === name));
}

document.querySelectorAll(".nav-btn").forEach(btn =>
  btn.addEventListener("click", () => showSection(btn.dataset.section)));

// Re-draw the table every time the person types in a search box
$("customerSearch").addEventListener("input", renderCustomers);
$("productSearch").addEventListener("input", renderProducts);

// Draw everything once when the page opens
renderDashboard();
renderCustomers();
renderProducts();
renderOrders();
renderPayments();
