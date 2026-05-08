/**
 * useScreenTranslations Hook
 *
 * MFE-local i18n loading hook. Accepts a language map produced by
 * `import.meta.glob('./i18n/*.json')` (Vite-compatible glob).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChildMfeBridge } from '@cyberfabric/react';
import { HAI3_SHARED_PROPERTY_LANGUAGE } from '@cyberfabric/react';

interface TranslationJsonModule {
  default: Record<string, string>;
}
type LanguageModuleImporter = () => Promise<TranslationJsonModule>;
type LanguageModuleMap = Record<string, LanguageModuleImporter>;

interface UseScreenTranslationsReturn {
  t: (key: string) => string;
  loading: boolean;
}

export function useScreenTranslations(
  languageModules: LanguageModuleMap,
  bridge: ChildMfeBridge
): UseScreenTranslationsReturn {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const currentLanguageRef = useRef<string>('en');

  const loadTranslations = useCallback(
    async (language: string) => {
      currentLanguageRef.current = language;
      setLoading(true);
      try {
        const moduleKey = `./i18n/${language}.json`;
        const importer = languageModules[moduleKey];

        if (!importer) {
          const fallbackKey = './i18n/en.json';
          const fallbackImporter = languageModules[fallbackKey];
          if (fallbackImporter) {
            const module = await fallbackImporter();
            setTranslations(module.default);
          } else {
            setTranslations({});
          }
        } else {
          const module = await importer();
          setTranslations(module.default);
        }
      } catch {
        setTranslations({});
      } finally {
        setLoading(false);
      }
    },
    [languageModules]
  );

  useEffect(() => {
    const initialProperty = bridge.getProperty(HAI3_SHARED_PROPERTY_LANGUAGE);
    const lang = initialProperty && typeof initialProperty.value === 'string' ? initialProperty.value : 'en';
    loadTranslations(lang);

    const unsubscribe = bridge.subscribeToProperty(HAI3_SHARED_PROPERTY_LANGUAGE, (property) => {
      if (typeof property.value === 'string' && property.value !== currentLanguageRef.current) {
        loadTranslations(property.value);
      }
    });

    return unsubscribe;
  }, [bridge, loadTranslations]);

  const t = useCallback(
    (key: string): string => {
      const translation = translations[key];
      if (translation === undefined) return key;
      return translation;
    },
    [translations]
  );

  return { t, loading };
}
