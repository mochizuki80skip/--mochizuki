"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GbpLocation } from "@/lib/google";
import { importStoresAction, listGoogleLocationsAction } from "../../actions";

const looksLikeSekkotsuin = (l: GbpLocation) =>
  /接骨|整骨|ほねつぎ|柔道整復/.test(`${l.title} ${l.category}`) || /bone ?sett|judo/i.test(l.category);

export function ImportList({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [locations, setLocations] = useState<GbpLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, start] = useTransition();

  useEffect(() => {
    listGoogleLocationsAction()
      .then((ls) => {
        setLocations(ls);
        setSelected(new Set(ls.filter((l) => looksLikeSekkotsuin(l) && !existing.includes(l.locationId)).map((l) => l.locationId)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"));
  }, [existing]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!locations) return <div className="text-sm text-gray-500">Google から店舗一覧を取得中…</div>;

  const shown = locations.filter((l) => !query || `${l.title}${l.address}${l.category}`.includes(query));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="店舗名・住所で絞り込み"
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48"
        />
        <button
          disabled={busy || selected.size === 0}
          onClick={() =>
            start(async () => {
              await importStoresAction(locations.filter((l) => selected.has(l.locationId)));
              router.push("/dashboard/stores");
            })
          }
          className="bg-brand text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          選択した {selected.size} 店舗を取り込む
        </button>
      </div>
      <div className="bg-white border rounded divide-y">
        {shown.map((l) => {
          const done = existing.includes(l.locationId);
          return (
            <label key={l.locationId} className={`flex items-center gap-3 px-3 py-2 text-sm ${done ? "text-gray-400" : "cursor-pointer"}`}>
              <input type="checkbox" disabled={done} checked={done || selected.has(l.locationId)} onChange={() => toggle(l.locationId)} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{l.title}{done && "（取り込み済み）"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {l.category} ／ {l.address}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
