# Implementation plan

1. Audit existing monster and council WebP dimensions/alpha and record exact callers that still render SVG or emoji placeholder art.
2. Generate five expedition mission illustrations with consistent prompts, remove chroma backgrounds, export transparent WebP, and visually validate the results.
3. Add reusable raster rendering/data metadata and replace monster-card, dex, gathering-target, and expedition-mission placeholders.
4. Verify responsive containment at compact dimensions, run alpha checks, tests, and production build.
5. Update the Cat Village and monster-card frontend specifications, commit only task-owned files, and archive the Trellis task.
