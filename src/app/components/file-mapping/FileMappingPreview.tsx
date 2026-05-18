/**
 * FileMappingPreview — read-only tree preview for the configuration UI.
 *
 * Receives a pre-computed `TreeNode[]` (already with effective_display_name /
 * is_visible / sort_order applied) and renders it via FileTree. View-mode
 * toggle and label live in the parent settings row so both panes can start at
 * the same vertical position for easy side-by-side comparison.
 */

import { useTranslation } from '@cyberfabric/react';
import { FileTree } from '@/app/components/file/FileTree';
import { ViewMode, type TreeNode } from '@/app/api';

interface FileMappingPreviewProps {
  viewMode: ViewMode;
  /** Tree for "documents" mode (mappings + filters applied). */
  documentTree: TreeNode[];
  /** Tree for "developer" mode (raw repo layout). */
  devTree?: TreeNode[];
}

export function FileMappingPreview({
  viewMode,
  documentTree,
  devTree,
}: FileMappingPreviewProps) {
  const { t } = useTranslation();
  const tree = viewMode === ViewMode.Documents ? documentTree : devTree ?? documentTree;
  return (
    <div className="text-foreground">
      <div className="sticky top-0 z-10 bg-muted/95 border-b border-border px-2 py-2 text-xs font-semibold text-muted-foreground flex items-center">
        <span className="flex-1 min-w-0">{t('fileMappingPreview.colName')}</span>
      </div>
      <FileTree tree={tree} />
    </div>
  );
}
