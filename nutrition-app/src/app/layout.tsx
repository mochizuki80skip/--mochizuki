import type { Metadata, Viewport } from 'next';
import './globals.css';

// v: 全機能反映トリガー（アイコン+チラつき修正+写真ヒント+parse_fail修正+高速化）

export const metadata: Metadata = {
  title: "ONE'S BODY 食事管理サポート",
  description: "ONE'S BODYパーソナルジム会員向け食事・体組成サポートアプリ",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/app-icon.jpg', type: 'image/jpeg', sizes: '1254x1254' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/app-icon.jpg', sizes: '180x180' },
      { url: '/app-icon.jpg', sizes: '152x152' },
      { url: '/app-icon.jpg', sizes: '120x120' }
    ],
    shortcut: '/app-icon.jpg'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "食事管理サポート",
    startupImage: '/app-icon.jpg'
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
