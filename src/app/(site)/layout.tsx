import { readContent } from '@/lib/store';
import { tokensToCss } from '@/lib/style';
import Splash from '@/components/Splash';
import GoogleTagManager from '@/components/GoogleTagManager';
import ClickTracker from '@/components/ClickTracker';
import CookieConsent from '@/components/CookieConsent';

export const dynamic = 'force-dynamic';

/* The wrapper carries the site-wide design tokens as inline custom
   properties. Everything below it — header, sections, footer — reads its
   colours and fonts from these, which is how a settings change restyles
   the whole site without a rebuild. */

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await readContent();
  return (
    <div
      style={tokensToCss(settings)}
      className="min-h-screen bg-brand-cream font-sans text-brand-ink-soft"
    >
      {/* GTM holds itself back until consent exists — see the component.
          When the banner is switched off there is nothing to wait for, so it
          loads immediately. */}
      <GoogleTagManager
        id={settings.analytics?.gtmId || process.env.NEXT_PUBLIC_GTM_ID}
        requireConsent={settings.consent?.enabled !== false}
      />
      <ClickTracker />
      {settings.splash?.enabled && <Splash settings={settings} />}
      {children}
      <CookieConsent settings={settings} />
    </div>
  );
}
