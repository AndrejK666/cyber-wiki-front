import React, { useState, useEffect } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { SpaceVisibility, type Space, type UpdateSpaceRequest } from '@/app/api';
import { updateSpace } from '@/app/actions/wikiActions';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';

interface EditSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
}

export default function EditSpaceModal({ isOpen, onClose, space }: EditSpaceModalProps) {
  const { t } = useTranslation();
  const getCurrentGitUrl = (s: Space) => {
    if (!s.git_base_url || !s.git_repository_id) return '';
    if (s.git_provider === 'bitbucket_server' && s.git_project_key) {
      return `${s.git_base_url}/projects/${s.git_project_key}/repos/${s.git_repository_id}/`;
    }
    return `${s.git_base_url}/${s.git_repository_id}`;
  };

  const [formData, setFormData] = useState({
    name: space.name,
    description: space.description || '',
    visibility: space.visibility,
    git_provider: space.git_provider || 'bitbucket_server',
    git_repository_url: getCurrentGitUrl(space),
    git_default_branch: space.git_default_branch || '',
    edit_fork_project_key: space.edit_fork_project_key || '',
    edit_fork_repo_slug: space.edit_fork_repo_slug || '',
    edit_fork_ssh_url: space.edit_fork_ssh_url || '',
    edit_fork_local_path: space.edit_fork_local_path || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: space.name,
      description: space.description || '',
      visibility: space.visibility,
      git_provider: space.git_provider || 'bitbucket_server',
      git_repository_url: getCurrentGitUrl(space),
      git_default_branch: space.git_default_branch || '',
      edit_fork_project_key: space.edit_fork_project_key || '',
      edit_fork_repo_slug: space.edit_fork_repo_slug || '',
      edit_fork_ssh_url: space.edit_fork_ssh_url || '',
      edit_fork_local_path: space.edit_fork_local_path || '',
    });
    setError(null);
  }, [space]);

  useEffect(() => {
    const subUpdated = eventBus.on('wiki/space/updated', () => {
      setLoading(false);
      onClose();
    });
    const subError = eventBus.on('wiki/space/error', ({ error: msg }) => {
      setLoading(false);
      setError(msg);
    });
    return () => {
      subUpdated.unsubscribe();
      subError.unsubscribe();
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data: UpdateSpaceRequest = {
      name: formData.name,
      description: formData.description,
      visibility: formData.visibility as SpaceVisibility,
      git_provider: formData.git_provider,
      git_repository_url: formData.git_repository_url || undefined,
      git_default_branch: formData.git_default_branch,
      edit_fork_project_key: formData.edit_fork_project_key || undefined,
      edit_fork_repo_slug: formData.edit_fork_repo_slug || undefined,
      edit_fork_ssh_url: formData.edit_fork_ssh_url || undefined,
      edit_fork_local_path: formData.edit_fork_local_path || undefined,
    };
    updateSpace(space.slug, data);
  };

  if (!isOpen) return null;

  const forkComplete =
    formData.edit_fork_project_key && formData.edit_fork_repo_slug && formData.edit_fork_ssh_url;
  const forkPartial =
    !forkComplete &&
    (formData.edit_fork_project_key || formData.edit_fork_repo_slug || formData.edit_fork_ssh_url);

  return (
    <Modal open={isOpen} onClose={onClose} size={ModalSize.X2} title={t('spaceForm.editTitle')}>
      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6 overflow-auto">
          {error && (
            <div className="px-4 py-3 rounded-lg text-sm border border-destructive bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('spaceForm.section.basic')}</h3>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.spaceKeyEdit')}</label>
              <input type="text" value={space.slug} disabled className="w-full px-3 py-2 rounded-lg border opacity-60 cursor-not-allowed bg-muted" />
              <p className="text-xs mt-1 text-muted-foreground">{t('spaceForm.fields.slugDisabledHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.spaceName')}</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.description')}</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
                placeholder={t('spaceForm.fields.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.visibility')}</label>
              <select
                value={formData.visibility}
                onChange={e => setFormData({ ...formData, visibility: e.target.value as SpaceVisibility })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="private">{t('spaceForm.fields.visibilityPrivateDash')}</option>
                <option value="team">{t('spaceForm.fields.visibilityTeamDash')}</option>
                <option value="public">{t('spaceForm.fields.visibilityPublicDash')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('spaceForm.section.gitRepository')}</h3>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.gitProvider')}</label>
              <select
                value={formData.git_provider}
                onChange={e => setFormData({ ...formData, git_provider: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="bitbucket_server">{t('spaceForm.fields.providerBitbucket')}</option>
                <option value="github">{t('spaceForm.fields.providerGitHub')}</option>
                <option value="local_git">{t('spaceForm.fields.providerLocal')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.repositoryUrlEdit')}</label>
              <input
                type="text"
                value={formData.git_repository_url}
                onChange={e => setFormData({ ...formData, git_repository_url: e.target.value })}
                placeholder={t('spaceForm.fields.repositoryUrlPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.fields.defaultBranch')}</label>
              <input
                type="text"
                value={formData.git_default_branch}
                onChange={e => setFormData({ ...formData, git_default_branch: e.target.value })}
                placeholder={t('spaceForm.fields.defaultBranchEditPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
              <p className="text-xs mt-1 text-muted-foreground">{t('spaceForm.fields.defaultBranchEditHint')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('spaceForm.editForkSection.title')}</h3>
              <p className="text-sm mt-1 text-muted-foreground">
                {t('spaceForm.editForkSection.description')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.editForkSection.projectKey')}</label>
              <input
                type="text"
                value={formData.edit_fork_project_key}
                onChange={e => setFormData({ ...formData, edit_fork_project_key: e.target.value })}
                placeholder={t('spaceForm.editForkSection.projectKeyPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.editForkSection.repoSlug')}</label>
              <input
                type="text"
                value={formData.edit_fork_repo_slug}
                onChange={e => setFormData({ ...formData, edit_fork_repo_slug: e.target.value })}
                placeholder={t('spaceForm.editForkSection.repoSlugPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.editForkSection.sshUrl')}</label>
              <input
                type="text"
                value={formData.edit_fork_ssh_url}
                onChange={e => setFormData({ ...formData, edit_fork_ssh_url: e.target.value })}
                placeholder={t('spaceForm.editForkSection.sshUrlPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('spaceForm.editForkSection.localPath')}</label>
              <input
                type="text"
                value={formData.edit_fork_local_path}
                onChange={e => setFormData({ ...formData, edit_fork_local_path: e.target.value })}
                placeholder={t('spaceForm.editForkSection.localPathPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
              <p className="text-xs mt-1 text-muted-foreground">
                {t('spaceForm.editForkSection.localPathHint')}
              </p>
            </div>

            {formData.edit_fork_local_path ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>✓</span>
                <span>{t('spaceForm.editForkSection.statusLocal')}</span>
              </div>
            ) : forkComplete ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>✓</span>
                <span>{t('spaceForm.editForkSection.statusReady')}</span>
              </div>
            ) : forkPartial ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                <span>⚠</span>
                <span>{t('spaceForm.editForkSection.statusPartial')}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium bg-muted hover:bg-muted/80 transition-all">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {loading ? t('spaceForm.updating') : t('spaceForm.update')}
            </button>
          </div>
        </form>
    </Modal>
  );
}
