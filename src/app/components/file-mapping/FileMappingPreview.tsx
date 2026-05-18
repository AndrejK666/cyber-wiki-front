/**
 * FileMappingPreview — read-only tree preview for the configuration UI.
 *
 * Receives a pre-computed `TreeNode[]` (already with effective_display_name /
 * is_visible / sort_order applied) and renders it via FileTree. View-mode
 * toggle and label live in the parent settings row so both panes can start at
 * the same vertical position for easy side-by-side comparison.
 */

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
  const tree = viewMode === ViewMode.Documents ? documentTree : devTree ?? documentTree;
  return <FileTree tree={tree} />;
}
