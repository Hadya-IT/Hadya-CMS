#!/usr/bin/env node
/**
 * Persist scheduled publishes and unpublishes.
 *
 * The site already honours scheduledAt/unpublishAt lazily at render time
 * (lib/store.ts publicPage), so pages go live/off on time even without
 * this script. What this adds: the stored document is updated to match
 * reality — status flipped, snapshot rebuilt, flags cleared, event row
 * written — so the admin UI and history reflect what happened.
 *
 * Run every 5 minutes:
 *   *\/5 * * * * cd /path/to/hadya-cms && node scripts/apply-schedules.mjs >> /var/log/hadya-schedules.log 2>&1
 */
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';

/* ---- load .env.local (same convention as test-db.mjs) ---- */
for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TENANT = process.env.CMS_TENANT_ID || 'hadya';
const DOC_ID = 'live';
const ACTOR = 'system:scheduler';

if (!process.env.DB_USER || !process.env.DB_CONNECT_STRING) {
  console.log('No DB configured — nothing to do (file driver schedules apply at render time).');
  process.exit(0);
}
process.env.TNS_ADMIN = path.resolve(process.env.TNS_ADMIN || './wallet');

const snapshotOf = (p, when) => ({
  title: p.title, slug: p.slug, navLabel: p.navLabel, showInNav: p.showInNav,
  navOrder: p.navOrder, seo: p.seo, style: p.style, blocks: p.blocks,
  i18n: p.i18n, publishedAt: when,
});

const walletDir = path.resolve(process.env.TNS_ADMIN || './wallet');
const conn = await oracledb.getConnection({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  // Encrypted wallet — same three params as scripts/test-db.mjs.
  configDir: walletDir,
  walletLocation: walletDir,
  walletPassword: process.env.DB_WALLET_PASSWORD,
});

try {
  const r = await conn.execute(
    `SELECT doc_json, version FROM cms_document WHERE tenant_id = :t AND doc_id = :d`,
    { t: TENANT, d: DOC_ID },
    { fetchInfo: { DOC_JSON: { type: oracledb.STRING } } },
  );
  if (!r.rows?.length) { console.log('No document.'); process.exit(0); }

  const doc = JSON.parse(r.rows[0][0] ?? r.rows[0].DOC_JSON);
  const version = Number(r.rows[0][1] ?? r.rows[0].VERSION);
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const events = [];
  let changed = false;

  for (const p of doc.pages) {
    if (p.unpublishAt && now >= Date.parse(p.unpublishAt)) {
      p.status = 'draft';
      p.lastPublished = undefined;
      p.unpublishAt = undefined;
      p.workflow = undefined;
      events.push([p.id, p.title, 'UNPUBLISH']);
      changed = true;
      continue;
    }
    if (p.workflow?.state === 'approved' && p.scheduledAt && now >= Date.parse(p.scheduledAt)) {
      p.status = 'published';
      p.lastPublished = snapshotOf(p, nowIso);
      p.scheduledAt = undefined;
      p.workflow = undefined;
      p.updatedAt = nowIso;
      events.push([p.id, p.title, 'SCHEDULE_APPLIED']);
      changed = true;
    }
  }

  if (!changed) { console.log('Nothing due.'); process.exit(0); }

  // Same history + optimistic-lock discipline as lib/store.ts.
  await conn.execute(
    `INSERT INTO cms_document_history (tenant_id, doc_id, version, doc_json, saved_by)
     SELECT tenant_id, doc_id, version, doc_json, updated_by
       FROM cms_document WHERE tenant_id = :t AND doc_id = :d`,
    { t: TENANT, d: DOC_ID },
  );
  const upd = await conn.execute(
    `UPDATE cms_document
        SET doc_json = :j, version = :nv, updated_at = SYSTIMESTAMP, updated_by = :u
      WHERE tenant_id = :t AND doc_id = :d AND version = :cv`,
    { j: JSON.stringify({ ...doc, version: version + 1 }), nv: version + 1, u: ACTOR, t: TENANT, d: DOC_ID, cv: version },
  );
  if (!upd.rowsAffected) {
    await conn.rollback();
    console.log('Someone saved mid-run; the next cron tick will retry.');
    process.exit(0);
  }
  for (const [pageId, title, action] of events) {
    await conn.execute(
      `INSERT INTO cms_workflow_event (tenant_id, page_id, page_title, action, actor)
       VALUES (:t, :p, :ti, :a, :ac)`,
      { t: TENANT, p: pageId, ti: (title || '').slice(0, 300), a: action, ac: ACTOR },
    );
  }
  await conn.commit();
  console.log(`Applied ${events.length} schedule(s):`, events.map((e) => `${e[2]} ${e[1]}`).join(', '));
} finally {
  await conn.close();
}
