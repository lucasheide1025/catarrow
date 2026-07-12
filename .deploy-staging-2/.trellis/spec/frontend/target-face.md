# Shared Target Face and Landing Contract

## Single source of truth

- Target metadata and tap-to-score geometry live in `src/lib/targetFace.js`.
- React renderers consume the pure target module. Do not duplicate ring arrays
  or score thresholds inside practice or battle components.
- Keep legacy format IDs readable through aliases at the shared boundary.

## Supported formats

- `full_110`: 122 cm, scores 1-10.
- `compound_510`: cropped 80 cm six-ring face, scores 5-10.
- `indoor_40`: 40 cm full face, scores 1-10.
- `half_610`: cropped 40 cm face, scores 6-10.
- `triple`: 40 cm vertical triple face, scores 6-10.
- `field_16`: field face, scores 1-6.

The 122 cm and 80 cm outdoor inner-ten diameter is respectively 6.1 cm
and 4 cm. Both equal 5% of the full target radius. On a cropped face, normalize
that physical inner ten against the visible outer scoring ring rather than the
removed full-face edge.

## Landing records

Target input emits raw archery data:

```js
{
  label: "X",
  rawScore: 10,
  nx: 0.02,
  ny: -0.01,
  faceIndex: 0,
  targetFormat: "full_110",
}
```

- `(0, 0)` is the face centre and radius `1` is the visible scoring edge.
- Session owners append `round` and one-based `arrow`.
- Button input has no position and must never invent coordinates.
- Undo removes both the score and its matching landing record.
- Field scores stay 1-6 in practice data. Combat conversion is separate.

## Battle integration

- Solo monster, party, dungeon, world boss, and duel modes use the shared
  target component.
- Preserve coordinate fields through Firestore round processing and automatic
  practice-log creation.
- Position metadata must not affect damage calculations.
- Dungeon battle must honor the room target format and allow target input.

## Quality checks

- Pure score-boundary tests cover full, cropped, field, and legacy formats.
- Search for duplicate ring math before adding a target format.
- Verify button and target input produce the same raw score labels.
- Production build must pass after changing the shared callback contract.
