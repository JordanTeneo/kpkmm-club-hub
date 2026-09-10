export type ClubItem = { id: string; date: string; title: string; details: string; posterUrl?: string };
export type ClubMoment = { id: string; url: string; caption: string; eventId?: string; albumId?: string };
export type ClubData = { events: ClubItem[]; notices: ClubItem[]; moments: ClubMoment[] };
export const fallbackData: ClubData = { events: [{ id: "bomba-2025", date: "17 MAY 2025", title: "Larian Bersama Bomba", details: "A memorable KPKMM community outing at Dewan Kota Shah Alam, captured by the club and its members." }], notices: [{ id: "notice-1", date: "17 MAY", title: "Larian Bersama Bomba 2025", details: "See photographs from the Dewan Kota Shah Alam outing." }, { id: "notice-2", date: "27 FEB", title: "15 Tahun KPKMM", details: "Celebrating at PD London Bus Retro Village, Kampong Si Rusa." }], moments: [] };
const base = "https://blob.vercel-storage.com"; const prefix = "kpkmm/club-data-";
function headers(extra: HeadersInit = {}) { return { Authorization: "Bearer " + process.env.BLOB_READ_WRITE_TOKEN, "x-api-version": "7", ...extra }; }
export async function getClubData(strict = false): Promise<ClubData> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Storage is not configured");
    let cursor = "";
    let latest: { url: string; uploadedAt: string } | undefined;
    do {
      const response = await fetch(base + "?prefix=" + encodeURIComponent(prefix) + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { headers: headers(), cache: "no-store" });
      if (!response.ok) throw new Error("Storage read failed");
      const result = await response.json() as { blobs?: { url: string; uploadedAt: string }[]; hasMore?: boolean; cursor?: string };
      for (const blob of result.blobs || []) if (!latest || blob.uploadedAt > latest.uploadedAt) latest = blob;
      cursor = result.hasMore ? result.cursor || "" : "";
    } while (cursor);
    if (!latest) return structuredClone(fallbackData);
    const response = await fetch(latest.url, { cache: "no-store" });
    if (!response.ok) throw new Error("Club data read failed");
    const saved = await response.json() as ClubData;
    if (!Array.isArray(saved.events) || !Array.isArray(saved.notices) || !Array.isArray(saved.moments)) throw new Error("Invalid club data");
    saved.moments = saved.moments.map(photo => photo.albumId ? photo : { ...photo, albumId: photo.eventId ? "legacy-" + encodeURIComponent(photo.eventId + ":" + photo.caption) : photo.id });
    return saved;
  } catch (error) { if (strict) throw error; return structuredClone(fallbackData); }
}
export async function saveClubData(data: ClubData) { const response = await fetch(base + "/" + prefix + Date.now() + ".json", { method: "PUT", headers: headers({ "x-add-random-suffix": "0", "x-content-type": "application/json" }), body: JSON.stringify(data) }); if (!response.ok) throw new Error("Storage upload failed"); }
export async function savePhoto(file: File) { const response = await fetch(base + "/kpkmm/media/" + crypto.randomUUID() + "-" + file.name, { method: "PUT", headers: headers({ "x-add-random-suffix": "0", "x-content-type": file.type }), body: file }); if (!response.ok) throw new Error("Photo upload failed"); return response.json() as Promise<{ url: string }>; }
