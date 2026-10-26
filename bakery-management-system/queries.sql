-- queries.sql : queries behind each dashboard section
-- Run these AFTER the original script (database folder) has been run once in SQL Developer.
-- Select one query and press Ctrl+Enter, or press F5 to run the whole file.
-- Every column used here exists in the original script. Nothing is created or changed
-- except in the optional block at the very end.

------------------------------------------------------------
-- 1. DASHBOARD: the four totals
------------------------------------------------------------
SELECT (SELECT COUNT(*)    FROM Customers) AS TotalCustomers,
       (SELECT COUNT(*)    FROM Products)  AS TotalProducts,
       (SELECT COUNT(*)    FROM Orders)    AS TotalOrders,
       (SELECT SUM(Amount) FROM Payments)  AS TotalSales
FROM DUAL;

------------------------------------------------------------
-- 2. CUSTOMER DETAILS (Customers table + order count from Orders)
------------------------------------------------------------
SELECT c.CustomerID, c.FirstName, c.LastName, c.Email,
       COUNT(o.OrderID) AS OrdersPlaced
FROM Customers c
LEFT JOIN Orders o ON o.CustomerID = c.CustomerID
GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email
ORDER BY c.CustomerID;

------------------------------------------------------------
-- 3. PRODUCTS & STOCK (Products + ProductCategoryMap + Categories)
-- StockQuantity exists because the script runs ALTER TABLE Products ADD (StockQuantity ...).
------------------------------------------------------------
SELECT p.ProductID, p.ProductName, c.CategoryName, p.Price, p.StockQuantity
FROM Products p
LEFT JOIN ProductCategoryMap m ON m.ProductID = p.ProductID
LEFT JOIN Categories c         ON c.CategoryID = m.CategoryID
ORDER BY p.ProductID;

-- Low-stock indicator (the dashboard uses "below 10")
SELECT ProductID, ProductName, StockQuantity
FROM Products
WHERE StockQuantity < 10
ORDER BY StockQuantity;

-- Search box: customers and products (case-insensitive)
SELECT CustomerID, FirstName, LastName, Email
FROM Customers
WHERE UPPER(FirstName || ' ' || LastName || ' ' || Email) LIKE UPPER('%alice%');

SELECT ProductID, ProductName, Price
FROM Products
WHERE UPPER(ProductName) LIKE UPPER('%cake%');

------------------------------------------------------------
-- 4. ORDERS (Orders + Customers). There is no status column in Orders.
------------------------------------------------------------
SELECT o.OrderID, o.CustomerID, c.FirstName || ' ' || c.LastName AS CustomerName,
       TO_CHAR(o.OrderDate, 'DD-Mon-YYYY') AS OrderDate
FROM Orders o
JOIN Customers c ON c.CustomerID = o.CustomerID
ORDER BY o.OrderID;

-- "Payment" column of the Orders page: orders with no payment row yet
SELECT o.OrderID, o.CustomerID
FROM Orders o
WHERE NOT EXISTS (SELECT 1 FROM Payments p WHERE p.OrderID = o.OrderID);

------------------------------------------------------------
-- 5. PAYMENTS (Payments table). There is no status column in Payments.
------------------------------------------------------------
SELECT PaymentID, OrderID, TO_CHAR(PaymentDate, 'DD-Mon-YYYY') AS PaymentDate,
       Amount, PaymentMethod
FROM Payments
ORDER BY PaymentID;

-- Total received per payment method
SELECT PaymentMethod, COUNT(*) AS Payments, SUM(Amount) AS TotalAmount
FROM Payments
GROUP BY PaymentMethod
ORDER BY TotalAmount DESC;

------------------------------------------------------------
-- OPTIONAL (commented out): demo stock numbers
-- The original script adds StockQuantity but leaves every value at 0, so the live
-- low-stock query would flag ALL products. To get the same numbers as the demo page,
-- remove the comment marks and run this block. It changes data, so it is your choice.
------------------------------------------------------------
-- UPDATE Products SET StockQuantity = CASE ProductID
--   WHEN 1 THEN 8   WHEN 2 THEN 40  WHEN 3 THEN 5   WHEN 4 THEN 24  WHEN 5 THEN 60
--   WHEN 6 THEN 12  WHEN 7 THEN 3   WHEN 8 THEN 15  WHEN 9 THEN 0   WHEN 10 THEN 18
--   WHEN 11 THEN 120 WHEN 12 THEN 95 WHEN 13 THEN 9 WHEN 14 THEN 6  WHEN 15 THEN 14
--   ELSE StockQuantity END;
-- COMMIT;
