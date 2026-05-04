/**
 * ProfilePage
 *
 * User profile with:
 * - User information
 * - Settings (cache toggle, debug toggle)
 */

import { useState, useEffect } from 'react';
import { eventBus, useAppSelector, useTranslation, type HeaderUser } from '@cyberfabric/react';
import { type MeResponse } from '@/app/api';
import {
  Activity,
  Bug,
  Contact,
  Database,
  Mail,
  Settings,
  ShieldCheck,
  CheckCircle2, User,
} from 'lucide-react';
import type { CacheSettings, UserSettings } from '@/app/api/wikiTypes';
import { loadCacheSettings, loadProfileMe, updateCacheSettings } from '@/app/actions/profileActions';
import { loadUserSettings, updateUserSettings } from '@/app/actions/userSettingsActions';
import { PageTitle } from '@/app/layout';

interface ProfilePageProps {
  navigate?: (view: string) => void;
}

function ProfilePage({ navigate: _navigate }: ProfilePageProps) {
  const { t } = useTranslation();
  const headerState = useAppSelector((state) => state['layout/header'] as { user?: HeaderUser } | undefined);
  const headerUser = headerState?.user ?? null;

  const [userInfo, setUserInfo] = useState<MeResponse | null>(null);
  const [cacheSettings, setCacheSettings] = useState<CacheSettings | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const subCacheLoaded = eventBus.on('profile/cache/loaded', ({ settings }) => {
      setCacheSettings(settings);
    });
    const subCacheUpdated = eventBus.on('profile/cache/updated', ({ settings }) => {
      setCacheSettings(settings);
      setSuccess(t('profile.settingsUpdated'));
      setTimeout(() => setSuccess(null), 3000);
    });
    const subUserLoaded = eventBus.on('user/settings/loaded', ({ settings }) => {
      setUserSettings(settings);
    });
    const subUserUpdated = eventBus.on('user/settings/updated', ({ settings }) => {
      setUserSettings(settings);
      setSuccess(t('profile.settingsUpdated'));
      setTimeout(() => setSuccess(null), 3000);
    });
    const subMeLoaded = eventBus.on('profile/me/loaded', ({ me }) => {
      setUserInfo(me);
    });

    loadCacheSettings();
    loadUserSettings();
    loadProfileMe();

    return () => {
      subCacheLoaded.unsubscribe();
      subCacheUpdated.unsubscribe();
      subUserLoaded.unsubscribe();
      subUserUpdated.unsubscribe();
      subMeLoaded.unsubscribe();
    };
  }, [t]);

  const missing = t('common.missing');

  return (
    <div className="h-full flex flex-col bg-background">
      <PageTitle title={t('profile.title')} subtitle={t('profile.subtitle')} />

      {success && (
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 size={16} />
            {success}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('profile.userInfo.field')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('profile.userInfo.value')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <User size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.userInfo.username')}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{userInfo?.username || missing}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <Mail size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.userInfo.email')}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{userInfo?.email || headerUser?.email || missing}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <Contact size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.userInfo.displayName')}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{headerUser?.displayName || missing}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <ShieldCheck size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.userInfo.role')}
                </td>
                <td className="px-4 py-3 text-sm text-foreground capitalize">{userInfo?.role || missing}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <Settings size={14} className="inline mr-2" />
                  {t('profile.settings.header')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{t('profile.settings.description')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">{t('profile.settings.status')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <Database size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.settings.cache.title')}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{t('profile.settings.cache.description')}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (cacheSettings) {
                        updateCacheSettings({ cache_enabled: !cacheSettings.cache_enabled });
                      }
                    }}
                    disabled={!cacheSettings}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                      cacheSettings?.cache_enabled ? 'bg-primary' : 'bg-input'
                    }`}
                    role="switch"
                    aria-checked={cacheSettings?.cache_enabled ?? false}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                        cacheSettings?.cache_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <Bug size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.settings.debug.title')}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {t('profile.settings.debug.description')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (userSettings) {
                        updateUserSettings({ debugMode: !userSettings.debugMode });
                      }
                    }}
                    disabled={!userSettings}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                      userSettings?.debugMode ? 'bg-primary' : 'bg-input'
                    }`}
                    role="switch"
                    aria-checked={userSettings?.debugMode ?? false}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                        userSettings?.debugMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                  <Activity size={14} className="inline mr-2 text-muted-foreground" />
                  {t('profile.settings.perfLog.title')}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {t('profile.settings.perfLog.description')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (userSettings) {
                        updateUserSettings({ perfLogEnabled: !userSettings.perfLogEnabled });
                      }
                    }}
                    disabled={!userSettings}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                      userSettings?.perfLogEnabled ? 'bg-primary' : 'bg-input'
                    }`}
                    role="switch"
                    aria-checked={userSettings?.perfLogEnabled ?? false}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                        userSettings?.perfLogEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
