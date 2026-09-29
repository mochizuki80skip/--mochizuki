import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

// ---------- 保存 ----------
// 生成した画像・動画はサーバーのディスクに保存し /media/... で公開する。
// Instagram / GBP は公開 URL から画像を取りに来るため、PUBLIC_BASE_URL は https の本番 URL にする。
export const mediaDir = () => path.resolve(process.env.MEDIA_DIR ?? "./storage/media");
const publicBase = () => (process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

export async function saveMedia(buf: Buffer, ext: "jpg" | "png" | "mp4") {
  const month = new Date().toISOString().slice(0, 7);
  const name = `${month}/${randomUUID()}.${ext}`;
  await mkdir(path.join(mediaDir(), month), { recursive: true });
  await writeFile(path.join(mediaDir(), name), buf);
  return `${publicBase()}/media/${name}`;
}

// 自前の /media/ URL ならディスクから、それ以外はダウンロードして読む
export async function loadImage(url: string): Promise<Buffer> {
  const base = `${publicBase()}/media/`;
  if (url.startsWith(base)) {
    const rel = path.normalize(url.slice(base.length));
    if (rel.startsWith("..")) throw new Error("invalid media path");
    return readFile(path.join(mediaDir(), rel));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像を取得できません（${res.status}）：${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- AI 背景画像（Gemini の画像生成） ----------
export async function generateBackground(prompt: string, aspectRatio: "4:5" | "9:16" | "1:1" = "4:5") {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY が設定されていません");
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\n条件：SNS 投稿の背景に使う写真風の画像。文字・ロゴ・透かしは入れない。人物の顔ははっきり写さない。医療行為を誇張する表現は避け、明るく清潔感のある雰囲気。`,
            },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`画像生成 ${res.status}: ${json.error?.message ?? "unknown"}`);
  const part = json.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!part) throw new Error("画像が生成されませんでした（内容を変えて再度お試しください）");
  const jpg = await sharp(Buffer.from(part.inlineData.data, "base64")).jpeg({ quality: 90 }).toBuffer();
  return saveMedia(jpg, "jpg");
}

// ---------- 文字入れ ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

// 日本語を指定文字数で折り返す（句読点で行頭にならないよう軽く調整）
export function wrap(text: string, perLine: number, maxLines: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let rest = para.trim();
    while (rest.length) {
      let cut = Math.min(perLine, rest.length);
      if (/^[、。」』）!！?？ー]/.test(rest.slice(cut))) cut++;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
  }
  return lines;
}

const FONT = `'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans','WenQuanYi Zen Hei',sans-serif`;

function textBlock(lines: string[], x: number, y: number, size: number, weight = 700, fill = "#fff", anchor = "start") {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * size * 1.3}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(l)}</text>`,
    )
    .join("");
}

type Canvas = { w: number; h: number };
export const FEED: Canvas = { w: 1080, h: 1350 }; // Instagram フィード（4:5）・GBP 兼用
export const REEL: Canvas = { w: 1080, h: 1920 }; // リール（9:16）

async function baseLayer(c: Canvas, bg: Buffer | null, color: string, dim = 0) {
  const img = bg
    ? sharp(bg).resize(c.w, c.h, { fit: "cover" })
    : sharp({ create: { width: c.w, height: c.h, channels: 3, background: color } });
  const buf = await img.jpeg().toBuffer();
  return dim ? sharp(buf).modulate({ brightness: 1 - dim }).blur(dim > 0.3 ? 12 : 0.3).jpeg().toBuffer() : buf;
}

// 見出し＋店舗名の帯を入れた画像（店舗ごとに院名・エリアだけ変わる）
export async function renderPostImage(args: {
  canvas?: Canvas;
  bg: Buffer | null;
  headline: string;
  storeName: string;
  storeArea: string;
  color: string;
}) {
  const c = args.canvas ?? FEED;
  const base = await baseLayer(c, args.bg, args.color);
  const size = Math.round(c.w / 14);
  const lines = wrap(args.headline, Math.floor((c.w - 140) / size), 4);
  const blockH = lines.length * size * 1.3;
  const bandH = Math.round(c.h * 0.13);
  const top = c.h - bandH - blockH - 90;
  const svg = `<svg width="${c.w}" height="${c.h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/>
    </linearGradient></defs>
    <rect x="0" y="${top - 160}" width="${c.w}" height="${c.h - top + 160}" fill="url(#g)"/>
    ${textBlock(lines, 70, top + size, size)}
    <rect x="0" y="${c.h - bandH}" width="${c.w}" height="${bandH}" fill="${esc(args.color)}"/>
    ${textBlock([args.storeName], 70, c.h - bandH / 2 - 4, Math.round(bandH * 0.32))}
    ${args.storeArea ? textBlock([args.storeArea], 70, c.h - bandH / 2 + bandH * 0.3, Math.round(bandH * 0.2), 400) : ""}
  </svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88 }).toBuffer();
}

// ---------- リール動画 ----------
// 3 枚のスライド（見出し → 本文の要点 → 院名・予約案内）を 4 秒ずつつないだ 12 秒の縦動画
export async function renderReel(args: {
  bg: Buffer | null;
  headline: string;
  point: string;
  storeName: string;
  storeArea: string;
  color: string;
}) {
  const s1 = await renderPostImage({ ...args, canvas: REEL });

  const size = 72;
  const p = wrap(args.point, Math.floor((REEL.w - 160) / size), 7);
  const s2base = await baseLayer(REEL, args.bg, args.color, 0.55);
  const s2 = await sharp(s2base)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${REEL.w}" height="${REEL.h}" xmlns="http://www.w3.org/2000/svg">${textBlock(p, REEL.w / 2, REEL.h / 2 - (p.length * size * 1.3) / 2 + size, size, 700, "#fff", "middle")}</svg>`,
        ),
      },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();

  const s3 = await sharp({ create: { width: REEL.w, height: REEL.h, channels: 3, background: args.color } })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${REEL.w}" height="${REEL.h}" xmlns="http://www.w3.org/2000/svg">
            ${textBlock([args.storeName], REEL.w / 2, 800, Math.max(52, Math.min(88, Math.floor(960 / args.storeName.length))), 700, "#fff", "middle")}
            ${args.storeArea ? textBlock([args.storeArea], REEL.w / 2, 1010, 52, 400, "#fff", "middle") : ""}
            ${textBlock(["ご予約はプロフィールの", "リンクから"], REEL.w / 2, 1240, 56, 700, "#fff", "middle")}
          </svg>`,
        ),
      },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();

  const dir = path.join(tmpdir(), `reel-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    const files = [s1, s2, s3].map((_, i) => path.join(dir, `s${i}.jpg`));
    await Promise.all([s1, s2, s3].map((b, i) => writeFile(files[i], b)));
    const out = path.join(dir, "out.mp4");
    const D = 4;
    const inputs = files.flatMap((f) => ["-loop", "1", "-t", String(D), "-i", f]);
    const filters = files
      .map(
        (_, i) =>
          `[${i}:v]scale=${REEL.w}:${REEL.h},setsar=1,fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=${D - 0.4}:d=0.4[v${i}]`,
      )
      .join(";");
    await run(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      [
        "-y",
        ...inputs,
        "-f", "lavfi", "-t", String(D * files.length), "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", `${filters};${files.map((_, i) => `[v${i}]`).join("")}concat=n=${files.length}:v=1:a=0,format=yuv420p[v]`,
        "-map", "[v]", "-map", `${files.length}:a`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-shortest", "-movflags", "+faststart",
        out,
      ],
      { timeout: 120_000 },
    );
    return { video: await readFile(out), cover: s1 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
