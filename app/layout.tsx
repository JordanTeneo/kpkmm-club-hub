import type { Metadata } from "next";
import "./globals.css";
import './site-navigation.css';
import { getLanguage, LanguageBar } from "./language";
import {UiLanguageProvider} from './ui-language';
export async function generateMetadata(): Promise<Metadata> { const bm = (await getLanguage()) === "ms"; return { title: "KPKMM | Kelab Peminat Kereta Mini Malaysia", description: bm ? "Kelab Peminat Kereta Mini Malaysia — sejarah kelab, kenangan bersama dan aktiviti." : "Kelab Peminat Kereta Mini Malaysia — club history, shared moments and outings." }; }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 const lang = await getLanguage();
 return <html lang={lang}><body><UiLanguageProvider language={lang}><LanguageBar lang={lang} />{children}</UiLanguageProvider></body></html>;
}
