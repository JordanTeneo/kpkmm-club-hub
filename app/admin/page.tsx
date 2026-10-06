import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClubData, saveClubData, savePhoto } from "../../lib/club-data";

import "./admin.css";

import { AlbumManager } from "../album-ui";

const cookieName = "kpkmm-admin";
const refresh = () => { revalidatePath("/"); revalidatePath("/admin"); };
function same(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function signature(value: string) { return createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "missing").update(value).digest("hex"); }
async function signedIn() { const raw = (await cookies()).get(cookieName)?.value; if (!raw || !process.env.ADMIN_SESSION_SECRET) return false; const [value, sig] = raw.split("."); return !!value && !!sig && Number(value) > Date.now() && same(sig, signature(value)); }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; error?: string }> }) {
  const query = await searchParams;
  const section = ["notices", "archive", "photos"].includes(query.section || "") ? query.section! : "overview";
  const ok = await signedIn();
  async function login(formData: FormData) { "use server"; const password = String(formData.get("password") || ""); if (!process.env.ADMIN_PASSWORD || !same(password, process.env.ADMIN_PASSWORD)) redirect("/admin?error=1"); const expiry = String(Date.now() + 43200000); (await cookies()).set(cookieName, expiry + "." + signature(expiry), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 43200 }); redirect("/admin"); }
  async function logout() { "use server"; (await cookies()).delete(cookieName); redirect("/admin"); }
  async function addRecord(formData: FormData) { "use server"; if (!(await signedIn())) redirect("/admin"); const type = String(formData.get("type")); const title = String(formData.get("title") || "").trim(); const date = String(formData.get("date") || "").trim(); const details = String(formData.get("details") || "").trim(); if (!title || !date || !details) return; const data = await getClubData(); const entry = { id: crypto.randomUUID(), title, date, details }; if (type === "notice") data.notices.unshift(entry); else data.events.unshift(entry); await saveClubData(data); refresh(); }
  async function updateRecord(formData: FormData) { "use server"; if (!(await signedIn())) redirect("/admin"); const type = String(formData.get("type")); const id = String(formData.get("id")); const title = String(formData.get("title") || "").trim(); const date = String(formData.get("date") || "").trim(); const details = String(formData.get("details") || "").trim(); if (!id || !title || !date || !details) return; const data = await getClubData(); const item = (type === "notice" ? data.notices : data.events).find((entry) => entry.id === id); if (item) Object.assign(item, { title, date, details }); await saveClubData(data); refresh(); }
  async function removeRecord(formData: FormData) { "use server"; if (!(await signedIn())) redirect("/admin"); const type = String(formData.get("type")); const id = String(formData.get("id")); const data = await getClubData(); if (type === "notice") data.notices = data.notices.filter((entry) => entry.id !== id); else { data.events = data.events.filter((entry) => entry.id !== id); data.moments = data.moments.map((moment) => moment.eventId === id ? { ...moment, eventId: undefined } : moment); } await saveClubData(data); refresh(); }
  async function attachPoster(formData: FormData) { "use server"; if (!(await signedIn())) redirect("/admin"); const id = String(formData.get("id") || ""); const file = formData.get("poster"); if (!id || !(file instanceof File) || !file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) return; const stored = await savePhoto(file); const data = await getClubData(); const item = data.notices.find((notice) => notice.id === id); if (item) item.posterUrl = stored.url; await saveClubData(data); refresh(); }
