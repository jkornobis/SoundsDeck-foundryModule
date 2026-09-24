import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deckName } from '../../src/core/names.mjs';

describe('deckName - the source in parentheses stays in the native panel', () => {
  it('hides a trailing source', () => assert.equal(deckName('At Risk (Gone Girl)', true), 'At Risk'));
  it('hides every trailing group', () =>
    assert.equal(deckName('Bloodfest (From Mizumono) (Hannibal)', true), 'Bloodfest'));
  it('keeps parentheses that are not at the end', () =>
    assert.equal(deckName('Heartbeat (fast), close', true), 'Heartbeat (fast), close'));
  it('option off: the whole name', () => assert.equal(deckName('At Risk (Gone Girl)', false), 'At Risk (Gone Girl)'));
  it('a name that is only parentheses is kept whole', () => assert.equal(deckName('(untitled)', true), '(untitled)'));
  it('no name is an empty string, not "undefined"', () => assert.equal(deckName(undefined, true), ''));
});
