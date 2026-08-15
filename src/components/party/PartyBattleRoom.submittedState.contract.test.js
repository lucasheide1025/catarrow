const fs = require('fs');
const path = require('path');

describe('PartyBattleRoom submitted state contract', () => {
  const source = fs.readFileSync(path.join(__dirname, 'PartyBattleRoom.jsx'), 'utf8');

  test('uses useFirestoreRound submitted state as the single post-submit lock', () => {
    expect(source).toMatch(/submitted:\s*roundSubmitted/);
    expect(source).toMatch(/const\s+postSubmitted\s*=\s*roundSubmitted/);
  });

  test('does not keep a second independent postSubmitted setter', () => {
    expect(source).not.toMatch(/setPostSubmitted/);
    expect(source).not.toMatch(/\[\s*postSubmitted\s*,/);
  });
});
