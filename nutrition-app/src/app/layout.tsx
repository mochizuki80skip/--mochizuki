import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "ONE'S MEAL | ONE'S BODY 食事管理",
  description: "ONE'S BODYパーソナルジムの食事・体組成管理アプリ",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "ONE'S MEAL"
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
