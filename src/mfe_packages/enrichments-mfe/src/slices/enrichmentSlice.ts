/**
 * Enrichments MFE - Slice
 * Domain state for enrichments. Currently minimal — enrichment state is
 * mostly local to the EnrichmentPanel component and driven via eventBus.
 */

import { createSlice } from '@cyberfabric/react';

const { slice } = createSlice({
  name: 'enrichments/home',
  initialState: {},
  reducers: {},
});

export const enrichmentSlice = slice;

/**
 * RootState augmentation for type-safe selectors
 */
declare module '@cyberfabric/react' {
  interface RootState {
    'enrichments/home': Record<string, never>;
  }
}
