import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { T, TKey, Lang } from '@/constants/i18n';

const STORAGE_KEY = 'lydo_language';

function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

interface LangContextValue {
  lang: Lang;
  langPref: Lang | 'auto';
  setLang: (l: Lang | 'auto') => void;
  t: (key: TKey) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  langPref: 'auto',
  setLang: () => {},
  t: (key) => T.en[key],
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectDeviceLang());
  const [langPref, setLangPref] = useState<Lang | 'auto'>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored === 'fr') { setLangState('fr'); setLangPref('fr'); }
      else if (stored === 'en') { setLangState('en'); setLangPref('en'); }
      else { setLangPref('auto'); }
    }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang | 'auto') => {
    setLangPref(l);
    if (l === 'auto') {
      AsyncStorage.setItem(STORAGE_KEY, 'auto').catch(() => {});
      setLangState(detectDeviceLang());
    } else {
      AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
      setLangState(l);
    }
  }, []);

  const t = useCallback((key: TKey): string => T[lang][key], [lang]);

  return (
    <LangContext.Provider value={{ lang, langPref, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
