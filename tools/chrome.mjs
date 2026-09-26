/**
 * The automation browser's life, owned by the tools (issue #79).
 *
 * WHY: GE-Tower measured it (jkosvr-tower#80, 2026-09-25): a headless Chrome left on the world's game page for 26
 * hours drew the game table in software - the tower has no GPU - and its GPU process kept about 8 CPU cores busy. The
 * Composer's ruling that night: close Chrome "always ... once finished". So a live tool starts Chrome and logs in when
 * it has to, and closes it when it is done - unless told --keep, so several runs can share one session and the last
 * one closes it.
 *
 * WHERE THINGS COME FROM - none of it is in this repository, which is public:
 *   FVTT_URL   the world's /game address (environment), needed only to start Chrome or log in
 *   FVTT_GM    the gamemaster account's name (environment), needed only to log in
 *   the password: ~/.config/foundry-user.txt, typed into the join form, never printed
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = 9222;
const PROFILE = path.join(os.homedir(), '.config', 'chrome-GE-Foundry');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const portOpen = () =>
  new Promise((res) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/version', timeout: 1500 }, (r) => {
      r.resume();
      res(true);
    });
    req.on('error', () => res(false));
    req.on('timeout', () => {
      req.destroy();
      res(false);
    });
  });

const pages = () =>
  new Promise((res, rej) =>
    http
      .get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
        let b = '';
        r.on('data', (d) => {
          b += d;
        });
        r.on('end', () => res(JSON.parse(b)));
      })
      .on('error', rej),
  );

/**
 * The browser's MAIN process in a `ps -eo pid,args` listing: the one on our profile that is not a child (children
 * carry --type=...). PURE, so it is tested without a browser.
 * @param {string} listing  `ps -eo pid,args` output
 * @param {string} profile  the --user-data-dir to match
 * @returns {number | null}
 */
export function mainChromePid(listing, profile) {
  for (const line of listing.split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const args = m[2];
    if (!/chrome/.test(args) || args.includes('--type=')) continue;
    if (args.includes(`--user-data-dir=${profile}`)) return Number(m[1]);
  }
  return null;
}

/** Start Chrome if it is not running, and make sure a page is IN the world as the gamemaster. */
export async function ensureGame() {
  // Loaded here, not at the top: cdp.mjs needs the system's `ws` package, which GitHub's build machine does not have,
  // and the unit test that imports this file for mainChromePid must load there (v0.6.7's release failed on it).
  const { connect } = await import('./cdp.mjs');
  const url = process.env.FVTT_URL;
  if (!(await portOpen())) {
    if (!url) throw new Error('Chrome is not running and FVTT_URL is not set - nothing to start it on');
    const origin = new URL(url).origin;
    const child = spawn(
      'google-chrome-stable',
      [
        '--headless=new',
        // On the tower's graphics card (GE-Tower measured it, jkosvr-tower#80, 2026-09-26: a heavy WebGL page at 106 %
        // CPU on the GPU against 518 % drawn in software). --disable-gpu drew Foundry's canvas on the CPU.
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=gl-egl',
        '--no-sandbox',
        `--remote-debugging-port=${PORT}`,
        '--window-size=1600,1000',
        `--user-data-dir=${PROFILE}`,
        '--profile-directory=GE-Foundry',
        `${origin}/join`,
      ],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();
    for (let i = 0; i < 30 && !(await portOpen()); i++) await wait(500);
    if (!(await portOpen())) throw new Error('Chrome did not open its debug port');
  }
  let page = (await pages()).find((t) => t.type === 'page' && /^https?:/.test(t.url) && !t.url.startsWith('about:'));
  if (!page) {
    if (!url) throw new Error('no world page and FVTT_URL is not set');
    const blank = (await pages()).find((t) => t.type === 'page');
    const cdp = await connect(blank.webSocketDebuggerUrl);
    await cdp.send('Page.navigate', { url: `${new URL(url).origin}/join` });
    cdp.close();
    await wait(2000);
    page = (await pages()).find((t) => t.type === 'page' && /^https?:/.test(t.url));
  }
  const cdp = await connect(page.webSocketDebuggerUrl);
  try {
    if (await cdp.ev('!!globalThis.game?.ready').catch(() => false)) return;
    const user = process.env.FVTT_GM;
    if (!user) throw new Error('not in the world and FVTT_GM is not set - no account to log in with');
    const secret = (await readFile(path.join(os.homedir(), '.config', 'foundry-user.txt'), 'utf8')).trim();
    if (!(await cdp.ev('location.pathname')).startsWith('/join')) {
      await cdp.send('Page.navigate', { url: `${new URL(url ?? (await cdp.ev('location.href'))).origin}/join` });
    }
    for (
      let i = 0;
      i < 30 && !(await cdp.ev('!!document.querySelector("input[name=password]")').catch(() => false));
      i++
    )
      await wait(1000);
    // The form is filled the way a person would; the password goes into the page and nowhere else.
    await cdp.ev(`(() => {
      const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const byName = ${JSON.stringify(user)};
      const sel = document.querySelector('select[name=userid]');
      if (sel) { const o = [...sel.options].find((x) => x.textContent.trim() === byName); sel.value = o?.value ?? ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      const u = document.querySelector('input[name=username]');
      if (u) set(u, byName);
      set(document.querySelector('input[name=password]'), ${JSON.stringify(secret)});
      document.querySelector('button[name=join]').click();
      return 1;
    })()`);
    for (let i = 0; i < 60; i++) {
      await wait(1500);
      if (await cdp.ev('!!globalThis.game?.ready').catch(() => false)) return;
    }
    throw new Error('the join form did not lead into the world');
  } finally {
    cdp.close();
  }
}

/** Close Chrome - its main process, found by our profile - and wait until its debug port is silent. */
export async function closeChrome() {
  const pid = mainChromePid(execFileSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' }), PROFILE);
  if (pid) process.kill(pid);
  for (let i = 0; i < 20 && (await portOpen()); i++) await wait(500);
  return !(await portOpen());
}

/** The end of a tool: close Chrome unless --keep was passed. */
export async function finish() {
  if (process.argv.includes('--keep')) return;
  const closed = await closeChrome();
  console.log(closed ? 'Chrome closed' : '⚠️ Chrome did not close - close it by hand');
}
