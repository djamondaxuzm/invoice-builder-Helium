// Forms use immutable updates. Shared image buffers are compared by identity;
// newly supplied buffers are compared directly without allocating JSON strings.
export const formEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof ArrayBuffer || b instanceof ArrayBuffer)
    return a instanceof ArrayBuffer && b instanceof ArrayBuffer && formEqual(new Uint8Array(a), new Uint8Array(b));
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.byteLength !== b.byteLength) return false;
    const left = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const right = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return left.every((value, i) => value === right[i]);
  }
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && +a === +b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  // Do not treat opaque objects such as different Files as equal merely because
  // their enumerable keys happen to be empty.
  if (
    !Array.isArray(a) &&
    (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype)
  )
    return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && formEqual(left[key], right[key]))
  );
};
