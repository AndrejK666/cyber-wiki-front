/**
 * Enrichments MFE - Events
 *
 * This file is intentionally empty. All event types consumed or emitted by the
 * enrichments MFE are declared by the host in:
 *   - src/app/events/enrichmentEvents.ts  (enrichments, comments)
 *   - src/app/events/gitOpsLogEvents.ts   (git ops log)
 *   - src/app/events/draftChangeEvents.ts (draft discard/commit)
 *   - src/app/events/userBranchEvents.ts  (branch unstage, PR create)
 *   - src/app/events/userSettingsEvents.ts (debug mode toggle)
 *
 * Since the root tsconfig compiles host and MFE together, the MFE gets full
 * type safety from the host declarations. Re-declaring them here would cause
 * TS2717 "Subsequent property declarations must have the same type" errors.
 */

import '@cyberfabric/react';
