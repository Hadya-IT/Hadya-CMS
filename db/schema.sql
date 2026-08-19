-- ═══════════════════════════════════════════════════════════════════
--  Hadya CMS — Oracle schema
--  Run once against the Autonomous Database as the CMS user.
--    sqlplus $DB_USER/$DB_PASSWORD@$DB_CONNECT_STRING @db/schema.sql
--  or paste into SQL Developer Web / Database Actions.
--
--  Design note: the whole site is one JSON document per tenant, matching
--  the shape of data/content.json exactly. That keeps a single source of
--  truth and makes the file store and the database interchangeable. The
--  cost is that you cannot query individual pages in SQL — if you later
--  need that, add a pages table and project into it on write.
-- ═══════════════════════════════════════════════════════════════════

-- ── live document ──────────────────────────────────────────────────
CREATE TABLE cms_document (
  tenant_id   VARCHAR2(64)              NOT NULL,
  doc_id      VARCHAR2(64) DEFAULT 'live' NOT NULL,
  doc_json    CLOB                      NOT NULL,
  version     NUMBER(12)   DEFAULT 1    NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_by  VARCHAR2(320),
  CONSTRAINT pk_cms_document PRIMARY KEY (tenant_id, doc_id),
  CONSTRAINT ck_cms_document_json CHECK (doc_json IS JSON)
);

COMMENT ON TABLE  cms_document            IS 'Live site content, one JSON document per tenant';
COMMENT ON COLUMN cms_document.version    IS 'Incremented on every save; used for optimistic locking';
COMMENT ON COLUMN cms_document.updated_by IS 'Email of the signed-in admin who saved';

-- ── revision history ───────────────────────────────────────────────
-- Replaces the file-based data/backups folder. Every save writes the
-- PREVIOUS document here before overwriting, so you can always roll back.
CREATE TABLE cms_document_history (
  history_id  NUMBER GENERATED ALWAYS AS IDENTITY,
  tenant_id   VARCHAR2(64) NOT NULL,
  doc_id      VARCHAR2(64) NOT NULL,
  version     NUMBER(12)   NOT NULL,
  doc_json    CLOB         NOT NULL,
  saved_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  saved_by    VARCHAR2(320),
  CONSTRAINT pk_cms_document_history PRIMARY KEY (history_id)
);

CREATE INDEX ix_cms_hist_lookup
  ON cms_document_history (tenant_id, doc_id, version DESC);

-- ── audit trail for admin sign-ins ─────────────────────────────────
CREATE TABLE cms_admin_audit (
  audit_id    NUMBER GENERATED ALWAYS AS IDENTITY,
  tenant_id   VARCHAR2(64),
  actor       VARCHAR2(320),
  action      VARCHAR2(64)  NOT NULL,   -- SIGN_IN | SAVE | MEDIA_UPLOAD | MEDIA_DELETE
  detail      VARCHAR2(1000),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_cms_admin_audit PRIMARY KEY (audit_id)
);

CREATE INDEX ix_cms_audit_time ON cms_admin_audit (occurred_at DESC);


-- ── website form submissions / Dynamics 365 leads ──────────────────
-- Also shipped separately as db/002-form-submissions.sql for databases
-- created before this table existed.
CREATE TABLE cms_form_submission (
  submission_id VARCHAR2(64)  NOT NULL,
  tenant_id     VARCHAR2(64)  NOT NULL,
  full_name     VARCHAR2(200) NOT NULL,
  email         VARCHAR2(320) NOT NULL,
  phone         VARCHAR2(60),
  company       VARCHAR2(200),
  subject       VARCHAR2(300),
  message       VARCHAR2(4000),
  page_url      VARCHAR2(500),
  -- Dynamics 365 hand-off. The submission is stored first and the CRM push
  -- recorded afterwards, so a CRM outage never loses a lead.
  crm_id        VARCHAR2(64),                 -- Dataverse lead GUID
  crm_status    VARCHAR2(16) DEFAULT 'off' NOT NULL, -- off|pending|sent|failed
  crm_error     VARCHAR2(500),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  -- Form builder. form_name is denormalised on purpose: the definition can
  -- be renamed or deleted in the CMS, and a submission has to stay readable
  -- years later without joining to something that may no longer exist.
  form_id       VARCHAR2(64),                  -- NULL = pre-builder contact form
  form_name     VARCHAR2(200),
  answers_json  CLOB,                          -- answers with no fixed column
  locale        VARCHAR2(8) DEFAULT 'en',      -- drives the confirmation email
  CONSTRAINT pk_cms_form_submission PRIMARY KEY (submission_id),
  CONSTRAINT ck_cms_form_crm_status
    CHECK (crm_status IN ('off','pending','sent','failed')),
  CONSTRAINT ck_cms_submission_answers
    CHECK (answers_json IS NULL OR answers_json IS JSON)
);

CREATE INDEX ix_cms_form_recent
  ON cms_form_submission (tenant_id, created_at DESC);

-- The submissions screen filters by form and orders by date.
CREATE INDEX ix_cms_submission_form
  ON cms_form_submission (tenant_id, form_id, created_at DESC);

-- Find leads that still need pushing to Dynamics:
--   SELECT submission_id, email, crm_error FROM cms_form_submission
--    WHERE crm_status = 'failed' ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════
--  Useful queries
-- ═══════════════════════════════════════════════════════════════════

-- Current version and who last saved
-- SELECT tenant_id, version, updated_at, updated_by FROM cms_document;

-- Last 20 revisions
-- SELECT version, saved_at, saved_by
--   FROM cms_document_history
--  WHERE tenant_id = 'hadya' AND doc_id = 'live'
--  ORDER BY version DESC FETCH FIRST 20 ROWS ONLY;

-- Roll back to a specific version
-- UPDATE cms_document d
--    SET d.doc_json = (SELECT h.doc_json FROM cms_document_history h
--                       WHERE h.tenant_id = d.tenant_id
--                         AND h.doc_id    = d.doc_id
--                         AND h.version   = 41),
--        d.version    = d.version + 1,
--        d.updated_at = SYSTIMESTAMP,
--        d.updated_by = 'manual-rollback'
--  WHERE d.tenant_id = 'hadya' AND d.doc_id = 'live';
-- COMMIT;

-- Page titles and slugs out of the JSON document
-- SELECT jt.title, jt.slug, jt.status
--   FROM cms_document d,
--        JSON_TABLE(d.doc_json, '$.pages[*]'
--          COLUMNS (title VARCHAR2(200) PATH '$.title',
--                   slug  VARCHAR2(200) PATH '$.slug',
--                   status VARCHAR2(20) PATH '$.status')) jt
--  WHERE d.tenant_id = 'hadya';

-- Trim history to the newest 50 revisions
-- DELETE FROM cms_document_history
--  WHERE tenant_id = 'hadya' AND doc_id = 'live'
--    AND version <= (SELECT MAX(version) - 50 FROM cms_document_history
--                     WHERE tenant_id = 'hadya' AND doc_id = 'live');
