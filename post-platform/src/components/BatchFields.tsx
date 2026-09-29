"use client";

import { useState } from "react";
import { TemplateEditor, type PreviewStore } from "@/components/TemplateEditor";

export type BatchDefaults = {
  theme: string;
  memo: string;
  mode: string;
  gbpTemplate: string;
  igTemplate: string;
  mediaType: string;
  headline: string;
  bgPrompt: string;
};

const input = "mt-1 w-full border rounded px-3 py-2 text-sm font-normal";

export function BatchFields({
  d,
  stores,
  customKeys,
  themeIdeas = [],
}: {
  d: BatchDefaults;
  stores: PreviewStore[];
  customKeys: string[];
  themeIdeas?: string[];
}) {
  const [mode, setMode] = useState(d.mode);
  const [mediaType, setMediaType] = useState(d.mediaType);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        テーマ
        <input name="theme" list="theme-ideas" defaultValue={d.theme} required className={input} />
        <datalist id="theme-ideas">
          {themeIdeas.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">文章の作り方</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" value="ai" checked={mode === "ai"} onChange={() => setMode("ai")} />
            AI が店舗ごとに作成
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" value="template" checked={mode === "template"} onChange={() => setMode("template")} />
            テンプレートに店舗リストを差し込む
          </label>
        </div>
        {mode === "ai" ? (
          <label className="block text-sm font-medium">
            補足（AI への指示：伝えたい内容・期間・条件など）
            <textarea name="memo" defaultValue={d.memo} rows={3} className={input} />
          </label>
        ) : (
          <>
            <input type="hidden" name="memo" value={d.memo} />
            <TemplateEditor stores={stores} customKeys={customKeys} defaultGbp={d.gbpTemplate} defaultIg={d.igTemplate} />
          </>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">画像・動画</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            ["image", "画像（GBP・Instagram フィード）"],
            ["reel", "リール動画（Instagram）＋表紙画像（GBP）"],
            ["none", "作らない（店舗の写真をそのまま使う）"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="mediaType" value={v} checked={mediaType === v} onChange={() => setMediaType(v)} />
              {l}
            </label>
          ))}
        </div>
        {mediaType !== "none" && (
          <>
            <label className="block text-sm font-medium">
              画像に入れる見出し（空欄ならテーマ）
              <input name="headline" defaultValue={d.headline} maxLength={48} className={input} />
            </label>
            <label className="block text-sm font-medium">
              AI 背景画像の指示（任意。例：朝日が差し込む明るい施術室、ストレッチする女性の後ろ姿）
              <input name="bgPrompt" defaultValue={d.bgPrompt} className={input} />
            </label>
          </>
        )}
      </fieldset>
    </div>
  );
}
