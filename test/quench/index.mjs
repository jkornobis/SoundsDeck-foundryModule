/**
 * Every Quench batch the module ships. Loaded ONLY when Quench is active (src/sounds-deck.mjs, quenchReady), so a
 * table without Quench never downloads a line of it.
 */
import { registerFoundryFacts } from './foundry-facts.mjs';

export function registerBatches(quench) {
  registerFoundryFacts(quench);
}
