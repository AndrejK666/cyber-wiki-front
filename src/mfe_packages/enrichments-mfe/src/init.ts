/**
 * Enrichments MFE — application bootstrap.
 *
 * Creates the HAI3 app instance, registers slices, effects, API services,
 * and enables shared query cache with the host.
 *
 * Cache/runtime note:
 * - The host app owns the shared runtime via queryCache().
 * - Child apps join that shared QueryClient via queryCacheShared().
 * - Do not add queryCache(), createHAI3App(), or QueryClientProvider here.
 */
// @cpt-dod:cpt-frontx-dod-mfe-isolation-internal-dataflow:p1
// @cpt-flow:cpt-frontx-flow-mfe-isolation-mfe-bootstrap:p1

import {
  createHAI3,
  registerSlice,
  apiRegistry,
  effects,
  queryCacheShared,
} from '@cyberfabric/react';
import { enrichmentSlice } from './slices/enrichmentSlice';
import { initEnrichmentEffects } from './effects/enrichmentEffects';
import { EnrichmentsApiService } from './api/EnrichmentsApiService';

// Register API services BEFORE build — plugins sync during build(),
// so services must already be present for activation to find them
apiRegistry.register(EnrichmentsApiService);
apiRegistry.initialize();

// Create only the local MFE app shell.
// queryCacheShared() joins the host-owned QueryClient without reconfiguring it.
const mfeApp = createHAI3().use(effects()).use(queryCacheShared()).build();

// Register slices with effects (needs store from build())
registerSlice(enrichmentSlice, initEnrichmentEffects);

export { mfeApp };
