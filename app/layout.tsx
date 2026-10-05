import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LOGO_DATA_URL } from '@/lib/logo';

// NOTE: fonts load at runtime via <link> below (not next/font/google),
// so Vercel builds never depend on fetching Google Fonts at build time.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap';

export const metadata: Metadata = {
  title: 'OrderKar — Restaurant chalana ab aasaan',
  description:
    'OrderKar is multi-tenant SaaS for Pakistani restaurants: QR table ordering, live kitchen display, waiter app, and owner analytics — one platform, every restaurant.',
  icons: { icon: LOGO_DATA_URL },
};

export const viewport: Viewport = {
  themeColor: '#F9FAFB',
};

// Runs before paint: restores the saved theme (default: light) with no flash.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('orderkar_theme');if(!t){t='light'}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_HREF} rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
