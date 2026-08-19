import type { Metadata } from 'next';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hadya Group',
  icons: { icon: '/uploads/emb_gold.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
