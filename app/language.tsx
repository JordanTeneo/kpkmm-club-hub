import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
export type Language = "en" | "ms";
export async function getLanguage(): Promise<Language> { return (await cookies()).get("kpkmm-language")?.value === "ms" ? "ms" : "en"; }
async function changeLanguage(form: FormData) {
  "use server";
  const value = form.get("language");
  if (value !== "en" && value !== "ms") return;
  (await cookies()).set("kpkmm-language", value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
}
export function LanguageBar({ lang }: { lang: Language }) {
  return <div className="language-bar"><style>{`.language-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 20px;padding:8px max(5vw,20px);background:#2e2119;color:#fff8ea;font-size:14px}.language-bar nav,.language-bar form{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.language-bar a{padding:10px 8px;min-height:44px}.language-bar button{font:inherit;padding:10px 12px;min-height:44px;border:1px solid #a89271;border-radius:8px;background:transparent;color:inherit;cursor:pointer}.language-bar button[aria-pressed=true]{background:#f7ebd1;color:#2e2119;font-weight:700}.language-bar a:focus-visible,.language-bar button:focus-visible{outline:3px solid #f2c564;outline-offset:2px}@media(max-width:450px){.language-bar{justify-content:center}.language-bar nav{margin-right:auto}.language-bar form{width:100%}.language-bar button{flex:1}}`}</style><nav aria-label={lang === "ms" ? "Halaman utama" : "Site pages"}><a href="/">{lang === "ms" ? "Laman Utama" : "Home"}</a><a href="/about">{lang === "ms" ? "Tentang Kami" : "About Us"}</a></nav><form action={changeLanguage} aria-label="Choose language / Pilih bahasa"><button name="language" value="en" lang="en" aria-pressed={lang === "en"}>English</button><button name="language" value="ms" lang="ms" aria-pressed={lang === "ms"}>Bahasa Malaysia</button></form></div>;
}
