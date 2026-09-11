import type { Metadata } from "next";
import "./globals.css";
import { getLanguage, LanguageBar } from "./language";
export const metadata: Metadata = { title: "KPKMM | Kelab Peminat Kereta Mini Malaysia", description: "Kelab Peminat Kereta Mini Malaysia — club history, shared moments and outings. Sejarah kelab, kenangan bersama dan aktiviti." };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 const lang = await getLanguage();
 return <html lang={lang}><body><LanguageBar lang={lang} />{children}</body></html>;
}
