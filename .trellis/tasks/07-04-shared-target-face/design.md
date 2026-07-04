# Design

## Canonical target contract

Create a pure frontend module that owns format metadata, visible scoring zones,
inner-ten geometry, legacy aliases, label conversion, and normalized tap
resolution. React target components consume this module; they do not implement
their own ring math.

Normalized coordinates are relative to the visible scoring face:

- centre is `(0, 0)`
- visible outer scoring edge has radius `1`
- misses may have coordinates outside radius `1` only when supplied by a
  future larger capture surface

Each target-input arrow emits:

```js
{
  label: "X",
  rawScore: 10,
  nx: 0.02,
  ny: -0.01,
  faceIndex: 0,
}
```

Callers append round and arrow indices because those are session concerns.
Combat continues consuming its existing label/value payload. Position metadata
is stored in a parallel practice-data path or harmless extra object fields,
depending on the mode's current arrow representation.

## Component composition

Expose explicit single-face, vertical-triple, and overlay variants backed by
the same face primitive. This avoids separate scoring implementations while
allowing practice and full-screen battle input to keep their layouts.

The pointer interaction commits the pointer-up location, not potentially stale
drag state. Magnification remains presentation-only.

## Compatibility

Legacy IDs are normalized at the shared boundary. Existing saved records are
not rewritten. Field raw scores remain 1-6; damage conversion stays in the
score/damage layer.

## Rollout

1. Replace shared battle overlay internals and preserve its public label
   callback during migration.
2. Replace practice-local target math.
3. Add coordinate-aware callbacks mode by mode.
4. Enable dungeon target input.
5. Verify score/damage regression with production build and targeted pure
   resolver checks.
