import 'server-only';

/* ══════════════════════════════════════════════════════════════════
   SAMPLE ANALYTICS — NOT REAL DATA.

   This file fabricates every number it returns. It exists so the
   analytics screen can be designed, demoed and reviewed before a real
   GA4 / Google Ads connection exists.

   Three rules keep it from ever being mistaken for reality:

   1. Everything is derived from a fixed seed, so the numbers are stable
      across reloads. Data that reshuffles on every refresh looks broken;
      data that is stable looks real, which is why rule 2 exists.
   2. `isSample: true` rides along with every payload, and the UI is
      required to render the sample banner whenever it is set.
   3. It is only reachable while ANALYTICS_MODE is 'sample'. Point the
      app at a real source and this module is never called.

   When you connect GA4, replace `getAnalytics()` in analytics.ts. Do not
   edit this file to "make the numbers more realistic" — that is the road
   to someone pasting fabricated figures into a board deck.
   ══════════════════════════════════════════════════════════════════ */

export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous: number;
  format: 'int' | 'pct' | 'duration' | 'currency';
  hint: string;
}

export interface SeriesPoint {
  date: string;
  sessions: number;
  users: number;
  leads: number;
  spend: number;
}

export interface Channel {
  name: string;
  sessions: number;
  leads: number;
  spend: number;
  cpl: number | null;
}

export interface PageRow {
  path: string;
  title: string;
  views: number;
  avgSeconds: number;
  exitRate: number;
}

export interface EventRow {
  name: string;
  category: string;
  count: number;
  users: number;
}

export interface CampaignRow {
  name: string;
  source: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  leads: number;
  cpl: number;
}

export interface DeviceRow { name: string; sessions: number; share: number }
export interface GeoRow { city: string; sessions: number; leads: number }

export interface AnalyticsPayload {
  isSample: boolean;
  generatedAt: string;
  rangeDays: number;
  kpis: Kpi[];
  series: SeriesPoint[];
  channels: Channel[];
  pages: PageRow[];
  events: EventRow[];
  campaigns: CampaignRow[];
  devices: DeviceRow[];
  geo: GeoRow[];
}

/* ---- deterministic pseudo-random: same input, same output, always ---- */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Weekday traffic is roughly double the weekend in B2B property. */
function weekdayWeight(d: Date) {
  const day = d.getUTCDay();
  if (day === 5) return 0.72;       // Friday — weekend in KSA
  if (day === 6) return 0.68;       // Saturday
  return 1;
}

