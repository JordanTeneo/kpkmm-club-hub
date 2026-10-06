'use client';
import {createContext, useContext, type ReactNode} from 'react';
import {uiText, type UiLanguage} from '../lib/ui-text';

const UiLanguageContext = createContext<UiLanguage>('en');
export function UiLanguageProvider({language, children}: {language: UiLanguage; children: ReactNode}) {
  return <UiLanguageContext.Provider value={language}>{children}</UiLanguageContext.Provider>;
}
export function useUiLanguage() { return useContext(UiLanguageContext); }
export function useUiText() { return uiText(useUiLanguage()); }
