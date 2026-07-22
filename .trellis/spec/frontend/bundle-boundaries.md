# Bundle Boundaries

## Measured lazy loading

Moving exports between source files improves ownership but does not reduce the initial bundle when a synchronous import path still reaches the module. A bundle optimization is complete only when the last static import from the initial route is removed.

For a heavy feature rendered behind an existing tab or room boundary:

1. Confirm every other entry point is already lazy or otherwise excluded from the initial route.
2. Replace the final static import with one shared `React.lazy()` loader.
3. Reuse the existing loading fallback and application error boundary.
4. Preload on a meaningful user-intent event such as hover, focus, or entering a room.
5. Verify the production asset manifest does not list the new feature chunk as an entrypoint.
6. Record main-bundle raw and gzip sizes before and after; also record the async chunk and total-build tradeoff.

Do not claim a deployment or first-load improvement from a source-file split alone. Production-build measurements are required.