async function manageAlbum(formData: FormData): Promise<{ error?: string }> {
    "use server";
    if (!(await signedIn())) return { error: "Your session expired. Refresh this page and sign in again." };
    try {
      const data = await getClubData(true);
      const photos = data.moments as (typeof data.moments[number] & { albumId?: string })[];
      const key = (p: { id: string; albumId?: string }) => p.albumId || p.id;
      const op = String(formData.get("operation") || "");
      const albumId = String(formData.get("albumId") || "");
      const id = String(formData.get("id") || "");
      const caption = String(formData.get("caption") || "KPKMM shared moment").trim().slice(0, 200);
      const eventId = String(formData.get("eventId") || "");
      if (op === "upload") {
        const file = formData.get("photo");
        if (!albumId || !id || !(file instanceof File) || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size === 0 || file.size > 750 * 1024) return { error: "Please upload a compressed JPG, PNG or WebP photo under 750 KB." };
        if (photos.some(p => p.id === id)) return {};
        const existing = photos.find(p => key(p) === albumId);
        const stored = await savePhoto(file);
        const photo = { id, albumId, url: stored.url, caption: existing?.caption || caption, eventId: existing?.eventId || (data.events.some(e => e.id === eventId) ? eventId : undefined) };
        if (existing) photos.push(photo); else photos.unshift(photo);
      } else if (op === "updateAlbum") {
        if (!caption) return { error: "Enter a moment title." };
        for (const photo of photos.filter(p => key(p) === albumId)) Object.assign(photo, { caption, eventId: data.events.some(e => e.id === eventId) ? eventId : undefined });
      } else if (op === "deleteAlbum") {
        data.moments = photos.filter(p => key(p) !== albumId);
      } else if (op === "deletePhoto") {
        data.moments = photos.filter(p => p.id !== id);
      } else if (op === "move") {
        const photo = photos.find(p => p.id === id);
        const destination = photos.find(p => key(p) === String(formData.get("target")));
        if (!photo || !destination) return { error: "The destination moment no longer exists. Refresh and try again." };
        const destinationId = key(destination);
        Object.assign(photo, { albumId: destinationId, caption: destination.caption, eventId: destination.eventId });
        data.moments = [...photos.filter(p => p.id !== id), photo];
      } else if (["cover", "earlier", "later"].includes(op)) {
        const positions = photos.flatMap((p, i) => key(p) === albumId ? [i] : []);
        const ordered = positions.map(i => photos[i]);
        const from = ordered.findIndex(p => p.id === id);
        const to = op === "cover" ? 0 : from + (op === "earlier" ? -1 : 1);
        if (from < 0 || to < 0 || to >= ordered.length) return {};
        const [photo] = ordered.splice(from, 1); ordered.splice(to, 0, photo);
        positions.forEach((position, i) => { photos[position] = ordered[i]; });
      } else return { error: "Unknown change. Refresh and try again." };
      await saveClubData(data);
      refresh();
      return {};
    } catch { return { error: "The change could not be saved. Check your connection and try again." }; }
  }
  async function reorderArchive(form: FormData) {
    "use server";
    if (!(await signedIn())) redirect("/admin");
    const id = String(form.get("id") || "");
    const direction = String(form.get("direction") || "");
    if (!["up", "down"].includes(direction)) return;
    const current = await getClubData(true);
    const from = current.events.findIndex(event => event.id === id);
    const to = from + (direction === "up" ? -1 : 1);
    if (from < 0 || to < 0 || to >= current.events.length) return;
    [current.events[from], current.events[to]] = [current.events[to], current.events[from]];
    await saveClubData(current);
    refresh();
  }

  if (!ok) return <main className="club-admin admin-login"><a href="/">← KPKMM website</a><p className="admin-kicker">COMMITTEE ACCESS</p><h1>Welcome back</h1><p>Sign in to manage your club. / Log masuk untuk mengurus kelab.</p>{query.error && <p role="alert">Incorrect password. Please try again.</p>}<form action={login}><label>Admin password / Kata laluan<input name="password" type="password" autoComplete="current-password" required /></label><button>Sign in / Log masuk</button></form></main>;
  const data = await getClubData();
  const fields = (item?: { date: string; title: string; details: string }) => <><label>Date label / Tarikh<input name="date" defaultValue={item?.date} placeholder="17 MAY 2026" required /></label><label>Title / Tajuk<input name="title" defaultValue={item?.title} required /></label><label>Details / Butiran<textarea name="details" defaultValue={item?.details} rows={4} required /></label></>;
  const groups = [
    { title: "Membership", bm: "Keahlian", links: [
      ["/admin/members/roster", "Member listing & Excel", "Senarai ahli · Edit records, status and exports"],
      ["/admin/members", "New applications", "Permohonan baharu · Review requests to join"],
      ["/admin/renewals", "Membership renewals", "Pembaharuan · Review payments and renewals"],
    ] },
    { title: "Website", bm: "Laman web", links: [
      ["/admin?section=notices#workspace", "Notice board", "Papan kenyataan · Publish messages and posters"],
      ["/admin?section=archive#workspace", "Club archive", "Arkib kelab · Edit outings and arrange their order"],
      ["/admin?section=photos#workspace", "Shared moments", "Momen bersama · Add and organize photo albums"],
      ["/admin/banner", "Homepage banner", "Sepanduk utama · Change the featured photo"],
      ["/admin/videos", "Videos", "Video · Manage YouTube links"],
    ] },
    { title: "Shop & settings", bm: "Kedai & tetapan", links: [
      ["/admin/shop", "Marketplace", "Kedai · Manage products, stock and orders"],
      ["/admin/email", "Club email", "E-mel kelab · Manage notification connection"],
    ] },
  ];
  return <main className="club-admin">
    <header className="admin-header"><div><p className="admin-kicker">KPKMM · COMMITTEE WORKSPACE</p><h1>Club dashboard <span>/ Pentadbiran kelab</span></h1><p>Everything you need to keep the club running, in one place.</p></div><div className="admin-header-actions"><a href="/">View website ↗</a><form action={logout}><button className="admin-secondary">Sign out / Log keluar</button></form></div></header>
    <nav className="admin-tabs" aria-label="Admin sections">{[["overview","Overview / Utama"],["notices","Notices / Notis"],["archive","Archive / Arkib"],["photos","Photos / Foto"]].map(([id,label])=><a key={id} href={id==="overview"?"/admin":"/admin?section="+id+"#workspace"} aria-current={section===id?"page":undefined}>{label}</a>)}</nav>
    {section==="overview" ? <>
      <div className="admin-stats"><a href="/admin?section=notices#workspace"><strong>{data.notices.length}</strong> Notices / Notis</a><a href="/admin?section=archive#workspace"><strong>{data.events.length}</strong> Outings / Aktiviti</a><a href="/admin?section=photos#workspace"><strong>{data.moments.length}</strong> Photos / Foto</a></div>
      {groups.map(group=><section className="admin-group" key={group.title}><h2>{group.title} <span>/ {group.bm}</span></h2><div className="admin-card-grid">{group.links.map(([href,title,description])=><a className="admin-link-card" href={href} key={href}><strong>{title}<span aria-hidden="true">↗</span></strong><p>{description}</p></a>)}</div></section>)}
    </> : <section id="workspace" className="admin-workspace">
      <a className="admin-back" href="/admin">← Dashboard / Utama</a>
      {section==="photos" ? <AlbumManager photos={data.moments} events={data.events} action={manageAlbum} /> : <>
        <div className="admin-section-heading"><h2>{section==="notices"?"Notice board / Papan kenyataan":"Club archive / Arkib kelab"}</h2><p>{section==="notices"?"Open a notice to edit its message or poster.":"Open an outing to edit it. Use the arrows to change the public display order."}</p></div>
        <details className="admin-create"><summary>＋ {section==="notices"?"Add notice / Tambah notis":"Add outing / Tambah aktiviti"}</summary><form action={addRecord}><input type="hidden" name="type" value={section==="notices"?"notice":"event"} />{fields()}<button>{section==="notices"?"Publish notice / Siarkan notis":"Publish outing / Siarkan aktiviti"}</button><small>{section==="notices"?"After publishing, open the notice below to attach its poster.":"Link photos to this outing in the Photos tab."}</small></form></details>
        {(section==="notices"?data.notices:data.events).length===0 && <p className="admin-empty">Nothing here yet. Use the add button above to get started.</p>}
        {(section==="notices"?data.notices:data.events).map((item,index)=><details className="admin-record" key={item.id}><summary><span className="admin-record-number">{String(index+1).padStart(2,"0")}</span><span><strong>{item.title}</strong><small>{item.date}</small></span><span className="admin-edit-hint">Edit / Sunting ＋</span></summary><div className="admin-record-body">
          {section==="archive" && <div className="admin-order"><strong>Position / Kedudukan {index+1}</strong>{["up","down"].map(direction=><form action={reorderArchive} key={direction}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="direction" value={direction}/><button className="admin-secondary" disabled={direction==="up"?index===0:index===data.events.length-1}>{direction==="up"?"↑ Move up / Naik":"↓ Move down / Turun"}</button></form>)}</div>}
          <form action={updateRecord}><input type="hidden" name="type" value={section==="notices"?"notice":"event"}/><input type="hidden" name="id" value={item.id}/>{fields(item)}<button>Save changes / Simpan perubahan</button></form>
          {section==="notices" ? <div className="admin-poster">{"posterUrl" in item && typeof item.posterUrl==="string" && item.posterUrl && <img src={item.posterUrl} alt={"Poster: "+item.title} loading="lazy" width={240} style={{height:"auto",maxWidth:"100%"}}/>}<form action={attachPoster}><input type="hidden" name="id" value={item.id}/><label>Poster image / Gambar poster<input name="poster" type="file" accept="image/jpeg,image/png,image/webp" required/></label><small>JPG, PNG or WebP · Maximum 4 MB</small><button className="admin-secondary">Upload / replace poster</button></form></div> : <p>{data.moments.filter(moment=>moment.eventId===item.id).length} linked photos · <a href="/admin?section=photos#workspace">Manage photos →</a></p>}
          <details className="admin-danger"><summary>Delete {section==="notices"?"notice":"outing"} / Padam</summary><p>This removes the item from the website.{section==="archive"?" Linked photos remain in Shared moments.":""}</p><form action={removeRecord}><input type="hidden" name="type" value={section==="notices"?"notice":"event"}/><input type="hidden" name="id" value={item.id}/><label><input type="checkbox" required/> I confirm I want to delete this item.</label><button>Confirm deletion / Sahkan padam</button></form></details>
        </div></details>)}
      </>}
    </section>}
    <p className="admin-footnote">KPKMM administration · Changes become visible on the website after saving.</p>
  </main>;
}
