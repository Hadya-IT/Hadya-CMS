-- ═══════════════════════════════════════════════════════════════════
--  Migration 002 — website form submissions / Dynamics 365 leads
--
--  Run this on a database that already has the tables from schema.sql.
--  On a fresh database, schema.sql already includes it.
--    sqlplus $DB_USER/$DB_PASSWORD@$DB_CONNECT_STRING @db/002-form-submissions.sql
-- ═══════════════════════════════════════════════════════════════════

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
  CONSTRAINT pk_cms_form_submission PRIMARY KEY (submission_id),
  CONSTRAINT ck_cms_form_crm_status
    CHECK (crm_status IN ('off','pending','sent','failed'))
);

CREATE INDEX ix_cms_form_recent
  ON cms_form_submission (tenant_id, created_at DESC);

-- Find leads that still need pushing to Dynamics:
--   SELECT submission_id, email, crm_error FROM cms_form_submission
--    WHERE crm_status = 'failed' ORDER BY created_at DESC;
