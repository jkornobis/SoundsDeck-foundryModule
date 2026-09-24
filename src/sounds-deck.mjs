/**
 * Sounds Deck - the entry point Foundry loads (module.json "esmodules").
 *
 * Wiring only. What happens at each stage is in src/foundry/setup.mjs; every decision is in src/core/.
 */
import { MODULE_ID, onInit, onReady, onRenderPlaylistDirectory } from './foundry/setup.mjs';

Hooks.once('init', onInit);
Hooks.once('ready', () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = onReady();
});
Hooks.on('renderPlaylistDirectory', onRenderPlaylistDirectory);

// Tests that run inside Foundry, for whoever has Quench installed. Imported only then.
Hooks.once('quenchReady', async (quench) => {
  const { registerBatches } = await import('../test/quench/index.mjs');
  registerBatches(quench);
});
