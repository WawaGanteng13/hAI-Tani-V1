import assert from "node:assert/strict";

// ponytail: scan max in-memory; pindah sqlite/sequence saat multi-proses.
export function nextId(prefix: string, ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const m = /^.*-(\d+)$/.exec(id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

if (typeof process !== "undefined" && process.argv?.[1]?.includes("next-id")) {
  assert.equal(nextId("TANI", []), "TANI-001");
  assert.equal(nextId("TANI", ["TANI-001", "TANI-002"]), "TANI-003");
  assert.equal(nextId("TANI", ["TANI-001", "TANI-003"]), "TANI-004");
  assert.equal(nextId("SUP", ["SUP-001", "SUP-010", "rusak"]), "SUP-011");
  assert.equal(nextId("ADM", ["ADM-009"]), "ADM-010");
  console.log("next-id ok");
}
