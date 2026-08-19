'use client';

import { useAdmin } from '@/components/admin/AdminProvider';
import { Field } from '@/components/admin/Fields';
import { Card, CardTitle, Muted, Row, Toggle } from '@/components/admin/ui';
import { LOCALES } from '@/lib/types';
import type { FieldDef, Locale } from '@/lib/types';

const T = (name: string, label: string, type: FieldDef['type'] = 'text', extra: Partial<FieldDef> = {}): FieldDef =>
  ({ name, label, type, ...extra });

export default function SettingsPage() {
  const { doc, loading, update } = useAdmin();
  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;
  const s = doc.settings;

  const setS = (k: string) => (v: any) => update((d) => { (d.settings as any)[k] = v; });
  const setTok = (k: string) => (v: any) => update((d) => { (d.settings.tokens as any)[k] = v; });
  const setGrp = (grp: string, k: string) => (v: any) =>
    update((d) => { (d.settings as any)[grp][k] = v; });

  return (
    <div className="max-w-[760px] p-[22px]">
      <h2 className="mb-1 text-[17px] font-medium">Site settings</h2>
      <Muted>
        These apply everywhere. Section-level design overrides always win over the tokens below.
      </Muted>

      <Card>
        <CardTitle>Brand</CardTitle>
        <Field def={T('brandName', 'Brand name')} value={s.brandName} onChange={setS('brandName')} />
        <Field def={T('brandTagline', 'Tagline / default meta description', 'textarea')} value={s.brandTagline} onChange={setS('brandTagline')} />
        <Row>
          <Field def={T('logoLight', 'Logo on dark backgrounds', 'image')} value={s.logoLight} onChange={setS('logoLight')} />
          <Field def={T('logoDark', 'Logo on light backgrounds', 'image')} value={s.logoDark} onChange={setS('logoDark')} />
        </Row>
        <Field def={T('favicon', 'Favicon', 'image')} value={s.favicon} onChange={setS('favicon')} />
      </Card>

      <Card>
        <CardTitle>Design tokens</CardTitle>
        <Row>
          <Field def={T('cream', 'Page background', 'color')} value={s.tokens.cream} onChange={setTok('cream')} />
          <Field def={T('creamAlt', 'Alternate background', 'color')} value={s.tokens.creamAlt} onChange={setTok('creamAlt')} />
        </Row>
        <Row>
          <Field def={T('ink', 'Heading colour', 'color')} value={s.tokens.ink} onChange={setTok('ink')} />
          <Field def={T('inkSoft', 'Body text colour', 'color')} value={s.tokens.inkSoft} onChange={setTok('inkSoft')} />
        </Row>
        <Row>
          <Field def={T('gold', 'Accent (on light)', 'color')} value={s.tokens.gold} onChange={setTok('gold')} />
          <Field def={T('goldSoft', 'Accent (on dark)', 'color')} value={s.tokens.goldSoft} onChange={setTok('goldSoft')} />
        </Row>
        <Row>
          <Field def={T('navy', 'Dark section background', 'color')} value={s.tokens.navy} onChange={setTok('navy')} />
          <Field def={T('line', 'Hairline colour', 'color')} value={s.tokens.line} onChange={setTok('line')} />
        </Row>
        <Field def={T('serifFamily', 'Serif font stack')} value={s.tokens.serifFamily} onChange={setTok('serifFamily')} />
        <Field def={T('sansFamily', 'Sans font stack')} value={s.tokens.sansFamily} onChange={setTok('sansFamily')} />
        <Field def={T('arabicSerifFamily', 'Arabic serif stack')} value={s.tokens.arabicSerifFamily} onChange={setTok('arabicSerifFamily')} />
        <Field def={T('arabicSansFamily', 'Arabic sans stack')} value={s.tokens.arabicSansFamily} onChange={setTok('arabicSansFamily')} />
        <Row>
          <Field def={T('baseFontSize', 'Base font size (px)', 'number', { min: 13, max: 22 })} value={s.tokens.baseFontSize} onChange={setTok('baseFontSize')} />
          <Field def={T('contentWidth', 'Content width (px)', 'number', { min: 900, max: 1800, step: 10 })} value={s.tokens.contentWidth} onChange={setTok('contentWidth')} />
        </Row>
        <Field def={T('radius', 'Default corner radius (px)', 'number', { min: 0, max: 30 })} value={s.tokens.radius} onChange={setTok('radius')} />
      </Card>

      <Card>
        <CardTitle>Header</CardTitle>
        <Row>
          <Field def={T('sticky', 'Stick to top on scroll', 'boolean')} value={s.header.sticky} onChange={setGrp('header', 'sticky')} />
          <Field def={T('transparentOnHero', 'Transparent over hero', 'boolean')} value={s.header.transparentOnHero} onChange={setGrp('header', 'transparentOnHero')} />
        </Row>
        <Row>
          <Field def={T('ctaLabel', 'Header button label')} value={s.header.ctaLabel} onChange={setGrp('header', 'ctaLabel')} />
          <Field def={T('ctaHref', 'Header button link', 'url')} value={s.header.ctaHref} onChange={setGrp('header', 'ctaHref')} />
        </Row>
        <Field
          def={{
            name: 'navExtra', label: 'Extra menu links (beyond pages)', type: 'array', itemLabel: 'Link',
            fields: [
              T('label', 'Label', 'text', { half: true }),
              T('href', 'URL', 'url', { half: true }),
              T('external', 'Opens in new tab', 'boolean', { half: true }),
            ],
          }}
          value={s.navExtra}
          onChange={(v) => update((d) => {
            d.settings.navExtra = v.map((x: any, i: number) => ({ ...x, id: x.id || `nx_${i}` }));
          })}
        />
      </Card>

      <Card>
        <CardTitle>Footer</CardTitle>
        <Field def={T('copy', 'Copyright line (HTML allowed)', 'html')} value={s.footer.copy} onChange={setGrp('footer', 'copy')} />
        <Field def={T('showBrand', 'Show brand mark', 'boolean')} value={s.footer.showBrand} onChange={setGrp('footer', 'showBrand')} />
        <Field
          def={{
            name: 'links', label: 'Footer links', type: 'array', itemLabel: 'Link',
            fields: [
              T('label', 'Label', 'text', { half: true }),
              T('href', 'URL', 'url', { half: true }),
              T('external', 'Opens in new tab', 'boolean', { half: true }),
            ],
          }}
          value={s.footer.links}
          onChange={(v) => update((d) => {
            d.settings.footer.links = v.map((x: any, i: number) => ({ ...x, id: x.id || `fl_${i}` }));
          })}
        />
      </Card>

      <Card>
        <CardTitle>Analytics</CardTitle>
        <Field
          def={T('gtmId', 'Google Tag Manager container ID', 'text', {
            help: 'Looks like GTM-XXXXXXX. Leave blank to load no tracking scripts at all.',
          })}
          value={s.analytics?.gtmId}
          onChange={(v) => update((d) => {
            d.settings.analytics = { ...(d.settings.analytics || {}), gtmId: String(v).trim() };
          })}
        />
        <Field
          def={T('ga4MeasurementId', 'GA4 measurement ID (optional)', 'text', {
            help: 'Looks like G-XXXXXXXXXX. Only needed if you tag GA4 directly rather than through GTM.',
          })}
          value={s.analytics?.ga4MeasurementId}
          onChange={(v) => update((d) => {
            d.settings.analytics = { ...(d.settings.analytics || {}), ga4MeasurementId: String(v).trim() };
          })}
        />
        <Muted>
          Setting a container starts data collection immediately. The Analytics screen
          keeps showing sample figures until a GA4 reader is connected — collection and
          reporting are two separate steps.
        </Muted>
      </Card>

      <Card>
        <CardTitle>Languages</CardTitle>
        <Muted className="mb-3.5">
          English is always on and is never prefixed. Another language is served under its own path
          prefix — Arabic pages live at <code className="font-mono text-[11px]">/ar/…</code> — and
          falls back to English for anything not yet translated. Translate under{' '}
          <strong>Translation</strong>.
        </Muted>
        {LOCALES.filter((l) => l.code !== 'en').map((l) => {
          const enabled = (s.locales?.enabled || ['en']).includes(l.code);
          return (
            <div key={l.code} className="flex items-center justify-between gap-3 py-2">
              <div>
                <strong className="block text-[12.5px]">
                  {l.label} <span className="text-dim">({l.nativeLabel})</span>
                </strong>
                <Muted>
                  {l.dir === 'rtl' ? 'Right-to-left. The layout mirrors automatically.' : ''}
                </Muted>
              </div>
              <Toggle
                label={`Enable ${l.label}`}
                checked={enabled}
                onChange={(v) =>
                  update((d) => {
                    const list = new Set<Locale>(d.settings.locales?.enabled || ['en']);
                    if (v) list.add(l.code);
                    else list.delete(l.code);
                    list.add('en');
                    d.settings.locales = {
                      enabled: Array.from(list).sort((a) => (a === 'en' ? -1 : 1)),
                      showSwitch: d.settings.locales?.showSwitch ?? true,
                    };
                  })
                }
              />
            </div>
          );
        })}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-edge pt-3">
          <div>
            <strong className="block text-[12.5px]">Show the language switch in the header</strong>
            <Muted>Only appears when more than one language is on.</Muted>
          </div>
          <Toggle
            label="Show language switch"
            checked={s.locales?.showSwitch !== false}
            onChange={(v) =>
              update((d) => {
                d.settings.locales = {
                  enabled: d.settings.locales?.enabled || ['en'],
                  showSwitch: v,
                };
              })
            }
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Cookie consent</CardTitle>
        <Muted className="mb-3.5">
          When on, Google Tag Manager does not load at all until a visitor chooses. Turning this off
          means tracking starts on page load, which under PDPL you should not do without advice.
        </Muted>
        <div className="flex items-center justify-between gap-3 py-2">
          <strong className="text-[12.5px]">Show the consent banner</strong>
          <Toggle
            label="Show consent banner"
            checked={!!s.consent?.enabled}
            onChange={(v) =>
              update((d) => {
                d.settings.consent = { ...(d.settings.consent as any), enabled: v };
              })
            }
          />
        </div>
        <Row>
          <Field def={T('title', 'Banner heading')} value={s.consent?.title}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), title: v }; })} />
          <Field def={T('titleAr', 'Banner heading — Arabic')} value={s.consent?.titleAr}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), titleAr: v }; })} />
        </Row>
        <Field def={T('body', 'Banner text', 'textarea')} value={s.consent?.body}
          onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), body: v }; })} />
        <Field def={T('bodyAr', 'Banner text — Arabic', 'textarea')} value={s.consent?.bodyAr}
          onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), bodyAr: v }; })} />
        <Row>
          <Field def={T('acceptLabel', 'Accept button')} value={s.consent?.acceptLabel}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), acceptLabel: v }; })} />
          <Field def={T('rejectLabel', 'Decline button')} value={s.consent?.rejectLabel}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), rejectLabel: v }; })} />
        </Row>
        <Row>
          <Field def={T('policyLabel', 'Privacy link label')} value={s.consent?.policyLabel}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), policyLabel: v }; })} />
          <Field def={T('policyHref', 'Privacy policy URL', 'url')} value={s.consent?.policyHref}
            onChange={(v) => update((d) => { d.settings.consent = { ...(d.settings.consent as any), policyHref: v }; })} />
        </Row>
      </Card>

      <Card>
        <CardTitle>Form notifications</CardTitle>
        <Muted className="mb-3.5">
          Emails every new submission. Needs MAIL_FROM configured on the server — check{' '}
          <strong>System status</strong>. Submissions are stored either way.
        </Muted>
        <div className="flex items-center justify-between gap-3 py-2">
          <strong className="text-[12.5px]">Email new submissions</strong>
          <Toggle
            label="Email new submissions"
            checked={!!s.notifications?.enabled}
            onChange={(v) =>
              update((d) => {
                d.settings.notifications = {
                  leadRecipients: d.settings.notifications?.leadRecipients || [],
                  ...(d.settings.notifications as any),
                  enabled: v,
                };
              })
            }
          />
        </div>
        <Field
          def={T('leadRecipients', 'Send to', 'text', {
            help: 'Comma-separated. Individual forms can add their own recipients on top of these.',
          })}
          value={(s.notifications?.leadRecipients || []).join(', ')}
          onChange={(v) =>
            update((d) => {
              d.settings.notifications = {
                enabled: d.settings.notifications?.enabled ?? false,
                ...(d.settings.notifications as any),
                leadRecipients: String(v)
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              };
            })
          }
        />
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <strong className="block text-[12.5px]">Also confirm to the person who submitted</strong>
            <Muted>Sends them a copy of their message in their own language.</Muted>
          </div>
          <Toggle
            label="Confirm to submitter"
            checked={!!s.notifications?.confirmToSubmitter}
            onChange={(v) =>
              update((d) => {
                d.settings.notifications = {
                  enabled: d.settings.notifications?.enabled ?? false,
                  leadRecipients: d.settings.notifications?.leadRecipients || [],
                  confirmToSubmitter: v,
                };
              })
            }
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Intro splash</CardTitle>
        <Row>
          <Field def={T('enabled', 'Show splash on first visit', 'boolean')} value={s.splash.enabled} onChange={setGrp('splash', 'enabled')} />
          <Field def={T('durationMs', 'Duration (ms)', 'number', { min: 600, max: 5000, step: 100 })} value={s.splash.durationMs} onChange={setGrp('splash', 'durationMs')} />
        </Row>
        <Row>
          <Field def={T('word', 'Word')} value={s.splash.word} onChange={setGrp('splash', 'word')} />
          <Field def={T('sub', 'Sub-line')} value={s.splash.sub} onChange={setGrp('splash', 'sub')} />
        </Row>
      </Card>
    </div>
  );
}
