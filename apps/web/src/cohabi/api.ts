// Cohabi Cut ↔ the Commons (cohabi.org). The editor is served from the same site (cohabi.org/cut), so these
// calls ride the member's own sign-in cookie. Every call sends X-Commons: 1, which the Commons requires before
// a cookie may act (its stock routes are write-gated).

export type CohabiKind = "image" | "audio" | "video";

export interface CohabiItem {
	id: string;
	kind: CohabiKind;
	name: string;
	url: string;
	thumb: string | null;
	seconds: number | null;
	credit?: string;
}

export interface StockHit {
	id: string;
	tags: string;
	seconds: number | null;
	by: string;
	page: string | null;
	thumb: string | null;
}

export class CohabiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

const HEADERS = { Accept: "application/json", "X-Commons": "1" };

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(url, {
		credentials: "same-origin",
		...init,
		headers: { ...HEADERS, ...(init.headers || {}) },
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg =
			res.status === 401
				? "Sign in at cohabi.org to bring in your Cohabi media."
				: typeof body?.error === "string"
					? body.error
					: `The Commons said ${res.status}.`;
		throw new CohabiError(msg, res.status);
	}
	return body as T;
}

type RawImage = { id: string; url?: string; alt?: string; name?: string; title?: string };
type RawAudio = { id: string; title?: string; name?: string; seconds?: number | null };
type RawVideo = { id: string; url: string; poster: string | null; seconds: number | null; alt?: string; credit?: string };

export async function listMine(): Promise<CohabiItem[]> {
	const [img, aud, vid] = await Promise.all([
		call<{ images: RawImage[] }>("/api/images?by=me&limit=100"),
		call<{ audio: RawAudio[] }>("/api/audio?by=me&limit=100"),
		call<{ videos: RawVideo[] }>("/api/videos?by=me&limit=100"),
	]);
	const videos: CohabiItem[] = (vid.videos || []).map((v) => ({
		id: v.id,
		kind: "video",
		name: v.alt || "Your video",
		url: v.url,
		thumb: v.poster,
		seconds: v.seconds,
		credit: v.credit,
	}));
	const images: CohabiItem[] = (img.images || []).map((i) => ({
		id: i.id,
		kind: "image",
		name: i.alt || i.title || i.name || "Your picture",
		url: i.url || `/images/${i.id}`,
		thumb: i.url || `/images/${i.id}`,
		seconds: null,
	}));
	const audio: CohabiItem[] = (aud.audio || []).map((a) => ({
		id: a.id,
		kind: "audio",
		name: a.title || a.name || "Your sound",
		url: `/audio/${a.id}`,
		thumb: null,
		seconds: a.seconds ?? null,
	}));
	return [...videos, ...images, ...audio];
}

export async function searchStock(q: string): Promise<{ hits: StockHit[]; note: string }> {
	return call(`/api/stock/videos?q=${encodeURIComponent(q)}`);
}

/** Copies a stock clip into the member's own Cohabi videos (credited), and returns it. */
export async function importStock(id: string): Promise<CohabiItem> {
	const v = await call<RawVideo>(`/api/stock/videos/${encodeURIComponent(id)}/import`, { method: "POST" });
	return { id: v.id, kind: "video", name: v.alt || "Stock clip", url: v.url, thumb: v.poster, seconds: v.seconds, credit: v.credit };
}

const EXT: Record<string, string> = {
	"video/mp4": "mp4",
	"video/quicktime": "mov",
	"video/webm": "webm",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"audio/wav": "wav",
	"audio/ogg": "ogg",
};

/** Downloads a Cohabi file into the browser as a File, ready for the editor's own import. */
export async function fetchAsFile(item: CohabiItem): Promise<File> {
	const res = await fetch(item.url, { credentials: "same-origin" });
	if (!res.ok) throw new CohabiError(`Couldn't load "${item.name}" (${res.status}).`, res.status);
	const blob = await res.blob();
	const type = blob.type || (item.kind === "video" ? "video/mp4" : item.kind === "image" ? "image/jpeg" : "audio/mpeg");
	const base = item.name.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || item.id;
	return new File([blob], `${base}.${EXT[type.split(";")[0]] || "bin"}`, { type });
}
