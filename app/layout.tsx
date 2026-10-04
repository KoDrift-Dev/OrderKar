import type { Metadata, Viewport } from 'next';
import { Poppins, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'OrderKar — Restaurant chalana ab aasaan',
  description:
    'OrderKar is multi-tenant SaaS for Pakistani restaurants: QR table ordering, live kitchen display, waiter app, and owner analytics — one platform, every restaurant.',
};

export const viewport: Viewport = {
  themeColor: '#F9FAFB',
};

// Runs before paint: restores the saved theme (or OS preference) with no flash.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('orderkar_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
