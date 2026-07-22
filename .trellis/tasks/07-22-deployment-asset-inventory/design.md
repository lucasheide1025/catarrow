# Design

The inventory remains read-only and evidence-first. Deployment optimization is limited to ignore/configuration boundaries:

- `.vercelignore` defines the smallest practical CRA deployment context while retaining `src/`, `public/`, the root package manifests, and Vercel configuration.
- `firebase.json` defines explicit Functions upload exclusions while retaining runtime JavaScript and `functions/data/`.
- Tracked `.deploy-*` snapshots remain in Git because the user has not authorized deletion. Ignore rules can reduce CLI upload/context scanning but cannot reduce a Git-provider clone; that requires a later removal commit.
- Validation compares included/excluded path sizes, runs the CRA production build and Functions tests, and verifies no asset path is changed.
