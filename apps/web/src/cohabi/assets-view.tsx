"use client";

// "From Cohabi": bring your own Cohabi pictures, sounds and videos, or free stock footage, into the edit.
// Each pick is downloaded and handed to OpenCut's own import (processMediaAssets → addMediaAsset), so it then
// behaves like any file dropped into Media: drag it to the timeline.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import {
	type CohabiItem,
	type StockHit,
	fetchAsFile,
	importStock,
	listMine,
	searchStock,
} from "./api";

const fmt = (s: number | null) =>
	s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function useBringIn() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const { requestRevealMedia } = useAssetsPanelStore();
	const [busy, setBusy] = useState<string | null>(null);

	const bringIn = useCallback(
		async (key: string, get: () => Promise<CohabiItem>) => {
			if (!activeProject) {
				toast.error("Open a project first.");
				return;
			}
			setBusy(key);
			try {
				const item = await get();
				const file = await fetchAsFile(item);
				const [asset] = await processMediaAssets({ files: [file] });
				if (!asset) throw new Error("That file couldn't be read.");
				const added = await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
				toast.success(`Added "${item.name}" to your media. Drag it onto the timeline.`);
				if (added) requestRevealMedia(added.id);
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Couldn't bring that in.");
			} finally {
				setBusy(null);
			}
		},
		[activeProject, editor, requestRevealMedia],
	);
	return { bringIn, busy };
}

export function CohabiView() {
	return (
		<div className="flex h-full flex-col">
			<Tabs defaultValue="mine" className="flex h-full flex-col">
				<div className="px-3 pt-4 pb-0">
					<TabsList>
						<TabsTrigger value="mine">Yours on Cohabi</TabsTrigger>
						<TabsTrigger value="stock">Stock footage</TabsTrigger>
					</TabsList>
				</div>
				<Separator className="my-4" />
				<TabsContent value="mine" className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0">
					<MineView />
				</TabsContent>
				<TabsContent value="stock" className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0">
					<StockView />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function MineView() {
	const [items, setItems] = useState<CohabiItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<"all" | CohabiItem["kind"]>("all");
	const { bringIn, busy } = useBringIn();

	const load = useCallback(() => {
		setError(null);
		listMine()
			.then(setItems)
			.catch((e) => setError(e.message));
	}, []);
	useEffect(load, [load]);

	if (error)
		return (
			<div className="text-muted-foreground flex flex-col gap-3 text-sm">
				<p>{error}</p>
				<Button variant="outline" size="sm" onClick={load}>
					Try again
				</Button>
			</div>
		);
	if (!items) return <p className="text-muted-foreground text-sm">Loading your Cohabi media…</p>;

	const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap gap-1">
				{(["all", "video", "image", "audio"] as const).map((k) => (
					<Button
						key={k}
						size="sm"
						variant={filter === k ? "secondary" : "ghost"}
						onClick={() => setFilter(k)}
					>
						{{ all: "All", video: "Videos", image: "Pictures", audio: "Sounds" }[k]}
					</Button>
				))}
			</div>
			{shown.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nothing here yet. Post pictures, sounds or videos on Cohabi and they'll show up here, or try Stock footage.
				</p>
			) : (
				<ScrollArea className="min-h-0 flex-1">
					<div className="grid grid-cols-2 gap-2">
						{shown.map((item) => (
							<Tile
								key={item.id}
								thumb={item.thumb}
								title={item.name}
								sub={[item.kind === "audio" ? "Sound" : item.kind === "image" ? "Picture" : "Video", fmt(item.seconds)].filter(Boolean).join(" · ")}
								busy={busy === item.id}
								disabled={!!busy}
								onAdd={() => bringIn(item.id, async () => item)}
							/>
						))}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}

function StockView() {
	const [q, setQ] = useState("");
	const [hits, setHits] = useState<StockHit[] | null>(null);
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [searching, setSearching] = useState(false);
	const { bringIn, busy } = useBringIn();

	const search = async () => {
		if (q.trim().length < 2) return;
		setSearching(true);
		setError(null);
		try {
			const r = await searchStock(q.trim());
			setHits(r.hits);
			setNote(r.note);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Search failed.");
		} finally {
			setSearching(false);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					search();
				}}
			>
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ocean at sunset" />
				<Button type="submit" disabled={searching || q.trim().length < 2}>
					{searching ? "…" : "Search"}
				</Button>
			</form>
			{error && <p className="text-destructive text-sm">{error}</p>}
			{note && <p className="text-muted-foreground text-xs">{note}</p>}
			{hits && hits.length === 0 && <p className="text-muted-foreground text-sm">No clips for that. Try other words.</p>}
			{hits && hits.length > 0 && (
				<ScrollArea className="min-h-0 flex-1">
					<div className="grid grid-cols-2 gap-2">
						{hits.map((h) => (
							<Tile
								key={h.id}
								thumb={h.thumb}
								title={h.tags || "Stock clip"}
								sub={[`by ${h.by}`, fmt(h.seconds)].filter(Boolean).join(" · ")}
								busy={busy === `stock:${h.id}`}
								disabled={!!busy}
								onAdd={() => bringIn(`stock:${h.id}`, () => importStock(h.id))}
							/>
						))}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}

function Tile({
	thumb,
	title,
	sub,
	busy,
	disabled,
	onAdd,
}: {
	thumb: string | null;
	title: string;
	sub: string;
	busy: boolean;
	disabled: boolean;
	onAdd: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onAdd}
			disabled={disabled}
			title={`Add "${title}" to your media`}
			className="bg-accent/40 hover:bg-accent group flex flex-col overflow-hidden rounded-md border text-left transition disabled:opacity-60"
		>
			<div className="bg-muted relative aspect-video w-full">
				{thumb ? (
					// biome-ignore lint/performance/noImgElement: Commons media, not a Next asset
					<img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
				) : (
					<div className="text-muted-foreground flex h-full items-center justify-center text-xs">♪</div>
				)}
				<span className="bg-background/80 absolute right-1 bottom-1 rounded px-1.5 text-xs">
					{busy ? "Adding…" : "+ Add"}
				</span>
			</div>
			<div className="p-1.5">
				<div className="truncate text-xs font-medium">{title}</div>
				<div className="text-muted-foreground truncate text-[11px]">{sub}</div>
			</div>
		</button>
	);
}
