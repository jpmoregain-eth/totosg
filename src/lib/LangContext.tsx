import React, { createContext, useContext, useState } from 'react';
import { Lang } from './i18n';

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LangContext = createContext<LangContextType>({
  lang: 'EN',
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('EN');
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
