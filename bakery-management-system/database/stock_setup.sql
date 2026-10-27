-- stock_setup.sql : Oracle changes for stock management
-- Run in SQL Developer (F5) while connected as the SAME user Flask uses (your app.py uses SYSTEM).
-- Run the steps in order. Steps 2-4 are safe to run twice.

------------------------------------------------------------
-- STEP 1: INSPECT (read-only). Look at the result before going further.
------------------------------------------------------------
SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT
FROM USER_TAB_COLUMNS
WHERE TABLE_NAME = 'PRODUCTS'
ORDER BY COLUMN_ID;

SELECT TRIGGER_NAME, STATUS FROM USER_TRIGGERS WHERE TABLE_NAME = 'PRODUCTS';

-- Your original script adds the column STOCKQUANTITY (section 19), so it is probably listed.
--   * STOCKQUANTITY listed      -> reuse it. This file is already written for that name.
--   * STOCK_QUANTITY listed     -> use that name instead: in Step 3 replace STOCKQUANTITY with
--                                  STOCK_QUANTITY (3 places) and set STOCK_COL in app.py.
--   * neither column listed     -> run the commented ALTER below, then use STOCK_QUANTITY as above.
-- ALTER TABLE Products ADD (STOCK_QUANTITY NUMBER DEFAULT 0 NOT NULL);

------------------------------------------------------------
-- STEP 2: ADD STOCK_STATUS only if it does not exist yet (no duplicate column)
------------------------------------------------------------
DECLARE
    n NUMBER;
BEGIN
    SELECT COUNT(*) INTO n FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'PRODUCTS' AND COLUMN_NAME = 'STOCK_STATUS';
    IF n = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE Products ADD (STOCK_STATUS VARCHAR2(20) DEFAULT ''OUT OF STOCK'' NOT NULL)';
    END IF;
END;
/

------------------------------------------------------------
-- STEP 3: THE TRIGGER - Oracle decides the status, not Python or JavaScript
------------------------------------------------------------
CREATE OR REPLACE TRIGGER TRG_STOCK_STATUS
BEFORE INSERT OR UPDATE OF STOCKQUANTITY ON Products
FOR EACH ROW
BEGIN
    IF :NEW.STOCKQUANTITY < 0 THEN
        RAISE_APPLICATION_ERROR(-20010, 'Stock quantity cannot be negative.');
    END IF;

    :NEW.STOCK_STATUS := CASE
        WHEN :NEW.STOCKQUANTITY = 0 THEN 'OUT OF STOCK'
        WHEN :NEW.STOCKQUANTITY = 1 THEN 'CRITICAL STOCK'
        WHEN :NEW.STOCKQUANTITY <= 5 THEN 'LOW STOCK'
        ELSE 'IN STOCK'
    END;
END TRG_STOCK_STATUS;
/

------------------------------------------------------------
-- STEP 4: FILL STATUS FOR EXISTING ROWS
-- Setting a column to itself fires the trigger but does NOT change any quantity.
------------------------------------------------------------
UPDATE Products SET STOCKQUANTITY = STOCKQUANTITY;
COMMIT;

SELECT PRODUCTID, PRODUCTNAME, STOCKQUANTITY, STOCK_STATUS FROM Products ORDER BY PRODUCTID;
-- Note: the original script never fills STOCKQUANTITY, so every product starts at 0 (OUT OF STOCK).
-- Use the Add Stock buttons on the page to give products stock.

------------------------------------------------------------
-- STEP 5: TRIGGER TEST (changes are undone by the ROLLBACK at the end)
------------------------------------------------------------
SAVEPOINT trigger_test;

UPDATE Products SET STOCKQUANTITY = 1 WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products);
SELECT PRODUCTID, STOCKQUANTITY, STOCK_STATUS FROM Products WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products); -- CRITICAL STOCK

UPDATE Products SET STOCKQUANTITY = 3 WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products);
SELECT PRODUCTID, STOCKQUANTITY, STOCK_STATUS FROM Products WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products); -- LOW STOCK

UPDATE Products SET STOCKQUANTITY = 6 WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products);
SELECT PRODUCTID, STOCKQUANTITY, STOCK_STATUS FROM Products WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products); -- IN STOCK

UPDATE Products SET STOCKQUANTITY = 0 WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products);
SELECT PRODUCTID, STOCKQUANTITY, STOCK_STATUS FROM Products WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products); -- OUT OF STOCK

-- Negative stock must fail with ORA-20010 (this statement is expected to give an error):
UPDATE Products SET STOCKQUANTITY = -1 WHERE PRODUCTID = (SELECT MIN(PRODUCTID) FROM Products);

ROLLBACK TO trigger_test;
