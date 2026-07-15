# Implementation Plan

1. Remove all-member legacy migration imports, effects, and session guards from `AdminMembers`.
2. Search the repository for remaining automatic call sites; keep only function definitions until a controlled tool exists.
3. Run production build and diff checks.
4. Document the root-cause contract in the Firestore cost spec.