export function buildSampleAnalytics(rangeDays = 30): AnalyticsPayload {
  const r = rng(20260726 + rangeDays);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const series: SeriesPoint[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const base = 210 + (rangeDays - i) * 1.6;      // slow upward trend
    const noise = 0.82 + r() * 0.36;
    const sessions = Math.round(base * weekdayWeight(d) * noise);
    const users = Math.round(sessions * (0.78 + r() * 0.07));
    const leads = Math.max(0, Math.round(sessions * (0.012 + r() * 0.014)));
    const spend = Math.round((90 + r() * 130) * weekdayWeight(d));
    series.push({ date: dayKey(d), sessions, users, leads, spend });
  }

  const half = Math.floor(series.length / 2);
  const sum = (rows: SeriesPoint[], k: keyof SeriesPoint) =>
    rows.reduce((a, b) => a + (b[k] as number), 0);

  const cur = series.slice(half);
  const prev = series.slice(0, half);

  const sessionsNow = sum(cur, 'sessions');
  const sessionsPrev = sum(prev, 'sessions');
  const leadsNow = sum(cur, 'leads');
  const leadsPrev = sum(prev, 'leads');
  const spendNow = sum(cur, 'spend');
  const spendPrev = sum(prev, 'spend');

  const kpis: Kpi[] = [
    { key: 'sessions', label: 'Sessions', value: sessionsNow, previous: sessionsPrev, format: 'int',
      hint: 'Visits to the site. One person browsing twice in a day is two sessions.' },
    { key: 'users', label: 'Users', value: sum(cur, 'users'), previous: sum(prev, 'users'), format: 'int',
      hint: 'Distinct people, counted by browser. Someone on phone and laptop counts twice.' },
    { key: 'leads', label: 'Form submissions', value: leadsNow, previous: leadsPrev, format: 'int',
      hint: 'Contact form completions. These are the rows on the Submissions screen.' },
    { key: 'convRate', label: 'Conversion rate', value: (leadsNow / sessionsNow) * 100,
      previous: (leadsPrev / sessionsPrev) * 100, format: 'pct',
      hint: 'Share of sessions that submitted a form. 1–3% is normal for corporate sites.' },
    { key: 'avgDuration', label: 'Avg. session', value: 96 + Math.round(r() * 40),
      previous: 88 + Math.round(r() * 40), format: 'duration',
      hint: 'How long a visit lasts. Under 30 seconds usually means the page did not match intent.' },
    { key: 'bounce', label: 'Bounce rate', value: 42 + r() * 8, previous: 46 + r() * 8, format: 'pct',
      hint: 'Sessions with a single page and no interaction. Lower is better.' },
    { key: 'spend', label: 'Ad spend', value: spendNow, previous: spendPrev, format: 'currency',
      hint: 'Paid media cost over the period, from the ads platform.' },
    { key: 'cpl', label: 'Cost per lead', value: spendNow / Math.max(1, leadsNow),
      previous: spendPrev / Math.max(1, leadsPrev), format: 'currency',
      hint: 'Ad spend divided by form submissions. The number the budget conversation turns on.' },
  ];

  const channelDefs: [string, number, number, number][] = [
    ['Organic search', 0.34, 0.30, 0],
    ['Paid search',    0.24, 0.31, 0.62],
    ['Direct',         0.19, 0.16, 0],
    ['Paid social',    0.11, 0.12, 0.38],
    ['Referral',       0.07, 0.07, 0],
    ['Organic social', 0.05, 0.04, 0],
  ];
  const totalSessions = sum(series, 'sessions');
  const totalLeads = sum(series, 'leads');
  const totalSpend = sum(series, 'spend');

  const channels: Channel[] = channelDefs.map(([name, sShare, lShare, spShare]) => {
    const sessions = Math.round(totalSessions * sShare);
    const leads = Math.round(totalLeads * lShare);
    const spend = Math.round(totalSpend * spShare);
    return { name, sessions, leads, spend, cpl: spend > 0 && leads > 0 ? spend / leads : null };
  });

  const pages: PageRow[] = [
    { path: '/', title: 'Home', views: Math.round(totalSessions * 0.71), avgSeconds: 74, exitRate: 31.4 },
    { path: '/portfolio', title: 'Portfolio', views: Math.round(totalSessions * 0.38), avgSeconds: 132, exitRate: 24.8 },
    { path: '/about-us', title: 'About Us', views: Math.round(totalSessions * 0.26), avgSeconds: 98, exitRate: 38.2 },
    { path: '/contact-us', title: 'Contact Us', views: Math.round(totalSessions * 0.21), avgSeconds: 152, exitRate: 46.9 },
    { path: '/sectors', title: 'Sectors', views: Math.round(totalSessions * 0.18), avgSeconds: 88, exitRate: 35.1 },
    { path: '/legacy', title: 'Legacy', views: Math.round(totalSessions * 0.14), avgSeconds: 106, exitRate: 41.7 },
    { path: '/careers', title: 'Careers', views: Math.round(totalSessions * 0.12), avgSeconds: 64, exitRate: 58.3 },
    { path: '/news', title: 'News', views: Math.round(totalSessions * 0.09), avgSeconds: 51, exitRate: 62.0 },
  ];

  const events: EventRow[] = [
    { name: 'page_view', category: 'Automatic', count: Math.round(totalSessions * 2.4), users: Math.round(totalSessions * 0.79) },
    { name: 'scroll_90', category: 'Engagement', count: Math.round(totalSessions * 0.42), users: Math.round(totalSessions * 0.34) },
    { name: 'cta_click', category: 'Engagement', count: Math.round(totalSessions * 0.19), users: Math.round(totalSessions * 0.16) },
    { name: 'project_card_click', category: 'Engagement', count: Math.round(totalSessions * 0.14), users: Math.round(totalSessions * 0.11) },
    { name: 'form_start', category: 'Conversion', count: Math.round(totalLeads * 3.1), users: Math.round(totalLeads * 2.7) },
    { name: 'form_submit', category: 'Conversion', count: totalLeads, users: Math.round(totalLeads * 0.96) },
    { name: 'tel_click', category: 'Conversion', count: Math.round(totalLeads * 0.8), users: Math.round(totalLeads * 0.72) },
    { name: 'email_click', category: 'Conversion', count: Math.round(totalLeads * 0.6), users: Math.round(totalLeads * 0.55) },
    { name: 'file_download', category: 'Engagement', count: Math.round(totalSessions * 0.05), users: Math.round(totalSessions * 0.04) },
  ];

  const campaignDefs: [string, string, number, number][] = [
    ['Brand — Hadya',              'Google Ads',   0.20, 0.055],
    ['Residential — Diyar Hadya',  'Google Ads',   0.28, 0.031],
    ['Commercial — Jameel Square', 'Google Ads',   0.19, 0.028],
    ['Hospitality — Mövenpick',    'Meta Ads',     0.18, 0.014],
    ['Retargeting — All visitors', 'Meta Ads',     0.09, 0.022],
    ['Careers — Talent',           'LinkedIn Ads', 0.06, 0.009],
  ];
  const totalImpressions = Math.round(totalSessions * 34);
  const campaigns: CampaignRow[] = campaignDefs.map(([name, source, share, ctr]) => {
    const impressions = Math.round(totalImpressions * share);
    const clicks = Math.round(impressions * ctr);
    const spend = Math.round(totalSpend * share * (source === 'Google Ads' ? 1.15 : 0.75));
    const leads = Math.max(1, Math.round(clicks * (0.018 + r() * 0.02)));
    return {
      name, source, impressions, clicks,
      ctr: (clicks / impressions) * 100,
      cpc: spend / Math.max(1, clicks),
      spend, leads,
      cpl: spend / leads,
    };
  });

  const devices: DeviceRow[] = [
    { name: 'Mobile', sessions: Math.round(totalSessions * 0.61), share: 61 },
    { name: 'Desktop', sessions: Math.round(totalSessions * 0.33), share: 33 },
    { name: 'Tablet', sessions: Math.round(totalSessions * 0.06), share: 6 },
  ];

  const geoDefs: [string, number, number][] = [
    ['Jeddah', 0.41, 0.46], ['Riyadh', 0.23, 0.21], ['Makkah', 0.09, 0.08],
    ['Dammam', 0.07, 0.06], ['Madinah', 0.05, 0.05], ['Dubai', 0.05, 0.06],
    ['Other', 0.10, 0.08],
  ];
  const geo: GeoRow[] = geoDefs.map(([city, s, l]) => ({
    city,
    sessions: Math.round(totalSessions * s),
    leads: Math.round(totalLeads * l),
  }));

  return {
    isSample: true,
    generatedAt: new Date().toISOString(),
    rangeDays,
    kpis, series, channels, pages, events, campaigns, devices, geo,
  };
}
