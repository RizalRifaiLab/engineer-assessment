export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a === "number" &&
    typeof b === "number" &&
    Number.isNaN(a) &&
    Number.isNaN(b)
  ) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k, i) =>
        k === kb[i] &&
        deepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k]
        )
    );
  }
  return false;
}
