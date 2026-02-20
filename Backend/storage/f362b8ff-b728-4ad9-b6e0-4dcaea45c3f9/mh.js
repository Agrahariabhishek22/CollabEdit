/**
 * ==========================================
 * FILE-LEVEL SEMANTIC CONFLICT DEMO
 * ==========================================
 */
/* ------------------------------------------
   1️⃣ DUPLICATE SYMBOL (duplicate-symbol)
------------------------------------------- */

const taxRate = 0.18;
const taxRate = 0.20; // ❌ Duplicate declaration in same scope


/* ------------------------------------------
   2️⃣ IMMUTABLE MUTATION (immutable-violation)
------------------------------------------- */

const PI = 3.14;
PI = 3.1415; // ❌ Reassignment of const


/* ------------------------------------------
   3️⃣ UNRESOLVED REFERENCE (unresolved-reference)
------------------------------------------- */

function calculateTotal(amount) {
  return amount + discount; // ❌ 'discount' not defined anywhere
}
 

/* ------------------------------------------
   4️⃣ FUNCTION SIGNATURE DRIFT (contract-change)
------------------------------------------- */

/**
 * @param {number} amount
 * @returns {number}
 */
function applyTax(amount) {
  return amount * taxRate;
}

// Later someone edits function incorrectly:

/**
 * @param {string} amount
 * @returns {string}
 */
function applyTax(amount) { // ❌ Duplicate + signature changed
  return "Tax: " + amount;
}


/* ------------------------------------------
   5️⃣ TYPE MISMATCH (type-mismatch)
------------------------------------------- */

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}

add(10, "20"); // ❌ string passed instead of number

/* ------------------------------------------
   6️⃣ SYMBOL SHADOWING (symbol-shadowing)
------------------------------------------- */

let total = 100;

function calculate() {
  let total = 50; // ⚠ Shadowing outer variable
  return total;
}


/* ------------------------------------------
   7️⃣ EXPORT CONTRACT CHANGE (contract-change)
------------------------------------------- */

export function getUser(id) {
  return { id, name: "Alice" };
}

// Later edited:

export function getUser(id, includeDetails) { // ❌ API changed
  return { id, name: "Alice", details: includeDetails };
}


/* ------------------------------------------
   8️⃣ ACCESS STYLE MISUSE PATTERN
------------------------------------------- */

class Account {
  #balance = 0;

  deposit(amount) {
    this.#balance += amount;
  }
}

const acc = new Account();
console.log(acc.#balance); // ❌ Private field access outside class



