/**
 * The deck's playlists hidden from players (next program, note 5; the Composer's design, 2026-09-25): a player's
 * playlist sidebar lists every playlist that plays - Foundry's Playlist#visible is `isOwner || playing` (read from the
 * live page, 14.368) - so the table could read "Mindhunter Main Titles" as it starts. With the world setting on, a bed
 * or a bank is not visible to a player; everything else is left to Foundry.
 *
 * Visibility is only what the sidebar lists: every browser still plays every playlist (the player proof checks the bed
 * is heard with it on).
 */
import { classify } from '../core/classify.mjs';

const MODULE_ID = 'sounds-deck';

/**
 * @param {typeof foundry.documents.Playlist} Playlist
 * @param {{ enabled?: () => boolean }} [options]  enabled: whether to hide now - the setting, by default
 * @returns {{ installed: boolean, reason?: string, uninstall: () => void }}
 */
export function installHideFromPlayers(Playlist, { enabled } = {}) {
  const proto = Playlist.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'visible');
  if (typeof desc?.get !== 'function')
    return { installed: false, reason: 'no Playlist#visible getter', uninstall() {} };
  const on =
    enabled ??
    (() => {
      try {
        return game.settings.get(MODULE_ID, 'hideFromPlayers');
      } catch {
        return false;
      }
    });
  const get = function () {
    const visible = desc.get.call(this);
    if (!visible || game.user?.isGM || this.isOwner) return visible;
    try {
      return on() && classify(this.name, this.mode) ? false : visible;
    } catch {
      return visible; // a fault here must never hide more than Foundry would
    }
  };
  Object.defineProperty(proto, 'visible', { ...desc, get });
  return {
    installed: true,
    uninstall() {
      if (Object.getOwnPropertyDescriptor(proto, 'visible')?.get === get) Object.defineProperty(proto, 'visible', desc);
    },
  };
}
