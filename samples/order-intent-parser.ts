// Customer DM intent parser (excerpt, cleaned).
// Rules run first and always work. An optional LLM pass refines the result, and its output is
// re-validated exactly like untrusted user input before anything uses it.

const PRODUCTS: Record<string, { label: string; text: boolean }> = {
  "backglass-banner": { label: "Club & Group Backglass Banner", text: true },
  "front-plate": { label: "Custom Front Plate", text: true },
  "name-decal": { label: "Custom Name Decal", text: true },
  "windshield-banner": { label: "Custom Windshield Banner", text: true },
};

const NEG_RE = /\b(remove|without|delete|take off|don'?t want|not the)\b/i;

export function productFromText(s: string): string | null {
  const t = s.toLowerCase();
  if (/club|crew|back ?glass|rear window/.test(t)) return "backglass-banner";
  if (/front plate|license plate|front tag/.test(t)) return "front-plate";
  if (/windshield|sunroof/.test(t)) return "windshield-banner";
  if (/name decal|my name|last name/.test(t)) return "name-decal";
  return null;
}

export function designNo(s: string): string | null {
  if (NEG_RE.test(s)) return null;                  // "remove #3" is not a request for #3
  const m = s.match(/(?:^|[^0-9a-z])(?:#|no\.?\s*|number\s+)(\d{1,3})\b/i);
  return m ? m[1] : null;
}

/** Treat model output as hostile: whitelist shape, length and characters, drop anything else. */
export function revalidate(p: any, raw: string) {
  const out: any = {};
  if (p.product_key && PRODUCTS[p.product_key]) out.product_key = p.product_key;
  if (p.custom_text != null) {
    const v = String(p.custom_text).replace(/[^\x20-\x7E]/g, "").trim();
    out.custom_text = v && v.length <= 28 && /^[A-Za-z0-9 .'&-]+$/.test(v) ? v : null;
  }
  if (p.design_no != null) {
    const d = String(p.design_no).trim();
    out.design_no = /^\d{1,3}$/.test(d) && !NEG_RE.test(raw) ? d : null;
  }
  return out;
}

export function parse(text: string) {
  return { product_key: productFromText(text), design_no: designNo(text) };
}
