import React, { useEffect, useMemo, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { isEmpty, lowerCase, trim } from 'lodash';
import { loadSpaces, createSpace } from '@/app/actions/wikiActions';
import { SpaceVisibility, type CreateSpaceRequest, type Space } from '@/app/api';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';
import {
  deriveRepoLeaf,
  deriveSpaceName,
  deriveSpaceSlug,
  validateSpaceForm,
  type SpaceFieldErrors,
} from './spaceFormHelpers';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM: CreateSpaceRequest = {
  slug: '',
  name: '',
  description: '',
  visibility: SpaceVisibility.Team,
  git_provider: 'bitbucket_server',
  git_repository_url: '',
  git_default_branch: '',
};

export default function CreateSpaceModal({ isOpen, onClose }: CreateSpaceModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateSpaceRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True once the user has manually typed in slug/name — locks them against
   *  further auto-fill from the URL so user input is never clobbered. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  /** Per-field "did the user interact with this yet" flags. We only reveal a
   *  validation message once the field has been touched, otherwise the form
   *  shows a wall of errors before the user has even typed. */
  const [touched, setTouched] = useState<Record<keyof SpaceFieldErrors, boolean>>({
    git_repository_url: false,
    name: false,
    slug: false,
    description: false,
    git_default_branch: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Slugs of spaces that already exist — used to enforce uniqueness on the
   *  client so the user gets immediate feedback instead of a backend 400. */
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  // Pull the current spaces list when the modal opens so we can warn about
  // duplicate slugs before the user submits.
  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = eventBus.on('wiki/spaces/loaded', (payload: { all: Space[] }) => {
      setExistingSlugs(new Set(payload.all.map((s) => s.slug)));
    });
    loadSpaces();
    return () => sub.unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    const subCreated = eventBus.on('wiki/space/created', () => {
      setLoading(false);
      setFormData(EMPTY_FORM);
      setSlugTouched(false);
      setNameTouched(false);
      setTouched({
        git_repository_url: false,
        name: false,
        slug: false,
        description: false,
        git_default_branch: false,
      });
      setSubmitAttempted(false);
      // Close modal after a short delay to let spaces/load complete
      setTimeout(() => onClose(), 100);
    });
    const subError = eventBus.on('wiki/space/error', ({ error: msg }) => {
      setLoading(false);
      setError(msg);
    });
    return () => {
      subCreated.unsubscribe();
      subError.unsubscribe();
    };
  }, [onClose]);

  const fieldErrors = useMemo(
    () => validateSpaceForm(formData, existingSlugs),
    [formData, existingSlugs],
  );
  const hasErrors = !isEmpty(fieldErrors);
  /** Show a field's error only after the user has touched it OR after the
   *  user has hit Submit (in which case we want to surface every blocker). */
  const showError = (field: keyof SpaceFieldErrors): string | undefined =>
    (touched[field] || submitAttempted) ? fieldErrors[field] : undefined;
  const markTouched = (field: keyof SpaceFieldErrors) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  // Auto-derive slug + name from the repo URL until the user types in
  // those fields explicitly. Empty URL clears the auto-filled values too.
  const repoLeaf = useMemo(
    () => deriveRepoLeaf(formData.git_repository_url ?? ''),
    [formData.git_repository_url],
  );
  const derivedSlug = useMemo(() => deriveSpaceSlug(repoLeaf), [repoLeaf]);
  const derivedName = useMemo(() => deriveSpaceName(repoLeaf), [repoLeaf]);

  useEffect(() => {
    setFormData((prev) => {
      const nextSlug = slugTouched ? prev.slug : derivedSlug;
      const nextName = nameTouched ? prev.name : derivedName;
      if (nextSlug === prev.slug && nextName === prev.name) return prev;
      return { ...prev, slug: nextSlug, name: nextName };
    });
  }, [derivedSlug, derivedName, slugTouched, nameTouched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) return;
    setLoading(true);
    setError(null);
    createSpace({
      ...formData,
      name: trim(formData.name),
      slug: trim(formData.slug),
      description: trim(formData.description ?? ''),
      git_repository_url: trim(formData.git_repository_url ?? ''),
      git_default_branch: trim(formData.git_default_branch ?? ''),
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal open={isOpen} onClose={onClose} size={ModalSize.Lg} title={t('spaceForm.createTitle')}>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 overflow-auto">
          {error && (
            <div className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('spaceForm.section.gitRepository')}</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.repositoryUrl')}</label>
              <input
                type="text"
                required
                value={formData.git_repository_url}
                onChange={e => setFormData({ ...formData, git_repository_url: e.target.value })}
                onBlur={() => markTouched('git_repository_url')}
                placeholder={t('spaceForm.fields.repositoryUrlPlaceholder')}
                className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                  showError('git_repository_url')
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary'
                }`}
                autoFocus
              />
              {showError('git_repository_url') ? (
                <p className="text-xs mt-1 text-destructive">{showError('git_repository_url')}</p>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">
                  {t('spaceForm.fields.repositoryUrlHint')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.gitProvider')}</label>
                <select
                  value={formData.git_provider}
                  onChange={e => setFormData({ ...formData, git_provider: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="bitbucket_server">{t('spaceForm.fields.providerBitbucket')}</option>
                  <option value="github">{t('spaceForm.fields.providerGitHub')}</option>
                  <option value="local_git">{t('spaceForm.fields.providerLocal')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.defaultBranch')}</label>
                <input
                  type="text"
                  value={formData.git_default_branch}
                  onChange={e => setFormData({ ...formData, git_default_branch: e.target.value })}
                  onBlur={() => markTouched('git_default_branch')}
                  placeholder={t('spaceForm.fields.defaultBranchPlaceholder')}
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('git_default_branch')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('git_default_branch') && (
                  <p className="text-xs mt-1 text-destructive">{showError('git_default_branch')}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">{t('spaceForm.section.basic')}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.spaceName')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => {
                    setNameTouched(true);
                    setFormData({ ...formData, name: e.target.value });
                  }}
                  onBlur={() => markTouched('name')}
                  placeholder={t('spaceForm.fields.spaceNamePlaceholder')}
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('name')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('name') && (
                  <p className="text-xs mt-1 text-destructive">{showError('name')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.spaceKey')}</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={e => {
                    setSlugTouched(true);
                    setFormData({
                      ...formData,
                      slug: lowerCase(e.target.value).replace(/[^a-z0-9]/g, '-'),
                    });
                  }}
                  onBlur={() => markTouched('slug')}
                  placeholder={t('spaceForm.fields.spaceKeyPlaceholder')}
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('slug')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('slug') && (
                  <p className="text-xs mt-1 text-destructive">{showError('slug')}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.description')}</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                onBlur={() => markTouched('description')}
                placeholder={t('spaceForm.fields.descriptionPlaceholder')}
                rows={2}
                className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 ${
                  showError('description')
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary'
                }`}
              />
              {showError('description') && (
                <p className="text-xs mt-1 text-destructive">{showError('description')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('spaceForm.fields.visibility')}</label>
              <select
                value={formData.visibility}
                onChange={e =>
                  setFormData({ ...formData, visibility: e.target.value as SpaceVisibility })
                }
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="private">{t('spaceForm.fields.visibilityPrivate')}</option>
                <option value="team">{t('spaceForm.fields.visibilityTeam')}</option>
                <option value="public">{t('spaceForm.fields.visibilityPublic')}</option>
              </select>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || (submitAttempted && hasErrors)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? t('spaceForm.creating') : t('spaceForm.create')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
