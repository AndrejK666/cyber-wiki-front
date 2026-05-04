/**
 * SpaceConfigurationPage
 *
 * Admin view for managing spaces — CRUD table with edit/delete,
 * favorites toggle, file mapping configuration.
 * Ported from doclab SpaceConfiguration view.
 */

import React, { useState, useEffect } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { lowerCase } from 'lodash';
import { Edit2, Trash2, Plus, Search, Star, Folders, CheckCircle2, AlertTriangle, FolderOpen } from 'lucide-react';
import { loadSpaces, toggleFavorite, deleteSpace } from '@/app/actions/wikiActions';
import { type Space, type UserSpacePreference } from '@/app/api';
import CreateSpaceModal from '@/app/components/space/CreateSpaceModal';
import EditSpaceModal from '@/app/components/space/EditSpaceModal';
import { FileMappingConfiguration } from '@/app/components/file-mapping/FileMappingConfiguration';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';
import { PageTitle } from '@/app/layout';

interface SpaceConfigurationPageProps {
  navigate: (view: string) => void;
}

const SpaceConfigurationPage: React.FC<SpaceConfigurationPageProps> = () => {
  const { t } = useTranslation();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [favorites, setFavorites] = useState<UserSpacePreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [mappingSpace, setMappingSpace] = useState<Space | null>(null);
  const [pendingDeleteSlug, setPendingDeleteSlug] = useState<string | null>(null);

  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setSpaces(payload.all);
      setFavorites(payload.favorites);
      setLoading(false);
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleToggleFavorite = (space: Space) => {
    const isFavorite = favorites.some(f => f.space_slug === space.slug);
    toggleFavorite(space.slug, isFavorite);
  };

  const handleDeleteSpace = (slug: string) => {
    setPendingDeleteSlug(slug);
  };

  const confirmDelete = () => {
    if (pendingDeleteSlug) deleteSpace(pendingDeleteSlug);
    setPendingDeleteSlug(null);
  };

  const q = lowerCase(searchQuery);
  const filteredSpaces = spaces.filter(
    space =>
      lowerCase(space.name).includes(q) ||
      lowerCase(space.slug).includes(q) ||
      (space.description ? lowerCase(space.description).includes(q) : false)
  );

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'private': return t('spaceConfig.visibility.private');
      case 'team': return t('spaceConfig.visibility.team');
      case 'public': return t('spaceConfig.visibility.public');
      default: return visibility;
    }
  };

  const getProviderLabel = (provider: string | null) => {
    if (!provider) return t('spaceConfig.provider.notConfigured');
    switch (provider) {
      case 'github': return t('spaceConfig.provider.github');
      case 'bitbucket_server': return t('spaceConfig.provider.bitbucketServer');
      case 'local_git': return t('spaceConfig.provider.localGit');
      default: return provider;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-muted-foreground">{t('spaceConfig.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <ConfirmDialog
        open={pendingDeleteSlug !== null}
        title={t('spaceConfig.deleteConfirmTitle')}
        message={t('spaceConfig.deleteConfirm')}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteSlug(null)}
      />
      <PageTitle title={t('spaceConfig.title')} subtitle={t('spaceConfig.subtitle')} />
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all"
          >
            <Plus size={20} />
            {t('spaceConfig.create')}
          </button>
        </div>

        <div className="mt-3 relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('spaceConfig.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredSpaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              {searchQuery ? t('spaceConfig.emptyNoMatch') : t('spaceConfig.emptyNone')}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
              >
                <Plus size={16} className="inline mr-2" />
                {t('spaceConfig.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.space')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.slug')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.visibility')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.gitProvider')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.repository')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.branch')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.edit')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('spaceConfig.table.localFork')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpaces.map((space, index) => {
                  const isFavorite = favorites.some(f => f.space_slug === space.slug);
                  return (
                    <tr
                      key={space.id}
                      className={`border-t border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-foreground">{space.name}</div>
                          {space.description && (
                            <div className="text-sm mt-0.5 text-muted-foreground truncate max-w-xs">{space.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-sm px-2 py-1 rounded bg-muted text-foreground">{space.slug}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm px-2 py-1 rounded bg-muted text-foreground">
                          {getVisibilityLabel(space.visibility)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {getProviderLabel(space.git_provider)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {space.git_repository_name || space.git_repository_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {space.git_default_branch || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {space.edit_enabled ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                            title={t('spaceConfig.editFork.readyTitle')}
                          >
                            <CheckCircle2 size={14} />
                            {t('spaceConfig.editFork.ready')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingSpace(space)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                            title={t('spaceConfig.editFork.setupTitle')}
                          >
                            <AlertTriangle size={14} />
                            {t('spaceConfig.editFork.setupNeeded')}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {space.edit_fork_local_path ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-mono text-foreground w-full"
                            title={space.edit_fork_local_path}
                          >
                            <FolderOpen size={14} className="flex-shrink-0 text-green-600 dark:text-green-400" />
                            <span className="truncate">
                              …/{space.edit_fork_local_path.split(/[\\/]/).filter(Boolean).slice(-2).join('/')}
                            </span>
                          </span>
                        ) : (
                          <span
                            className="text-xs text-muted-foreground"
                            title={t('spaceConfig.localForkMissingTitle')}
                          >
                            {t('common.missing')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleFavorite(space)}
                            className="p-2 rounded-lg hover:bg-muted transition-all"
                            aria-label={isFavorite ? t('spaceConfig.actions.removeFromFavorites') : t('spaceConfig.actions.addToFavorites')}
                            title={isFavorite ? t('spaceConfig.actions.removeFromFavorites') : t('spaceConfig.actions.addToFavorites')}
                          >
                            <Star
                              size={16}
                              className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}
                            />
                          </button>
                          <button
                            onClick={() => setMappingSpace(space)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-all"
                            aria-label={t('spaceConfig.actions.configureMapping')}
                            title={t('spaceConfig.actions.configureMapping')}
                          >
                            <Folders size={16} />
                          </button>
                          <button
                            onClick={() => setEditingSpace(space)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-all"
                            aria-label={t('spaceConfig.actions.editSpace')}
                            title={t('spaceConfig.actions.editSpace')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSpace(space.slug)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-all"
                            aria-label={t('spaceConfig.actions.deleteSpace')}
                            title={t('spaceConfig.actions.deleteSpace')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {editingSpace && (
        <EditSpaceModal
          isOpen={true}
          onClose={() => setEditingSpace(null)}
          space={editingSpace}
        />
      )}

      {mappingSpace && (
        <Modal
          open={true}
          onClose={() => setMappingSpace(null)}
          size={ModalSize.X7}
          contentClassName="overflow-hidden"
        >
          <FileMappingConfiguration
            space={mappingSpace}
            onClose={() => setMappingSpace(null)}
          />
        </Modal>
      )}
    </div>
  );
};

export default SpaceConfigurationPage;
