"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type Photo = { id: string; url: string; caption: string; eventId?: string; albumId?: string };
type Outing = { id: string; title: string; date: string };
type Action = (form: FormData) => Promise<{ error?: string }>;
function albums(photos: Photo[]) {
  const groups = new Map<string, Photo[]>();
  for (const photo of photos) {
    const id = photo.albumId || photo.id;
    groups.set(id, [...(groups.get(id) || []), photo]);
  }
  return Array.from(groups, ([id, photos]) => ({ id, photos }));
}

async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose JPG, PNG or WebP photos.");
  if (file.size > 40 * 1024 * 1024) throw new Error(file.name + " is too large. Please choose a photo under 40 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.68, 0.5, 0.35]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 750 * 1024) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    throw new Error(file.name + " could not be compressed enough. Please choose a smaller copy.");
  } finally { bitmap.close(); }
}

export function AlbumManager({ photos, events, action }: { photos: Photo[]; events: Outing[]; action: Action }) {
  const router = useRouter();
  const groups = albums(photos);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ form: HTMLFormElement; id: string; files: File[]; ids: string[]; next: number } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const operation = String(values.get("operation"));
    if (operation.startsWith("delete") && !window.confirm(operation === "deleteAlbum" ? "Delete this moment and all its photos from the website?" : "Delete this photo from the moment?")) return;
    lock.current = true; setBusy(true); setStatus("");
    try {
      if (operation === "upload") {
        if (pending.current?.form !== form) {
          const files = values.getAll("photo").filter((v): v is File => v instanceof File && v.size > 0);
          if (!files.length) throw new Error("Choose at least one photo.");
          pending.current = { form, id: String(values.get("albumId") || crypto.randomUUID()), files, ids: files.map(() => crypto.randomUUID()), next: 0 };
        }
        const batch = pending.current!;
        for (; batch.next < batch.files.length; batch.next++) {
          setStatus("Preparing and uploading photo " + (batch.next + 1) + " of " + batch.files.length + "…");
          const payload = new FormData();
          for (const key of ["caption", "eventId"]) payload.set(key, String(values.get(key) || ""));
          payload.set("operation", "upload"); payload.set("albumId", batch.id); payload.set("id", batch.ids[batch.next]);
          payload.set("photo", await compress(batch.files[batch.next]));
          const result = await action(payload);
          if (result.error) throw new Error(result.error);
        }
        pending.current = null; form.reset(); setStatus("All photos published.");
      } else {
        const result = await action(values);
        if (result.error) throw new Error(result.error);
        setStatus("Changes saved.");
      }
    } catch (error) {
      setStatus((error instanceof Error ? error.message : "The change could not be saved.") + (operation === "upload" ? " Click Upload photos again to retry the remaining photos." : " Please try again."));
    } finally { lock.current = false; setBusy(false); router.refresh(); }
  }
  const outing = (selected?: string) => <label>Club archive outing<select name="eventId" defaultValue={selected || ""}><option value="">No linked outing</option>{events.map(e => <option key={e.id} value={e.id}>{e.date} — {e.title}</option>)}</select></label>;
  const upload = (id?: string, photo?: Photo) => <form onSubmit={submit}><input type="hidden" name="operation" value="upload" /><input type="hidden" name="albumId" value={id || ""} />{id ? <><input type="hidden" name="caption" value={photo?.caption || ""} /><input type="hidden" name="eventId" value={photo?.eventId || ""} /></> : <><label>Moment title<input name="caption" placeholder="e.g. Sunday drive to Port Dickson" required maxLength={200} /></label>{outing()}</>}<label>{id ? "Add more photos" : "Choose photos"}<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" multiple required onChange={() => { pending.current = null; }} /></label><button>Upload photos</button></form>;
  return <section className="album-admin"><style>{`.album-admin{margin:32px 0}.album-admin fieldset{border:0;padding:0;min-width:0}.album-admin form{display:grid;gap:10px;margin:12px 0}.album-admin label{display:grid;gap:6px;font-weight:600}.album-admin input,.album-admin select{width:100%;min-width:0;padding:10px;border:1px solid #c8b993;border-radius:8px;background:#fffaf0;color:#30291f}.album-admin button{padding:9px 13px;border:1px solid #ad9570;border-radius:8px;background:#f3e3c0;color:#30291f;cursor:pointer}.album-admin button:disabled{opacity:.45;cursor:wait}.album-admin .album-box{background:#fff8e9;border:1px solid #d2bc96;border-radius:16px;padding:20px;margin:18px 0}.album-admin .photo-boxes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.album-admin .photo-box{padding:10px;background:#f5e8cd;border-radius:12px}.album-admin .photo-box img{width:100%;height:135px;object-fit:cover;border-radius:8px}.album-admin .photo-controls{display:flex;gap:5px;flex-wrap:wrap}.album-admin .photo-controls form{margin:3px 0}.album-admin .photo-controls button{font-size:12px;padding:6px 8px}.album-admin .status{position:sticky;top:10px;z-index:3;background:#30291f;color:#fff8e9;padding:14px;border-radius:10px}.album-admin summary{cursor:pointer;font-weight:700;padding:10px 0}`}</style><h2>Shared moments</h2><p>One box per moment. Choose a cover, arrange photos, or move them to another moment. Photos are compressed automatically before uploading.</p>{status && <p className="status" role="status" aria-live="polite">{status}</p>}<fieldset disabled={busy}><div className="album-box"><h3>Create a moment</h3>{upload()}</div>{!groups.length && <p>No moments yet. Upload your first set of photos above.</p>}{groups.map(group => <article className="album-box" key={group.id}><h3>{group.photos[0].caption}</h3><p>{group.photos.length} photo{group.photos.length === 1 ? "" : "s"} · First photo is the cover</p><form onSubmit={submit}><input type="hidden" name="operation" value="updateAlbum" /><input type="hidden" name="albumId" value={group.id} /><label>Moment title<input name="caption" defaultValue={group.photos[0].caption} required maxLength={200} /></label>{outing(group.photos[0].eventId)}<button>Save moment details</button></form><div className="photo-boxes">{group.photos.map((photo, index) => <div className="photo-box" key={photo.id}><Image src={photo.url} alt={photo.caption + " photo " + (index + 1)} width={240} height={160} unoptimized /><p>{index === 0 ? "★ Cover photo" : "Photo " + (index + 1)}</p><div className="photo-controls">{([['cover', 'Set cover'], ['earlier', '← Earlier'], ['later', 'Later →'], ['deletePhoto', 'Delete']] as const).map(([operation, label]) => <form onSubmit={submit} key={operation}><input type="hidden" name="operation" value={operation} /><input type="hidden" name="id" value={photo.id} /><input type="hidden" name="albumId" value={group.id} /><button disabled={busy || (index === 0 && (operation === 'cover' || operation === 'earlier')) || (index === group.photos.length - 1 && operation === 'later')}>{label}</button></form>)}</div>{groups.length > 1 && <form onSubmit={submit}><input type="hidden" name="operation" value="move" /><input type="hidden" name="id" value={photo.id} /><label>Move to moment<select name="target" required defaultValue=""><option value="" disabled>Choose moment</option>{groups.filter(g => g.id !== group.id).map(g => <option key={g.id} value={g.id}>{g.photos[0].caption}</option>)}</select></label><button>Move photo</button></form>}</div>)}</div><details><summary>Add photos to this moment</summary>{upload(group.id, group.photos[0])}</details><form onSubmit={submit}><input type="hidden" name="operation" value="deleteAlbum" /><input type="hidden" name="albumId" value={group.id} /><button>Delete entire moment</button></form></article>)}</fieldset></section>;
}

