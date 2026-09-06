import 'server-only';
import fs from 'fs';
import path from 'path';
import type { ContentDoc, Page, PublishedSnapshot } from './types';
import { DEFAULT_CONTACT_FORM } from './formdefs';
import { isDbConfigured, withConnection } from './db';

/* ------------------------------------------------------------------
   Two storage drivers behind one interface.

     oracle — used automatically when DB_USER and DB_CONNECT_STRING are set
     file   — data/content.json, used otherwise

   The file driver is what makes `npm install && npm run dev` work with no
   infrastructure. The Oracle driver is what you run in production. Both
   read and write the identical document shape, so you can move between
   them with `npm run db:seed` and `npm run db:export`.
-------------------------------------------------------------------*/

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'content.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const TENANT = () => process.env.CMS_TENANT_ID || 'hadya';
const DOC_ID = 'live';

export type StoreDriver = 'oracle' | 'file';

export function activeDriver(): StoreDriver {
  return isDbConfigured() ? 'oracle' : 'file';
}

/** Raised when two admins save on top of each other. */
export class VersionConflictError extends Error {
  currentVersion: number;
  constructor(currentVersion: number) {
    super('This content was changed by someone else since you loaded it.');
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}

/* ---------------------------- file driver ---------------------------- */

function readFileDoc(): ContentDoc {
  return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as ContentDoc;
}

function writeFileDoc(doc: ContentDoc): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(FILE, path.join(BACKUP_DIR, `content-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).sort();
    while (files.length > 20) {
      const f = files.shift();
      if (f) fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  } catch {
    /* first run — nothing to back up */
  }
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf-8');
  fs.renameSync(tmp, FILE);
}

/* --------------------------- oracle driver --------------------------- */

async function insertOracleDoc(doc: ContentDoc, actor: string): Promise<void> {
  // MERGE, not INSERT: two requests can hit an empty schema at the same
  // moment (public page + admin load), and the loser of that race would
  // otherwise get ORA-00001 on the primary key.
  await withConnection(async (conn) => {
    await conn.execute(
      `MERGE INTO cms_document t
        USING (SELECT :t AS tenant_id, :d AS doc_id FROM dual) s
           ON (t.tenant_id = s.tenant_id AND t.doc_id = s.doc_id)
       WHEN NOT MATCHED THEN
         INSERT (tenant_id, doc_id, doc_json, version, updated_by)
         VALUES (s.tenant_id, s.doc_id, :j, :v, :u)`,
      { t: TENANT(), d: DOC_ID, j: JSON.stringify(doc), v: doc.version || 1, u: actor },
      { autoCommit: true },
    );
  });
}

async function readOracleDoc(): Promise<ContentDoc> {
  const rows = await withConnection(async (conn) => {
    const r = await conn.execute<{ DOC_JSON: string; VERSION: number }>(
      `SELECT doc_json, version FROM cms_document
        WHERE tenant_id = :t AND doc_id = :d`,
      { t: TENANT(), d: DOC_ID },
    );
    return r.rows ?? [];
  });

  if (!rows.length) {
    // First run against an empty schema: seed from the bundled file so the
    // site is never blank, then persist it.
    const seed = readFileDoc();
    seed.version = 1;
    await insertOracleDoc(seed, 'system:auto-seed');
    return seed;
  }

  const doc = JSON.parse(rows[0].DOC_JSON) as ContentDoc;
  doc.version = Number(rows[0].VERSION);
  return doc;
}

async function writeOracleDoc(
  doc: ContentDoc,
  actor: string,
  expectedVersion: number,
): Promise<number> {
  return withConnection(async (conn) => {
    // Snapshot the row we are about to replace, so history is complete.
    await conn.execute(
      `INSERT INTO cms_document_history (tenant_id, doc_id, version, doc_json, saved_by)
       SELECT tenant_id, doc_id, version, doc_json, updated_by
         FROM cms_document
        WHERE tenant_id = :t AND doc_id = :d`,
      { t: TENANT(), d: DOC_ID },
    );

    const nextVersion = expectedVersion + 1;

    // Optimistic lock: this UPDATE only matches if nobody else has saved.
    const res = await conn.execute(
      `UPDATE cms_document
          SET doc_json = :j, version = :nv,
              updated_at = SYSTIMESTAMP, updated_by = :u
        WHERE tenant_id = :t AND doc_id = :d AND version = :cv`,
      {
        j: JSON.stringify({ ...doc, version: nextVersion }),
        nv: nextVersion,
        u: actor,
        t: TENANT(),
        d: DOC_ID,
        cv: expectedVersion,
      },
    );

    if (!res.rowsAffected) {
      await conn.rollback();
      const cur = await conn.execute<{ VERSION: number }>(
        `SELECT version FROM cms_document WHERE tenant_id = :t AND doc_id = :d`,
        { t: TENANT(), d: DOC_ID },
      );
      throw new VersionConflictError(Number(cur.rows?.[0]?.VERSION ?? 0));
    }

    // Keep history bounded — 50 revisions is plenty and stops the CLOB
    // table growing without limit on a chatty site.
    await conn.execute(
      `DELETE FROM cms_document_history
        WHERE tenant_id = :t AND doc_id = :d
          AND version <= (SELECT MAX(version) - 50
                            FROM cms_document_history
                           WHERE tenant_id = :t AND doc_id = :d)`,
      { t: TENANT(), d: DOC_ID },
    );

    await conn.commit();
    return nextVersion;
  });
}

/* ---------------------------- normalising ---------------------------- */

/* Documents saved before a feature existed lack its keys. Rather than
   defending against undefined at every call site, every read passes through
   here once. New optional keys go in this function, not into the renderers. */
function normalise(doc: ContentDoc): ContentDoc {
  if (!Array.isArray(doc.forms) || !doc.forms.length) {
    doc.forms = [DEFAULT_CONTACT_FORM];
  }
  if (!doc.settings.locales) {
    doc.settings.locales = { enabled: ['en'], showSwitch: false };
  }
  if (!Array.isArray(doc.settings.redirects)) doc.settings.redirects = [];
  if (!Array.isArray(doc.sharedBlocks)) doc.sharedBlocks = [];
  if (!doc.settings.notifications) {
    doc.settings.notifications = { enabled: false, leadRecipients: [] };
  }
  if (!doc.settings.consent) {
    doc.settings.consent = {
      enabled: false,
      title: 'We use cookies',
      body:
        'We use cookies to understand how the site is used and to measure our advertising. ' +
        'You can accept or decline — declining does not affect how the site works.',
      titleAr: 'نستخدم ملفات تعريف الارتباط',
      bodyAr:
        'نستخدم ملفات تعريف الارتباط لفهم كيفية استخدام الموقع وقياس أداء حملاتنا. ' +
        'يمكنك القبول أو الرفض — ولن يؤثر الرفض على عمل الموقع.',
      acceptLabel: 'Accept',
      rejectLabel: 'Decline',
      policyLabel: 'Privacy policy',
      policyHref: '',
    };
  }
  return doc;
}

/* ------------------------------ public ------------------------------- */

export async function readContent(): Promise<ContentDoc> {
  if (activeDriver() === 'oracle') {
    try {
      return normalise(await readOracleDoc());
    } catch (e) {
      // A database outage must not take the public site down.
      console.error('Oracle read failed, serving bundled content:', e);
      return normalise(readFileDoc());
    }
  }
  return normalise(readFileDoc());
}

export async function writeContent(doc: ContentDoc, actor = 'unknown'): Promise<number> {
  const expected = Number(doc.version) || 0;
  if (activeDriver() === 'oracle') {
    return writeOracleDoc(doc, actor, expected);
  }
  const next = expected + 1;
  writeFileDoc({ ...doc, version: next });
  return next;
}

export async function listRevisions(limit = 20) {
  if (activeDriver() !== 'oracle') return [];
  return withConnection(async (conn) => {
    const r = await conn.execute<{ VERSION: number; SAVED_AT: Date; SAVED_BY: string }>(
      `SELECT version, saved_at, saved_by
         FROM cms_document_history
        WHERE tenant_id = :t AND doc_id = :d
        ORDER BY version DESC
        FETCH FIRST :n ROWS ONLY`,
      { t: TENANT(), d: DOC_ID, n: limit },
    );
    return r.rows ?? [];
  });
}


/** Freeze the renderable parts of a page. Called on every save of a
 *  published page, so the snapshot always equals what was live. */
export function snapshotOf(p: Page, when = new Date().toISOString()): PublishedSnapshot {
  return {
    title: p.title,
    slug: p.slug,
    navLabel: p.navLabel,
    showInNav: p.showInNav,
    navOrder: p.navOrder,
    seo: p.seo,
    style: p.style,
    blocks: p.blocks,
    i18n: p.i18n,
    publishedAt: when,
  };
}

/** What an anonymous visitor may see of this page:
 *  published -> the page itself; draft with a snapshot -> the last
 *  published version; never-published draft -> null (a real 404). */
export function publicPage(p: Page): Page | null {
  const now = Date.now();

  // Scheduled unpublish: past the time, the page is off the site.
  if (p.unpublishAt && now >= Date.parse(p.unpublishAt)) return null;

  if (p.status === 'published') return p;

  // Approved + scheduled: serve the working copy as live once due. The
  // cron (scripts/apply-schedules.mjs) persists this; here it just works.
  if (p.workflow?.state === 'approved' && p.scheduledAt && now >= Date.parse(p.scheduledAt)) {
    return { ...p, status: 'published' };
  }

  if (p.lastPublished) return { ...p, ...p.lastPublished, status: 'published' };
  return null;
}

export async function getPageBySlug(slug: string): Promise<Page | undefined> {
  const doc = await readContent();
  return doc.pages.find((p) => p.slug === slug);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** Admin-only rollback. Copies a historical revision back over the live
 *  document as a NEW version, so the rollback itself stays in the history. */
export async function restoreRevision(version: number, actor: string): Promise<number> {
  if (activeDriver() !== 'oracle') {
    throw new Error('Revision history needs the Oracle store. Set DB_USER and DB_CONNECT_STRING.');
  }

  const rows = await withConnection(async (conn) => {
    const r = await conn.execute<{ DOC_JSON: string }>(
      `SELECT doc_json FROM cms_document_history
        WHERE tenant_id = :t AND doc_id = :d AND version = :v`,
      { t: TENANT(), d: DOC_ID, v: version },
    );
    return r.rows ?? [];
  });

  if (!rows.length) throw new Error(`Revision ${version} is not in the history.`);

  const doc = JSON.parse(rows[0].DOC_JSON) as ContentDoc;
  const current = await readOracleDoc();
  doc.version = current.version;
  return writeOracleDoc(doc, actor + ' (restored v' + version + ')', current.version);
}
