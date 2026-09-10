import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClubData, saveClubData, savePhoto } from "../../lib/club-data";

import { AlbumManager } from "../album-ui";

const cookieName = "kpkmm-admin";
const refresh = () => { revalidatePath("/"); revalidatePath("/admin"); };
function same(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function signature(value: string) { return createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "missing").update(value).digest("hex"); }
async function signedIn() { const raw = (await cookies()).get(cookieName)?.value; if (!raw || !process.env.ADMIN_SESSION_SECRET) return false; const [value, sig] = raw.split("."); return !!value && !!sig && Number(value) > Date.now() && same(sig, signature(value)); }

export default async function AdminPage() {
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
  if (!ok) return <main style={{ padding: 40 }}><a href="/">← KPKMM website</a><h1>KPKMM club admin</h1><p>Sign in to manage notices, club archive and shared moments.</p><form action={login}><input name="password" type="password" placeholder="Admin password" required /><button>Sign in</button></form></main>;
  const data = await getClubData();
  const card = { border: "1px solid #bbb", padding: 16, display: "grid", gap: 10 };
  const eventPicker = (selected?: string) => <select name="eventId" defaultValue={selected || ""}><option value="">Not linked to an outing</option>{data.events.map((event) => <option value={event.id} key={event.id}>{event.date} — {event.title}</option>)}</select>;
  return <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}><a href="/">← View KPKMM website</a><h1>KPKMM club admin</h1><form action={logout}><button>Sign out</button></form><hr/><section><h2>Add an outing</h2><form action={addRecord}><input type="hidden" name="type" value="event" /><input name="date" placeholder="Date, e.g. 17 MAY 2026" required /><input name="title" placeholder="Outing title" required /><textarea name="details" placeholder="Story" required /><button>Publish outing</button></form></section><section><h2>Post a notice</h2><p>After posting, add its poster in “Manage notices” below.</p><form action={addRecord}><input type="hidden" name="type" value="notice" /><input name="date" placeholder="Date label" required /><input name="title" placeholder="Notice heading" required /><textarea name="details" placeholder="Message" required /><button>Post notice</button></form></section><hr/><section><h2>Manage notices</h2>{data.notices.map((item) => <article key={item.id} style={card}><form action={updateRecord}><input type="hidden" name="type" value="notice" /><input type="hidden" name="id" value={item.id} /><input name="date" defaultValue={item.date} required /><input name="title" defaultValue={item.title} required /><textarea name="details" defaultValue={item.details} required /><button>Save notice</button></form>{item.posterUrl && <img src={item.posterUrl} alt="Notice poster" style={{ maxWidth: 300, width: "100%", height: "auto" }} />}<form action={attachPoster}><input type="hidden" name="id" value={item.id} /><input name="poster" type="file" accept="image/jpeg,image/png,image/webp" required /><button>{item.posterUrl ? "Replace poster" : "Upload poster"}</button></form><form action={removeRecord}><input type="hidden" name="type" value="notice" /><input type="hidden" name="id" value={item.id} /><button>Delete notice</button></form></article>)}</section><hr/><section><h2>Manage club archive</h2><p>Photos linked to an outing appear with its shared moments on the public site.</p>{data.events.map((item) => <article key={item.id} style={card}><form action={updateRecord}><input type="hidden" name="type" value="event" /><input type="hidden" name="id" value={item.id} /><input name="date" defaultValue={item.date} required /><input name="title" defaultValue={item.title} required /><textarea name="details" defaultValue={item.details} required /><button>Save outing</button></form><p>{data.moments.filter((moment) => moment.eventId === item.id).length} linked shared moments</p><form action={removeRecord}><input type="hidden" name="type" value="event" /><input type="hidden" name="id" value={item.id} /><button>Delete outing</button></form></article>)}</section><hr/><AlbumManager photos={data.moments} events={data.events} action={manageAlbum} /><hr/><p>{data.events.length} outings · {data.notices.length} notices · {data.moments.length} photos</p></main>;
}
