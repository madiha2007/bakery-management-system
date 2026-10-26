# Bakery Management System (DBMS Mini-Project)

A simple bakery dashboard built with HTML, CSS and vanilla JavaScript, based on my Oracle SQL script.

> **Important:** this version shows **demonstration data** typed into `script.js`. It copies the rows
> of the Oracle script, but it is **not connected to a live Oracle database**.

## Folder structure

```
bakery-management-system/
├── index.html      page structure (sidebar + five sections)
├── style.css       cream / brown / pastel theme
├── script.js       demo data, tables, totals, navigation, search
├── queries.sql     SQL queries behind each dashboard section
├── README.md       this file
└── database/
    └── Bakery_DBMS_Full_Syllabus_Oracle_Updated (2).sql   original script, unchanged
```

## How to open the project

1. Keep all files together and keep the `database` folder as it is.
2. Double-click `index.html`. It opens in any browser, with no installation and no internet needed.

## What the SQL file does

The original script, in a new/empty Oracle schema, creates and fills these tables:
`Customers`, `Products`, `Categories`, `Orders`, `Payments`, `Reviews`, `ProductCategoryMap`, `PaymentLog`
(plus normalization study tables). It also has views, indexes, a sequence, functions, a procedure,
a trigger and constraint tests. The dashboard uses only the tables listed below.

## Which table feeds which section

| Dashboard section | Tables used | Columns shown |
|---|---|---|
| Dashboard totals | Customers, Products, Orders, Payments | `COUNT(*)` of the first three; `SUM(Payments.Amount)` for total sales |
| Low-stock list | Products | ProductName, StockQuantity (below 10) |
| Customer Details | Customers (+ Orders for the count) | CustomerID, FirstName, LastName, Email, orders placed |
| Products & Stock | Products, ProductCategoryMap, Categories | ProductID, ProductName, CategoryName, Price, StockQuantity |
| Orders | Orders, Customers, Payments | OrderID, CustomerID, customer name, OrderDate, whether a payment exists |
| Payments | Payments | PaymentID, OrderID, PaymentDate, Amount, PaymentMethod |

Relationships used (all from the script): `Orders.CustomerID -> Customers`, `Payments.OrderID -> Orders`,
`ProductCategoryMap.ProductID -> Products`, `ProductCategoryMap.CategoryID -> Categories`.

## What the schema does not have (nothing was invented)

- **Customers:** no phone number or address column, so none is shown.
- **Orders:** no status column and no total. The Orders page shows "Paid / No payment yet", which is worked out by checking whether a row exists in `Payments`. It is not a stored status.
- **Payments:** no status column, so none is shown.
- **Products:** `StockQuantity` is added by `ALTER TABLE` (section 19 of the script) with default 0, and the script never fills it. After running the script, every product has stock 0. The stock numbers on the page are demo numbers. `queries.sql` ends with an optional, commented `UPDATE` that loads the same numbers into Oracle if you want them to match.
- **Order items:** no table links orders to products (the `Norm_*` tables are normalization examples and are not connected to `Orders`), so the dashboard cannot show what was in an order.
- **Currency:** the schema stores plain numbers. The page shows `₹`, set by `CURRENCY` at the top of `script.js`.
- The low-stock limit (10) is a setting in `script.js` (`LOW_STOCK_LIMIT`), because the schema has no reorder-level column.

## Run the SQL in Oracle SQL Developer

1. Connect to a **new/empty** schema (the script creates tables and should be run once).
2. Open `database/Bakery_DBMS_Full_Syllabus_Oracle_Updated (2).sql` (File > Open).
3. Press **F5** (Run Script) and check the Script Output tab.
4. Open `queries.sql`. Click inside one query and press **Ctrl+Enter** to run it, or press F5 for all.

The demo data matches the state after the whole script has run (15 customers, 15 products, orders 17 to 32, 16 payments, Alice's updated email).

## Showing live Oracle data later (safe way)

Never put the database username or password in `script.js`: anyone can read it in the browser.
The simplest safe route is a small server-side layer that holds the credentials and returns data as JSON,
for example Oracle REST Data Services (ORDS), which SQL Developer can enable on a table, or a tiny
backend that reads credentials from environment variables. Then `script.js` would call
`fetch("/api/customers")` instead of using `DB.Customers`. This is beyond the scope of this mini-project.

## Short viva guide

1. **What is it?** A bakery dashboard whose structure follows my Oracle schema.
2. **Is it live?** No. It uses demo data copied from the SQL script, and it says so on the page.
3. **Where does each page get its data?** Use the table above. Each page also names its tables under the heading.
4. **Show the SQL:** open the file in `database`, point to `CREATE TABLE`, the primary keys and the foreign keys.
5. **Show a join:** run the Orders query from `queries.sql`. It does in SQL what `customerName()` does in JavaScript.
6. **Why no status or phone?** They are not in my schema, and I did not change the database to add them.
7. **How would it become live?** Add an API between Oracle and the page so the password stays on the server.

Demo order: Dashboard, Customers (search "alice"), Products (search "cake", point at low-stock badges),
Orders (order 32 has no payment), Payments, then the SQL file and `queries.sql` in SQL Developer.
