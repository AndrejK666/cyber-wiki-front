/**
 * Enrichments MFE — lifecycle entry point.
 *
 * Exposed via Module Federation as `./lifecycle`. The host loads this module
 * and the ThemeAwareReactLifecycle handles mount/unmount/update.
 */

import React from 'react';
import type { ChildMfeBridge } from '@cyberfabric/react';
import { ThemeAwareReactLifecycle } from '@cyberfabric/react';
import { mfeApp } from './init';
import { EnrichmentScreen } from './screens/enrichments/EnrichmentScreen';

class EnrichmentsLifecycle extends ThemeAwareReactLifecycle {
  constructor() {
    super(mfeApp);
  }

  protected renderContent(bridge: ChildMfeBridge): React.ReactNode {
    // The host passes enrichment-specific props through the bridge.
    const props = bridge.getProperty('enrichmentProps');
    const enrichmentProps = (props?.value ?? {}) as {
      sourceUri?: string;
      spaceId?: string;
      spaceSlug?: string;
      currentFilePath?: string;
    };

    return (
      <EnrichmentScreen
        sourceUri={enrichmentProps.sourceUri ?? ''}
        spaceId={enrichmentProps.spaceId}
        spaceSlug={enrichmentProps.spaceSlug}
        currentFilePath={enrichmentProps.currentFilePath}
      />
    );
  }
}

/**
 * Export a singleton instance of the lifecycle class.
 * Module Federation expects a default export; the handler calls
 * moduleFactory() which returns this module, then validates it
 * has mount/unmount methods.
 */
export default new EnrichmentsLifecycle();
