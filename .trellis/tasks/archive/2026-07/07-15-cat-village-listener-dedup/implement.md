# Implementation Plan

1. Read all `subscribeMyCats` and village-market-config call sites.
2. Pass the parent `myCats` map into `ForgePanel` and delete its duplicate subscription/effect state.
3. Add/use a one-off village-market config fetch while preserving live APIs needed elsewhere.
4. Confirm card-market and village-goal components remain conditionally mounted with cleanup.
5. Run the production build, inspect listener counts by code trace, and review the complete diff.
