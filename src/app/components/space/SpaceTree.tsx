/**
 * SpaceTree — left navigation panel for a Space.
 *
 * Per FR cpt-cyberwiki-fr-left-nav-dual-mode: toggle between Document View
 * (Confluence-style titled hierarchy via Document Index) and File Tree View
 * (raw repo layout). Triggers `wiki/tree/load` and renders `wiki/tree/loaded`.
 *
 * Inspired by doclab components/spaces/SpaceTree.tsx — backend already applies
 * file-mapping when serving the tree, so this component only orchestrates load.
 */

import { useEffect, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import { BookOpen, Code } from 'lucide-react';
import { FileTree } from '@/app/components/file/FileTree';
import { loadFileTree } from '@/app/actions/wikiActions';
import { ViewMode, type TreeNode } from '@/app/api';

interface SpaceTreeProps {
  spaceSlug: string;
  spaceName: string;
  viewMode?: ViewMode;
  /** Space-level file-extension filters; mirrors the file-mapping preview so
   *  the tree shows the same thing here and in Space Configuration. */
  filters?: string[];
  selectedPath?: string | null;
  onSelectFile?: (node: TreeNode) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function SpaceTree({
  spaceSlug,
  spaceName,
  viewMode = ViewMode.Documents,
  filters,
  selectedPath,
  onSelectFile,
  onViewModeChange,
}: SpaceTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable filter key (null char joiner can't appear in an extension) so we
  // can include it in the effect deps without re-running on every parent
  // re-render that produces a fresh array reference with the same contents.
  const filtersKey = (filters ?? []).join('\0');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const loadedSub = eventBus.on('wiki/tree/loaded', (payload) => {
      if (payload.mode !== viewMode) return;
      setTree(payload.tree ?? []);
      setLoading(false);
    });
    const errorSub = eventBus.on('wiki/tree/error', (payload) => {
      setError(payload.error);
      setLoading(false);
    });
    const parsedFilters = filtersKey ? filtersKey.split('\0') : [];
    loadFileTree(spaceSlug, viewMode, undefined, parsedFilters);
    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
    };
  }, [spaceSlug, viewMode, filtersKey]);

  return (
    <div>
      <div className="px-4 py-1.5 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          {spaceName}
        </div>
        <div className="flex gap-0.5 p-0.5 rounded bg-muted">
          <button
            type="button"
            onClick={() => onViewModeChange?.(ViewMode.Documents)}
            className={`p-1 rounded transition-colors ${
              viewMode === ViewMode.Documents
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title="Documents view"
          >
            <BookOpen size={14} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.(ViewMode.Dev)}
            className={`p-1 rounded transition-colors ${
              viewMode === ViewMode.Dev
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title="Developer view"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-2 text-sm text-muted-foreground">Loading tree…</div>
      )}
      {error && (
        <div className="px-4 py-2">
          <div className="text-sm text-destructive">{error}</div>
          <button
            type="button"
            onClick={() => loadFileTree(spaceSlug, viewMode, undefined, filters)}
            className="text-xs mt-2 underline text-muted-foreground"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <FileTree
          tree={tree}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      )}
    </div>
  );
}
