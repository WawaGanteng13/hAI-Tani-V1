import assert from "node:assert/strict";

// ponytail: scan max in-memory; pindah DB sequence saat multi-proses.
export function nextSheetRow(rows: Array<number | undefined>, fallbackLen: number): number {
  let max = 0;
  for (const r of rows) if (typeof r === "number" && Number.isFinite(r)) max = Math.max(max, r);
  return max > 0 ? max + 1 : fallbackLen + 2;
}

if (typeof process !== "undefined" && process.argv?.[1]?.includes("sheet-row")) {
  assert.equal(nextSheetRow([], 10), 12);
  assert.equal(nextSheetRow([2, 3, 11], 10), 12);
  assert.equal(nextSheetRow([2, 12], 2), 13);
  assert.equal(nextSheetRow([undefined, 5], 1), 6);
  console.log("sheet-row ok");
}
