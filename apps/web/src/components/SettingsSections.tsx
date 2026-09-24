"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/convexApi";

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

const inputCls = "rounded-md border px-3 py-1.5 text-sm";

export function BlocklistSection() {
  const terms = useQuery(api.listBlocklist, {});
  const add = useMutation(api.addBlocklistTerm);
  const remove = useMutation(api.removeBlocklistTerm);
  const [term, setTerm] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run(async () => {
                await add({ term });
                setTerm("");
              })
            }
          >
            Add
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(terms ?? []).map((t) => (
            <span key={t._id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">
              {t.term}
              <button className="text-slate-400 hover:text-red-600" onClick={() => run(() => remove({ id: t._id }))}>
                ×
              </button>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FallbackSection() {
  const words = useQuery(api.listFallbackWords, {});
  const add = useMutation(api.addFallbackWords);
  const [text, setText] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fallback words</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="comma-separated words to add"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run(async () => {
                await add({ words: text.split(",").map((w) => w.trim()).filter(Boolean) });
                setText("");
              })
            }
          >
            Add
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {words ? `${words.length} words` : "…"}
        </p>
      </CardContent>
    </Card>
  );
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => reject(new Error("could not read audio metadata"));
    audio.src = URL.createObjectURL(file);
  });
}

export function MusicSection() {
  const tracks = useQuery(api.listMusic, {});
  const createUploadUrl = useMutation(api.createMusicUploadUrl);
  const addTrack = useMutation(api.addMusicTrack);
  const setActive = useMutation(api.setMusicActive);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = () =>
    run(async () => {
      if (!file) throw new Error("choose an audio file");
      if (!title || !source || !licenseUrl) throw new Error("title, source and license URL are required");
      setBusy(true);
      try {
        const durationSec = await getAudioDuration(file);
        const url = await createUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "audio/mpeg" },
          body: file,
        });
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };
        await addTrack({ title, storageId, durationSec, source, licenseUrl });
        setTitle("");
        setSource("");
        setLicenseUrl("");
        setFile(null);
      } finally {
        setBusy(false);
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background music</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} placeholder="source (e.g. Pixabay)" value={source} onChange={(e) => setSource(e.target.value)} />
          <input className={inputCls} placeholder="license URL" value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} />
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <Button size="sm" onClick={upload} disabled={busy}>
          {busy ? "Uploading…" : "Upload track"}
        </Button>

        <div className="space-y-1 pt-2 text-sm">
          {(tracks ?? []).map((t) => (
            <div key={t._id} className="flex items-center justify-between">
              <span>
                {t.title} · {Math.round(t.durationSec)}s · {t.source}
              </span>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={t.active}
                  onChange={(e) => run(() => setActive({ trackId: t._id, active: e.target.checked }))}
                />
                active
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
