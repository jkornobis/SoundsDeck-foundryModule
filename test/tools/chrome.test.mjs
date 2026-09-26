import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mainChromePid } from '../../tools/chrome.mjs';

describe("mainChromePid - which process is Chrome's own, to close it", () => {
  const profile = '/x/.config/chrome-GE-Foundry';
  const listing = [
    '  PID COMMAND',
    '  101 /usr/bin/google-chrome-stable --headless=new --user-data-dir=/x/.config/chrome-GE-Tower',
    `  202 /opt/google/chrome/chrome --type=gpu-process --user-data-dir=${profile}`,
    `  303 /usr/bin/google-chrome-stable --headless=new --remote-debugging-port=9222 --user-data-dir=${profile}`,
    '  404 grep chrome-GE-Foundry',
  ].join('\n');
  it('the main process on our profile - not a child, not another instance, not a grep', () =>
    assert.equal(mainChromePid(listing, profile), 303));
  it('none running is null', () => assert.equal(mainChromePid('  PID COMMAND\n', profile), null));
});
