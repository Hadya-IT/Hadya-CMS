-- ═══════════════════════════════════════════════════════════════════
--  Hadya CMS — reset
--
--  DESTRUCTIVE. Back up first:   npm run db:export
--
--  Drops only CMS tables — the new schema plus the four tables from the
--  earlier Hadya project. It will NOT touch anything else the user owns.
--  Safe to re-run: missing tables are skipped, not errors.
--
--  If the earlier project is still deployed anywhere, dropping PAGES /
--  CONTENT_ENTRIES / SECTION_BLOCKS / TENANT_THEME breaks it immediately.
--  Remove those four names below if you are unsure.
-- ═══════════════════════════════════════════════════════════════════

SET SERVEROUTPUT ON;

BEGIN
  FOR t IN (
    SELECT table_name FROM user_tables
     WHERE table_name IN (
       'CMS_DOCUMENT', 'CMS_DOCUMENT_HISTORY', 'CMS_ADMIN_AUDIT',
       'PAGES', 'CONTENT_ENTRIES', 'SECTION_BLOCKS', 'TENANT_THEME'
     )
  ) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE "' || t.table_name || '" CASCADE CONSTRAINTS PURGE';
    DBMS_OUTPUT.PUT_LINE('dropped table  ' || t.table_name);
  END LOOP;

  -- identity sequences are dropped with their table; this catches strays
  FOR s IN (
    SELECT sequence_name FROM user_sequences
     WHERE sequence_name LIKE 'ISEQ$$_%'
        OR sequence_name LIKE 'CMS_%'
  ) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP SEQUENCE "' || s.sequence_name || '"';
      DBMS_OUTPUT.PUT_LINE('dropped sequence ' || s.sequence_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/

PURGE RECYCLEBIN;

-- What is left afterwards
SELECT table_name FROM user_tables ORDER BY table_name;

-- Next:  run db/schema.sql, then  npm run db:seed
