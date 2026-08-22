# Implementation Plan

1. Add and optimize seven family panorama assets with fallback mapping.
2. Build shared family/floor presentation model and `DungeonFloorIntro`.
3. Replace solo and team floor intro with the shared component and persist seen-floor state.
4. Implement deterministic route-v2 generator, choice reducer and legacy adapter.
5. Add the three-checkpoint route UI with risk/reward cards and mark summary.
6. Connect solo state and team host-authoritative synchronization.
7. Add tests, build, mobile visual checks, then deploy Functions/rules/frontend only after all gates pass.
