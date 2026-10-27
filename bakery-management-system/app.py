"""app.py - Flask backend for the Bakery Management System (now with stock management)."""
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
import oracledb

app = Flask(__name__)
CORS(app)

# ---------- Settings ----------
# Credentials are read from environment variables, so no password is stored in this file.
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_DSN = os.environ.get("DB_DSN", "localhost:1521/XE")
if not DB_USER or not DB_PASSWORD:
    raise RuntimeError("Set the DB_USER and DB_PASSWORD environment variables, then start Flask again.")

# Name of the stock column in YOUR Products table (found in Step 1 of stock_setup.sql).
# This is a fixed value written by you, never user input, so it is safe inside the SQL text.
STOCK_COL = "STOCKQUANTITY"
MAX_STOCK_CHANGE = 100000  # sanity limit for one request


def get_connection():
    return oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)


def fetch_all(sql):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


# The JSON always uses the names STOCK_QUANTITY and STOCK_STATUS (the alias hides the real column name).
PRODUCT_SELECT = f"""
    SELECT PRODUCTID, PRODUCTNAME, PRICE,
           {STOCK_COL} AS STOCK_QUANTITY, STOCK_STATUS
    FROM PRODUCTS
"""


@app.route("/api/customers")
def customers():
    return jsonify(fetch_all("""
        SELECT CUSTOMERID, FIRSTNAME, LASTNAME, EMAIL
        FROM CUSTOMERS
        ORDER BY CUSTOMERID
    """))


@app.route("/api/products")
def products():
    return jsonify(fetch_all(PRODUCT_SELECT + " ORDER BY PRODUCTID"))


@app.route("/api/orders")
def orders():
    return jsonify(fetch_all("""
        SELECT O.ORDERID, O.ORDERDATE, O.CUSTOMERID,
               C.FIRSTNAME, C.LASTNAME,
               NVL(P.TOTALPAID, 0) AS TOTALPAID
        FROM ORDERS O
        LEFT JOIN CUSTOMERS C ON C.CUSTOMERID = O.CUSTOMERID
        LEFT JOIN (
            SELECT ORDERID, SUM(AMOUNT) AS TOTALPAID
            FROM PAYMENTS
            GROUP BY ORDERID
        ) P ON P.ORDERID = O.ORDERID
        ORDER BY O.ORDERID DESC
    """))


@app.route("/api/payments")
def payments():
    return jsonify(fetch_all("""
        SELECT PAYMENTID, ORDERID, PAYMENTDATE, AMOUNT, PAYMENTMETHOD
        FROM PAYMENTS
        ORDER BY PAYMENTID
    """))


# ---------- Stock management ----------
def change_stock(product_id, direction):
    """Shared logic for add-stock and remove-stock. direction is 'add' or 'remove'."""
    data = request.get_json(silent=True) or {}
    quantity = data.get("quantity")

    # Only positive whole numbers are accepted (True/False and decimals are rejected).
    if isinstance(quantity, bool) or not isinstance(quantity, int) \
            or quantity <= 0 or quantity > MAX_STOCK_CHANGE:
        return jsonify(success=False, error="Quantity must be a positive whole number."), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if direction == "add":
                cur.execute(
                    f"UPDATE PRODUCTS SET {STOCK_COL} = {STOCK_COL} + :qty WHERE PRODUCTID = :pid",
                    qty=quantity, pid=product_id)
            else:
                # The AND condition means stock can never go below zero, even if two requests overlap.
                cur.execute(
                    f"UPDATE PRODUCTS SET {STOCK_COL} = {STOCK_COL} - :qty "
                    f"WHERE PRODUCTID = :pid AND {STOCK_COL} >= :qty",
                    qty=quantity, pid=product_id)

            if cur.rowcount == 0:
                # Nothing was updated: either the product does not exist or stock is too low.
                cur.execute(f"SELECT {STOCK_COL} FROM PRODUCTS WHERE PRODUCTID = :pid", pid=product_id)
                row = cur.fetchone()
                conn.rollback()
                if row is None:
                    return jsonify(success=False, error="Product not found."), 404
                return jsonify(success=False,
                               error=f"Cannot remove {quantity}. Only {row[0]} in stock."), 409

            # Read the row back so the status comes from Oracle (set by TRG_STOCK_STATUS).
            cur.execute(PRODUCT_SELECT + " WHERE PRODUCTID = :pid", pid=product_id)
            columns = [col[0] for col in cur.description]
            product = dict(zip(columns, cur.fetchone()))
        conn.commit()

        verb = "Added" if direction == "add" else "Removed"
        preposition = "to" if direction == "add" else "from"
        return jsonify(
            success=True,
            message=f"{verb} {quantity} {preposition} {product['PRODUCTNAME']}. "
                    f"New stock: {product['STOCK_QUANTITY']}.",
            product=product)
    except oracledb.DatabaseError as exc:
        conn.rollback()
        app.logger.error("Stock update failed: %s", exc)
        return jsonify(success=False, error="Database error while updating stock."), 500
    finally:
        conn.close()


@app.route("/api/products/<int:product_id>/add-stock", methods=["POST"])
def add_stock(product_id):
    return change_stock(product_id, "add")


@app.route("/api/products/<int:product_id>/remove-stock", methods=["POST"])
def remove_stock(product_id):
    return change_stock(product_id, "remove")


if __name__ == "__main__":
    app.run(debug=True, port=5000)