/**
 * TokensPage
 *
 * Service token management (GitHub, Bitbucket, JIRA, Custom)
 * and Personal API tokens.
 */

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import {
  Edit, Check, X, Trash2, Clock,
  AlertCircle, CheckCircle2, ShieldCheck, Loader2,
} from 'lucide-react';
import { ServiceType } from '@/app/api/wikiTypes';
import type { ServiceToken, ServiceTokenCreate, TokenValidationResult } from '@/app/api/wikiTypes';
import { loadServiceTokens, saveServiceToken, deleteServiceToken, validateServiceToken } from '@/app/actions/profileActions';
import { ApiTokensSection } from '@/app/components/ApiTokensSection';
import { PageTitle } from '@/app/layout';
import { formatDateTime } from '@/app/lib/formatDate';

interface TokensPageProps {
  navigate?: (view: string) => void;
}

function TokensPage({ navigate: _navigate }: TokensPageProps) {
  const { t } = useTranslation();

  const SERVICE_ROWS = useMemo(
    () =>
      [
        {
          serviceType: ServiceType.GitHub,
          label: t('tokens.service.github'),
          defaultBaseUrl: 'https://api.github.com',
        },
        {
          serviceType: ServiceType.BitbucketServer,
          label: t('tokens.service.bitbucketServer'),
          defaultBaseUrl: 'https://git.example.com',
        },
        {
          serviceType: ServiceType.Jira,
          label: t('tokens.service.jira'),
          defaultBaseUrl: 'https://jira.example.com',
        },
        {
          serviceType: ServiceType.CustomHeader,
          label: t('tokens.service.customHeader'),
          defaultBaseUrl: '',
        },
      ] as const,
    [t],
  );

  const [tokens, setTokens] = useState<ServiceToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [editForm, setEditForm] = useState({ baseUrl: '', username: '', token: '', name: '' });

  const [validationResults, setValidationResults] = useState<Record<string, TokenValidationResult>>({});
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const subLoaded = eventBus.on('profile/tokens/loaded', ({ tokens: loaded }) => {
      setTokens(loaded);
      setTokensLoading(false);
    });
    const subSaved = eventBus.on('profile/tokens/saved', ({ token }) => {
      setEditingService(null);
      setEditForm({ baseUrl: '', username: '', token: '', name: '' });
      setSuccess(t('tokens.configuredSuccess'));
      setTimeout(() => setSuccess(null), 3000);
      setValidatingIds((prev) => new Set(prev).add(token.id));
    });
    const subDeleted = eventBus.on('profile/tokens/deleted', () => {
      setSuccess(t('tokens.deleteSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    });
    const subError = eventBus.on('profile/tokens/error', ({ error: e }) => {
      setError(e);
      setTokensLoading(false);
    });
    const subValidated = eventBus.on('profile/tokens/validated', ({ id, result }) => {
      setValidationResults((prev) => ({ ...prev, [id]: result }));
      setValidatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });

    loadServiceTokens();

    return () => {
      subLoaded.unsubscribe();
      subSaved.unsubscribe();
      subDeleted.unsubscribe();
      subError.unsubscribe();
      subValidated.unsubscribe();
    };
  }, [t]);

  const findToken = useCallback(
    (serviceType: ServiceType) => tokens.find((tok) => tok.service_type === serviceType),
    [tokens],
  );

  const handleTokenEdit = useCallback((serviceType: ServiceType) => {
    const existing = tokens.find((tok) => tok.service_type === serviceType);
    setEditingService(serviceType);
    setEditForm({
      baseUrl: existing?.base_url || '',
      username: existing?.username || '',
      token: '',
      name: existing?.name || '',
    });
    setError(null);
    setSuccess(null);
  }, [tokens]);

  const handleTokenSave = useCallback((serviceType: ServiceType, e: FormEvent) => {
    e.preventDefault();
    const data: ServiceTokenCreate = { service_type: serviceType };

    if (serviceType === ServiceType.CustomHeader) {
      data.header_name = editForm.baseUrl || 'X-Custom-Token';
      data.name = editForm.name || 'Custom Token';
    } else {
      if (editForm.baseUrl) data.base_url = editForm.baseUrl;
      if (editForm.username) data.username = editForm.username;
    }
    if (editForm.token) data.token = editForm.token;

    saveServiceToken(data);
  }, [editForm]);

  const handleTokenDelete = useCallback((id: string, label: string) => {
    if (window.confirm(t('tokens.deleteConfirm', { label }))) {
      deleteServiceToken(id);
    }
  }, [t]);

  const handleTokenCancel = useCallback(() => {
    setEditingService(null);
    setEditForm({ baseUrl: '', username: '', token: '', name: '' });
    setError(null);
  }, []);

  const handleTokenValidate = useCallback((id: string) => {
    setValidatingIds((prev) => new Set(prev).add(id));
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    validateServiceToken(id);
  }, []);

  if (tokensLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <PageTitle title={t('tokens.title')} subtitle={t('tokens.subtitle')} />

      {(success || error) && (
        <div className="border-b border-border px-6 py-3 space-y-2">
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('tokens.table.service')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('tokens.table.baseUrl')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('tokens.table.username')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('tokens.table.token')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('common.status')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_ROWS.map(({ serviceType, label, defaultBaseUrl }, index) => {
                const existing = findToken(serviceType);
                const isEditing = editingService === serviceType;
                const isConfigured = existing?.has_token ?? false;

                return (
                  <tr key={serviceType} className={`${index > 0 ? 'border-t border-border' : ''} hover:bg-accent/30 transition-colors`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{label}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.baseUrl}
                          onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                          placeholder={serviceType === ServiceType.CustomHeader ? t('tokens.table.customHeaderPlaceholder') : defaultBaseUrl}
                          className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        serviceType === ServiceType.CustomHeader
                          ? (existing?.header_name || t('common.notConfigured'))
                          : (existing?.base_url || t('common.notConfigured'))
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {isEditing && serviceType !== ServiceType.CustomHeader ? (
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          placeholder={serviceType === ServiceType.Jira ? t('tokens.table.jiraUsernamePlaceholder') : t('tokens.table.usernamePlaceholder')}
                          className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        existing?.username || (serviceType === ServiceType.CustomHeader ? t('common.missing') : t('common.notConfigured'))
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {isEditing ? (
                        <input
                          type="password"
                          value={editForm.token}
                          onChange={(e) => setEditForm({ ...editForm, token: e.target.value })}
                          placeholder={t('tokens.table.tokenPlaceholder')}
                          className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        isConfigured ? t('tokens.table.tokenMasked') : t('common.notConfigured')
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const vr = existing ? validationResults[existing.id] : undefined;
                        const isValidating = existing ? validatingIds.has(existing.id) : false;

                        if (isValidating) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 size={12} className="animate-spin" />
                              {t('common.checking')}
                            </span>
                          );
                        }

                        const valid = vr?.valid ?? existing?.last_validation_valid ?? null;
                        const message = vr?.message ?? existing?.last_validation_message ?? null;
                        const checkedAt = existing?.last_validated_at;

                        if (valid !== null && message) {
                          return (
                            <div className="flex flex-col gap-0.5">
                              {valid ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400" title={message}>
                                  <CheckCircle2 size={12} className="shrink-0" />
                                  {message}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive" title={message}>
                                  <AlertCircle size={12} className="shrink-0" />
                                  {message}
                                </span>
                              )}
                              {checkedAt && (
                                <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                                  <Clock size={10} />
                                  {formatDateTime(checkedAt)}
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (isConfigured) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                              <Check size={12} />
                              {t('common.configured')}
                            </span>
                          );
                        }
                        return <span className="text-muted-foreground text-xs">{t('common.notConfigured')}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleTokenSave(serviceType, e)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
                          >
                            <Check size={14} />
                            {t('common.save')}
                          </button>
                          <button
                            onClick={handleTokenCancel}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                          >
                            <X size={14} />
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {isConfigured && existing && (
                            <button
                              onClick={() => handleTokenValidate(existing.id)}
                              disabled={validatingIds.has(existing.id)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                              title={t('tokens.verifyTitle')}
                            >
                              {validatingIds.has(existing.id) ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={14} />
                              )}
                              {t('common.verify')}
                            </button>
                          )}
                          <button
                            onClick={() => handleTokenEdit(serviceType)}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs"
                          >
                            <Edit size={14} />
                            {isConfigured ? t('common.edit') : t('common.configure')}
                          </button>
                          {isConfigured && existing && (
                            <button
                              onClick={() => handleTokenDelete(existing.id, label)}
                              className="p-1 text-destructive hover:text-destructive/80 rounded"
                              title={t('tokens.deleteTitle')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <h3 className="text-sm font-semibold text-foreground mb-2">{t('tokens.notes.title')}</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>{t('tokens.notes.encrypted')}</li>
            <li>{t('tokens.notes.githubScope', { scope: 'repo' })}</li>
            <li>{t('tokens.notes.bitbucket')}</li>
          </ul>
        </div>

        <ApiTokensSection />
      </div>
    </div>
  );
}

export default TokensPage;
