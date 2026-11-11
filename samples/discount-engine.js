/* Cart discount engine (excerpt, cleaned).
   The browser only DISPLAYS a price. The pay function recomputes everything server side and
   rejects a mismatch, so these rules mirror the server exactly, including its minimum-subtotal gate,
   so the customer never sees a discount they will not actually get. */

function normCode(s) { return String(s || "").trim().toUpperCase(); }

/* Resolve a typed code: configured promo, then free-shipping code, then a server-validated referral. */
function defFor(code, cfg, referralCache) {
  code = normCode(code);
  if (!code) return null;
  for (const d of cfg.discounts || []) if (normCode(d.code) === code) return d;
  if ((cfg.freeShipCodes || []).map(normCode).includes(code)) return { code, type: "freeship" };
  return referralCache[code] || null;   // filled by a live, anti-enumeration lookup
}

/* What one definition saves against a subtotal. Rounding happens once on the sum, like the server. */
function savingsOf(def, subtotal) {
  if (!def) return { disc: 0, free: false };
  if ((+def.min_subtotal || 0) > 0 && subtotal < +def.min_subtotal) return { disc: 0, free: false };
  const free = !!def.freeship || def.type === "freeship";
  if (def.type === "percent") return { disc: Math.min(subtotal * (+def.value || 0) / 100, subtotal), free };
  if (def.type === "flat") return { disc: Math.min(+def.value || 0, subtotal), free };
  return { disc: 0, free };
}

/* One customer code per order: a newly validated code replaces the old one, and a bad code
   can never knock out a good one because the swap only happens after validation succeeds. */
async function applyCode(raw, state, validate) {
  const code = normCode(raw);
  if (!code) return state;
  const def = await validate(code);          // network check with timeout; "try again" is never "invalid"
  if (!def) return { ...state, message: `${code} isn't a valid code` };
  return { ...state, codes: [code], message: "" };
}

module.exports = { normCode, defFor, savingsOf, applyCode };
