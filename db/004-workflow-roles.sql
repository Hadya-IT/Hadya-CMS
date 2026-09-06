-- ═══════════════════════════════════════════════════════════════════
--  004 — Approval workflow + in-CMS role assignment
--  Run once against the Autonomous Database as the CMS user.
-- ═══════════════════════════════════════════════════════════════════

-- ── role assignment ────────────────────────────────────────────────
-- Entra ID stays the source of AUTHENTICATION. This table is the source
-- of AUTHORISATION: the Marketing Admin assigns CMS roles by email, so
-- no IT ticket is needed per user. Entra App Roles remain a fallback
-- (Admin/Editor) and a bootstrap path for the first Marketing Admin.
CREATE TABLE cms_user_role (
  tenant_id   VARCHAR2(64)  NOT NULL,
  email       VARCHAR2(320) NOT NULL,
  role        VARCHAR2(32)  NOT NULL,
  assigned_by VARCHAR2(320),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_cms_user_role PRIMARY KEY (tenant_id, email),
  CONSTRAINT ck_cms_user_role CHECK (role IN (
    'MARKETING_ADMIN','AGENCY_EDITOR','CONTRIBUTOR','APPROVER','READ_ONLY'
  ))
);

-- ── approval history / comments ────────────────────────────────────
-- One row per workflow action on a page. This is the audit trail the
-- requirements ask for: who created, submitted, reviewed, approved,
-- returned, rejected, published, scheduled — with comments.
CREATE TABLE cms_workflow_event (
  event_id     NUMBER GENERATED ALWAYS AS IDENTITY,
  tenant_id    VARCHAR2(64)  NOT NULL,
  page_id      VARCHAR2(64)  NOT NULL,
  page_title   VARCHAR2(300),            -- denormalised: readable after page deletion
  action       VARCHAR2(24)  NOT NULL,
  actor        VARCHAR2(320) NOT NULL,
  comment_text VARCHAR2(2000),
  occurred_at  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_cms_workflow_event PRIMARY KEY (event_id),
  CONSTRAINT ck_cms_workflow_action CHECK (action IN (
    'SUBMIT','WITHDRAW','APPROVE_PUBLISH','APPROVE_SCHEDULE',
    'RETURN','REJECT','PUBLISH','UNPUBLISH','SCHEDULE_APPLIED'
  ))
);

CREATE INDEX ix_cms_wf_page ON cms_workflow_event (tenant_id, page_id, occurred_at DESC);
CREATE INDEX ix_cms_wf_time ON cms_workflow_event (tenant_id, occurred_at DESC);
