/**
 * FileMappingPreview — read-only tree preview for the configuration UI.
 *
 * Receives a pre-computed `TreeNode[]` (already with effective_display_name /
 * is_visible / sort_order applied) and renders it via FileTree. Toggle between
 * Documents and Developer views.
 *
 * Inspired by doclab components/spaces/file-mapping/FileMappingPreview.tsx.
 */

import { useState } from 'react';
import { useTranslation } from '@cyberfabric/react';
import { BookOpen, Code } from 'lucide-react';
import { FileTree } from '@/app/components/file/FileTree';
import { ViewMode, type TreeNode } from '@/app/api';

interface FileMappingPreviewProps {
  /** Tree for "documents" mode (mappings + filters applied). */
  documentTree: TreeNode[];
  /** Tree for "developer" mode (raw repo layout). */
  devTree?: TreeNode[];
  initialMode?: ViewMode;
}

export function FileMappingPreview({
  documentTree,
  devTree,
  initialMode = ViewMode.Documents,
}: FileMappingPreviewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const tree = viewMode === ViewMode.Documents ? documentTree : devTree ?? documentTree;

  return (
    <div>
      <div className="p-2 bg-muted border-b border-border sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t('fileMappingPreview.title')}</h3>
          <div className="flex gap-0.5 p-0.5 rounded bg-background">
            <button
              type="button"
              onClick={() => setViewMode(ViewMode.Documents)}
              className={`p-1 rounded transition-colors ${
                viewMode === ViewMode.Documents
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              aria-label={t('fileMappingPreview.documentsView')}
              title={t('fileMappingPreview.documentsView')}
            >
              <BookOpen size={12} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode(ViewMode.Dev)}
              className={`p-1 rounded transition-colors ${
                viewMode === ViewMode.Dev
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              aria-label={t('fileMappingPreview.developerView')}
              title={t('fileMappingPreview.developerView')}
            >
              <Code size={12} />
            </button>
          </div>
        </div>
      </div>

      <FileTree tree={tree} />
    </div>
  );
}