export function MomentGallery({ photos, events, lang = "en" }: { photos: Photo[]; events: Outing[]; lang?: "en" | "ms" }) {
  const t = (en: string, ms: string) => lang === "ms" ? ms : en;
  const groups = albums(photos);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [index, setIndex] = useState(0);
  const group = groups[selected];
  const photo = group?.photos[index];
  return <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 24 }}>{groups.map((album, n) => <button key={album.id} onClick={() => { setSelected(n); setIndex(0); dialog.current?.showModal(); }} style={{ padding: 0, textAlign: "left", color: "inherit", background: "#f5e7ca", border: "1px solid #c9b690", borderRadius: 16, overflow: "hidden", cursor: "pointer" }} aria-label={t("Open ", "Buka ") + album.photos[0].caption + ", " + album.photos.length + t(" photos", " foto")}><Image src={album.photos[0].url} alt={album.photos[0].caption} width={720} height={480} unoptimized style={{ width: "100%", height: 260, objectFit: "cover" }} /><span style={{ display: "grid", gap: 6, padding: 18 }}><strong>{album.photos[0].caption}</strong><span>{album.photos.length} {t(album.photos.length === 1 ? "photo" : "photos", "foto")} · {t("View moment", "Lihat kenangan")} →</span><small>{events.find(e => e.id === album.photos[0].eventId)?.title}</small></span></button>)}</div><dialog ref={dialog} aria-label="Shared moment photos" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }} onKeyDown={event => { if (!group) return; if (event.key === "ArrowRight") setIndex(i => (i + 1) % group.photos.length); if (event.key === "ArrowLeft") setIndex(i => (i + group.photos.length - 1) % group.photos.length); }} style={{ width: "min(960px,94vw)", maxHeight: "92vh", padding: 20, border: 0, borderRadius: 16, background: "#fbf1d9", color: "#30291f" }}><style>{`dialog::backdrop{background:rgba(20,17,12,.8)}`}</style><button autoFocus onClick={() => dialog.current?.close()} style={{ float: "right", padding: 10 }}>{t("Close", "Tutup")} ✕</button><h3>{group?.photos[0].caption}</h3>{photo && <Image src={photo.url} alt={photo.caption + t(" photo ", " foto ") + (index + 1)} width={1600} height={1100} unoptimized style={{ width: "100%", height: "min(60vh,620px)", objectFit: "contain" }} />}<div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12 }}><button disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← {t("Previous", "Sebelumnya")}</button><span aria-live="polite">{index + 1} / {group?.photos.length || 0}</span><button disabled={!group || index >= group.photos.length - 1} onClick={() => setIndex(i => i + 1)}>{t("Next", "Seterusnya")} →</button></div><div style={{ display: "flex", gap: 8, overflowX: "auto" }}>{group?.photos.map((p, i) => <button key={p.id} aria-label={t("View photo ", "Lihat foto ") + (i + 1)} aria-pressed={i === index} onClick={() => setIndex(i)} style={{ flexShrink: 0, padding: 3, border: i === index ? "3px solid #a64320" : "3px solid transparent" }}><Image src={p.url} alt="" width={80} height={60} unoptimized style={{ objectFit: "cover" }} /></button>)}</div></dialog></>;
}
