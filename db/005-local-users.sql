-- ═══════════════════════════════════════════════════════════════════
--  005 — DB-backed password logins (alongside SSO)
--  Run once, after 004. Passwords are scrypt-hashed; the CMS never
--  stores or logs the plain text.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE cms_local_user (
  tenant_id     VARCHAR2(64)  NOT NULL,
  email         VARCHAR2(320) NOT NULL,
  display_name  VARCHAR2(200),
  -- format: scrypt$<N>$<salt_b64>$<hash_b64>
  password_hash VARCHAR2(500) NOT NULL,
  active        CHAR(1) DEFAULT 'Y' NOT NULL,
  created_by    VARCHAR2(320),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_cms_local_user PRIMARY KEY (tenant_id, email),
  CONSTRAINT ck_cms_local_active CHECK (active IN ('Y','N'))
);

-- The user's ROLE does not live here on purpose: cms_user_role (004) is
-- the single source of authorisation for BOTH sign-in doors. Creating a
-- local user writes both tables in one step (see /api/users/local).
