import type { Metadata } from "next";
import "./globals.css";
import './site-navigation.css';
import './back-to-top.css';
import {BackToTop} from './back-to-top';
import { getLanguage, LanguageBar } from "./language";
import {UiLanguageProvider} from './ui-language';
import {Suspense} from 'react';
import {NavigationFeedback} from './navigation-feedback';
export async function generateMetadata(): Promise<Metadata> { const bm = (await getLanguage()) === "ms"; return { title: "KPKMM | Kelab Peminat Kereta Mini Malaysia", description: bm ? "Kelab Peminat Kereta Mini Malaysia — sejarah kelab, kenangan bersama dan aktiviti." : "Kelab Peminat Kereta Mini Malaysia — club history, shared moments and outings." }; }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 const lang = await getLanguage();
 return <html lang={lang}><body><div id="page-top" tabIndex={-1}/><UiLanguageProvider language={lang}><Suspense fallback={null}><NavigationFeedback/></Suspense><LanguageBar lang={lang} />{children}<BackToTop label={lang==='ms'?'Kembali ke atas':'Back to top'}/></UiLanguageProvider></body></html>;
}
