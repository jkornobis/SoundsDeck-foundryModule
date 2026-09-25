import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lineCoverage, spans } from '../../tools/coverage.mjs';

const range = (startOffset, endOffset, count) => ({ startOffset, endOffset, count });

describe('lineCoverage - what Chrome ran, line by line', () => {
  const source = [
    'const a = 1;',
    '// a comment',
    '',
    'function f() {',
    '  return 2;',
    '}',
    '/* block',
    '   comment */ f();',
  ].join('\n');
  const fStart = source.indexOf('function f');
  const fEnd = source.indexOf('}') + 1;

  it('a function that never ran leaves its lines uncovered; comments and blanks are not counted', () => {
    const r = lineCoverage(source, [{ ranges: [range(0, source.length, 1)] }, { ranges: [range(fStart, fEnd, 0)] }]);
    assert.deepEqual(r, { lines: 5, covered: 2, uncovered: [4, 5, 6] });
  });
  it('the innermost range decides: a function that ran covers its lines', () => {
    const r = lineCoverage(source, [{ ranges: [range(0, source.length, 1)] }, { ranges: [range(fStart, fEnd, 3)] }]);
    assert.deepEqual(r.uncovered, []);
  });
  it('a line whose code only follows a block comment still counts', () => {
    const r = lineCoverage(source, [{ ranges: [range(0, source.length, 1)] }]);
    assert.equal(r.lines, 5);
  });
  it('no coverage reported at all is nothing covered', () => {
    assert.equal(lineCoverage(source, []).covered, 0);
  });
});

describe('spans', () => {
  it('runs collapse, lone lines stay', () => assert.equal(spans([4, 5, 6, 9, 12, 13]), '4-6 9 12-13'));
  it('nothing is empty', () => assert.equal(spans([]), ''));
});
