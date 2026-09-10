import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "KPKMM | Kelab Peminat Kereta Mini Malaysia", description: "KPKMM club events, notices and outings." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
