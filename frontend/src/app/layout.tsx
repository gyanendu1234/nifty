import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nifty Market Cap Ladder | Indian Stock Market Trends',
  description:
    'Track companies entering and exiting Large Cap, Mid Cap, and Small Cap categories using SEBI half-yearly categorisation data. Market-cap ladder movement trends for Indian equities.',
  keywords: ['Nifty', 'Large Cap', 'Mid Cap', 'Small Cap', 'Indian stocks', 'market cap ladder'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
