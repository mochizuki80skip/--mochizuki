import QRCode from "qrcode";

type Props = {
  /** Absolute or path-only URL to encode. */
  url: string;
  size?: number;
};

/**
 * Server-rendered QR as a base64 PNG data URL embedded in <img>. Server-side
 * generation means it ships in the initial HTML (printable, screenshot-able)
 * with none of the inline-SVG sizing pitfalls.
 */
export default async function PatientQRCode({ url, size = 168 }: Props) {
  let dataUrl: string | null = null;
  try {
    dataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      // Render at 2x for retina, then downscale via CSS.
      width: size * 2,
      color: { dark: "#0F1115", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
  } catch {
    dataUrl = null;
  }

  if (!dataUrl) {
    return (
      <div
        className="inline-flex items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2"
        style={{ width: size, height: size }}
      >
        QRの生成に失敗しました
      </div>
    );
  }

  return (
    <div className="inline-block rounded-lg bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="患者マイページ ログインQR"
        width={size}
        height={size}
        className="block"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
