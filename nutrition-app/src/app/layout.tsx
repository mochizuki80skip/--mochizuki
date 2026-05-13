import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "ONE'S BODY 食事管理サポート",
  description: "ONE'S BODYパーソナルジム会員向け食事・体組成サポートアプリ",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "食事管理サポート"
  }
};

export const viewport: Viewport = {
  themeColor: '#FF5F3D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
