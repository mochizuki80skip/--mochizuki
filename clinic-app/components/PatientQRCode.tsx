import QRCode from "qrcode";

type Props = {
  /** Absolute or path-only URL to encode. */
  url: string;
  size?: number;
};

/**
 * Server-rendered QR code as inline SVG. We avoid client-side libs so the
 * code stays in the initial HTML and is printable / screenshot-friendly.
 */
export default async function PatientQRCode({ url, size = 168 }: Props) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#0F1115", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  // The library returns a complete <svg>; strip the fixed dims so we can
  // resize via CSS, and let viewBox handle aspect.
  const sized = svg
    .replace(/width="[^"]+"/, `width="${size}"`)
    .replace(/height="[^"]+"/, `height="${size}"`);

  return (
    <div
      className="inline-block rounded-lg bg-white p-2"
      // dangerouslySetInnerHTML is safe here: we generated the SVG ourselves
      // from a URL we control.
      dangerouslySetInnerHTML={{ __html: sized }}
    />
  );
}
