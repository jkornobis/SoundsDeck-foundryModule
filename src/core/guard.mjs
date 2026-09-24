/**
 * Fail safe: run a replacement, and if it throws, run the original instead - with the same `this` and arguments.
 *
 * Auditorium on v0.4, note 3 (Reliability Engineer): "a module bug must never silence a scene change mid-session."
 * The scene fix replaces a Foundry method; wrapped in this, a fault in the module costs one restarted bed (Foundry's
 * own behaviour) instead of silence.
 *
 * PURE: no Foundry here. `report` is told about the error, once per failure.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} replacement
 * @param {F} original
 * @param {(error: unknown) => void} [report]
 * @returns {F}
 */
export function guarded(replacement, original, report) {
  return async function (...args) {
    try {
      return await replacement.apply(this, args);
    } catch (error) {
      report?.(error);
      return original.apply(this, args);
    }
  };
}
