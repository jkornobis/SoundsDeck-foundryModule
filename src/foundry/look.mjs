/**
 * A pad's colour and icon, set in its sound's own settings (0.6, theme 9) - right under its Trim, or under Fade.
 * Only a bank's sounds get the fields: a bed's tracks have no pad to colour.
 */
import { classify } from '../core/classify.mjs';
import { PAD_COLOURS, padLook } from '../core/look.mjs';

const MODULE_ID = 'sounds-deck';

function addLookFields(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const sound = app.document;
  const playlist = sound?.parent;
  if (!root || classify(playlist?.name, playlist?.mode)?.role !== 'bank') return;
  if (root.querySelector(`[name="flags.${MODULE_ID}.look.colour"]`)) return;
  const anchor = (
    root.querySelector(`[name="flags.${MODULE_ID}.trim.start"]`) ?? root.querySelector('[name="fade"]')
  )?.closest('.form-group');
  if (!anchor) return;
  const look = padLook(sound.getFlag(MODULE_ID, 'look'));
  const L = (key) => game.i18n.localize(`SOUNDS_DECK.Look.${key}`);
  const options = PAD_COLOURS.map(
    (c) =>
      `<option value="${c}"${c === look.colour ? ' selected' : ''}>${game.i18n.localize(`SOUNDS_DECK.Colours.${c}`)}</option>`,
  ).join('');
  const icon = look.icon ? ` value="${foundry.utils.escapeHTML(look.icon)}"` : '';
  const group = document.createElement('div');
  group.className = 'form-group slim';
  group.innerHTML = `<label>${L('Label')}</label>
    <div class="form-fields">
      <label>${L('Colour')} <select name="flags.${MODULE_ID}.look.colour"><option value=""></option>${options}</select></label>
      <label>${L('Icon')} <input type="text" maxlength="12" name="flags.${MODULE_ID}.look.icon"${icon} placeholder="🔥"></label>
    </div>
    <p class="hint">${L('Hint')}</p>`;
  anchor.after(group);
}

/** @returns {{ installed: boolean, uninstall: () => void }} */
export function installLookFields() {
  const hook = Hooks.on('renderPlaylistSoundConfig', addLookFields);
  return {
    installed: true,
    uninstall() {
      Hooks.off('renderPlaylistSoundConfig', hook);
    },
  };
}
