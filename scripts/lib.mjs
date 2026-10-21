// Shared helpers for the build/import/add scripts. Zero dependencies.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[\/.:]+/g, " ").replace(/[^\w\s-]/g, "")
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "item";

export const VERDICTS = ["adopt", "have", "trial", "assess", "reference", "skip"];

/** Map free-text verdicts ("adopt first", "pick-one", "avoid", ...) onto the 6-value enum. */
export function normVerdict(v) {
  const s = String(v || "").toLowerCase().trim();
  if (!s) return null;
  if (VERDICTS.includes(s)) return s;
  if (/^(skip|avoid|dead|no\b|duplicate|replace)/.test(s)) return "skip";
  if (/^(have|already|core)/.test(s)) return "have";
  if (/^adopt|^api$|^browser agent|one immediate adopt/.test(s)) return "adopt";
  if (/^(try|trial|pilot|steal|pick-one)/.test(s)) return "trial";
  if (/reference|niche|specialist/.test(s)) return "reference";
  return "assess"; // optional, verify, careful, watch, high potential...
}

export const REQUIRED = ["id", "name", "kind", "category"];

export function loadLibrary(root) {
  const dir = join(root, "library");
  const collections = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const c = JSON.parse(readFileSync(join(dir, f), "utf8"));
    collections[c.collection] = c;
  }
  return collections;
}
