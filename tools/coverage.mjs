/**
 * Line coverage from Chrome's own measurement, for the code only the live world can run.
 *
 * The unit tests measure src/core with node's --experimental-test-coverage. src/foundry cannot run outside Foundry, so
 * its only tests are the Quench batches, and until 2026-09-25 nothing said how much of it they reach. Chrome's debugger
 * counts every block it executes (Profiler.takePreciseCoverage, detailed); quench-run.mjs --coverage collects that for
 * the blob modules it loads and hands it here.
 *
 * What a "line" is here: a line with code on it. Blank lines and comment-only lines are not counted either way. A line
 * is covered when any of its code ran at least once.
 *
 * ⚠️ Approximate by design: comments are found by reading characters, not by parsing, so a // or /* inside a string
 * is read as the start of a comment. Good enough to find untested code; not a figure to quote to a decimal.
 */

/**
 * @param {string} source  the text Chrome ran
 * @param {{ ranges: { startOffset: number, endOffset: number, count: number }[] }[]} functions  V8's block coverage
 * @returns {{ lines: number, covered: number, uncovered: number[] }}  uncovered: 1-based line numbers
 */
export function lineCoverage(source, functions) {
  const counts = new Int32Array(source.length).fill(-1);
  // V8 nests ranges: a function's blocks sit inside the function, which sits inside the script. Painted outermost first,
  // the innermost range decides each character, which is the count of the block that character belongs to.
  const ranges = functions
    .flatMap((f) => f.ranges)
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  for (const r of ranges) counts.fill(r.count, r.startOffset, Math.min(r.endOffset, source.length));

  let lines = 0;
  let covered = 0;
  const uncovered = [];
  let offset = 0;
  let inBlockComment = false;
  source.split('\n').forEach((text, i) => {
    const start = offset;
    offset += text.length + 1;
    let ran = false;
    let code = false;
    for (let c = 0; c < text.length; c++) {
      if (inBlockComment) {
        if (text[c] === '*' && text[c + 1] === '/') {
          inBlockComment = false;
          c++;
        }
        continue;
      }
      if (text[c] === '/' && text[c + 1] === '*') {
        inBlockComment = true;
        c++;
        continue;
      }
      if (text[c] === '/' && text[c + 1] === '/') break;
      if (/\s/.test(text[c])) continue;
      code = true;
      if (counts[start + c] > 0) ran = true;
    }
    if (!code) return;
    lines++;
    if (ran) covered++;
    else uncovered.push(i + 1);
  });
  return { lines, covered, uncovered };
}

/** @param {number[]} lines  sorted 1-based line numbers @returns {string}  "4-9 12 20-21" */
export function spans(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++;
    out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
    i = j;
  }
  return out.join(' ');
}
