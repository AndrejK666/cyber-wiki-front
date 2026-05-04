/**
 * SpacesPage
 *
 * All-spaces browsing page with search, grid/list toggle, favorites.
 * Ported from doclab Spaces view, adapted to FrontX event-driven architecture.
 */

import React, { useState, useEffect } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { upperFirst, lowerCase } from 'lodash';
import { Search, Plus, Star, Grid, List } from 'lucide-react';
import { loadSpaces, toggleFavorite } from '@/app/actions/wikiActions';
import { Urls, type Space, type UserSpacePreference } from '@/app/api';
import CreateSpaceModal from '@/app/components/space/CreateSpaceModal';
import { PageTitle } from '@/app/layout';
import { formatDate } from '@/app/lib/formatDate';

interface SpacesPageProps {
  navigate: (view: string) => void;
}

const SpacesPage: React.FC<SpacesPageProps> = ({ navigate }) => {
  const { t } = useTranslation();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [favorites, setFavorites] = useState<UserSpacePreference[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setSpaces(payload.all);
      setFavorites(payload.favorites);
      setLoading(false);
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleNavigateToSpace = (spaceSlug: string) => {
    navigate(`${Urls.Spaces}?space=${spaceSlug}`);
  };

  const handleToggleFavorite = (spaceSlug: string) => {
    const isFavorite = favorites.some(f => f.space_slug === spaceSlug);
    toggleFavorite(spaceSlug, isFavorite);
  };

  const q = lowerCase(searchQuery);
  const filteredSpaces = spaces.filter(
    space =>
      lowerCase(space.name).includes(q) ||
      lowerCase(space.description).includes(q),
  );

  const favoriteSpaces = filteredSpaces.filter(space =>
    favorites.some(f => f.space_slug === space.slug)
  );
  const otherSpaces = filteredSpaces.filter(
    space => !favorites.some(f => f.space_slug === space.slug)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">{t('spaces.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageTitle title={t('spaces.title')} subtitle={t('spaces.subtitle')} />
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-end mb-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus size={20} />
            {t('spaces.create')}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('spaces.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              title={t('spaces.viewGrid')}
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-all ${viewMode === 'list' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              title={t('spaces.viewList')}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {favoriteSpaces.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
              <Star size={20} className="text-yellow-500" />
              {t('spaces.favorites', { count: favoriteSpaces.length })}
            </h2>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteSpaces.map(space => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    isFavorite={true}
                    onNavigate={() => handleNavigateToSpace(space.slug)}
                    onToggleFavorite={() => handleToggleFavorite(space.slug)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {favoriteSpaces.map(space => (
                  <SpaceListItem
                    key={space.id}
                    space={space}
                    isFavorite={true}
                    onNavigate={() => handleNavigateToSpace(space.slug)}
                    onToggleFavorite={() => handleToggleFavorite(space.slug)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {otherSpaces.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {t('spaces.all', { count: otherSpaces.length })}
            </h2>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherSpaces.map(space => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    isFavorite={false}
                    onNavigate={() => handleNavigateToSpace(space.slug)}
                    onToggleFavorite={() => handleToggleFavorite(space.slug)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {otherSpaces.map(space => (
                  <SpaceListItem
                    key={space.id}
                    space={space}
                    isFavorite={false}
                    onNavigate={() => handleNavigateToSpace(space.slug)}
                    onToggleFavorite={() => handleToggleFavorite(space.slug)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {filteredSpaces.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-muted mb-4">
              <Search size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {searchQuery ? t('spaces.empty.noResultsTitle') : t('spaces.empty.noSpacesTitle')}
            </h3>
            <p className="mb-4 text-muted-foreground">
              {searchQuery ? t('spaces.empty.noResultsHint') : t('spaces.empty.noSpacesHint')}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
              >
                {t('spaces.create')}
              </button>
            )}
          </div>
        )}
      </div>

      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};

interface SpaceCardProps {
  space: Space;
  isFavorite: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
}

function SpaceCard({ space, isFavorite, onNavigate, onToggleFavorite }: SpaceCardProps) {
  const { t } = useTranslation();
  return (
    <div
      className="group relative p-4 rounded-lg border border-border bg-card transition-all cursor-pointer hover:border-primary hover:-translate-y-0.5"
      onClick={onNavigate}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-3 right-3 p-1.5 rounded-md bg-muted transition-opacity ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        aria-label={isFavorite ? t('spaces.card.removeFromFavorites') : t('spaces.card.addToFavorites')}
        title={isFavorite ? t('spaces.card.removeFromFavorites') : t('spaces.card.addToFavorites')}
      >
        <Star
          size={16}
          className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}
        />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg flex-shrink-0">
          {upperFirst(space.name)[0] ?? ''}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-foreground">{space.name}</h3>
          <p className="text-sm truncate text-muted-foreground">{t('spaces.card.pageCount', { count: space.page_count })}</p>
        </div>
      </div>

      {space.description && (
        <p className="text-sm line-clamp-2 mb-3 text-muted-foreground">{space.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {space.git_provider && (
          <span className="capitalize">{space.git_provider.replace('_', ' ')}</span>
        )}
        {space.last_synced_at && (
          <span>{t('spaces.card.synced', { date: formatDate(space.last_synced_at) })}</span>
        )}
      </div>
    </div>
  );
}

interface SpaceListItemProps {
  space: Space;
  isFavorite: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
}

function SpaceListItem({ space, isFavorite, onNavigate, onToggleFavorite }: SpaceListItemProps) {
  const { t } = useTranslation();
  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-lg border border-border bg-card transition-all cursor-pointer hover:border-primary"
      onClick={onNavigate}
    >
      <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
        {upperFirst(space.name)[0] ?? ''}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate text-foreground">{space.name}</h3>
        <p className="text-sm truncate text-muted-foreground">
          {space.description || t('spaces.card.pageCount', { count: space.page_count })}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{t('spaces.card.pageCount', { count: space.page_count })}</span>
        {space.git_provider && (
          <span className="capitalize">{space.git_provider.replace('_', ' ')}</span>
        )}
      </div>

      <button
        onClick={e => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-muted"
        aria-label={isFavorite ? t('spaces.card.removeFromFavorites') : t('spaces.card.addToFavorites')}
        title={isFavorite ? t('spaces.card.removeFromFavorites') : t('spaces.card.addToFavorites')}
      >
        <Star
          size={16}
          className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}
        />
      </button>
    </div>
  );
}

export default SpacesPage;
