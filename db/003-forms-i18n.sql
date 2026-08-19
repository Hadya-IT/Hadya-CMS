-- ═══════════════════════════════════════════════════════════════════
--  Hadya CMS — migration 003
--  Adds the form-builder and locale columns to cms_form_submission.
--
--  Run against an EXISTING database created with schema.sql or
--  002-form-submissions.sql:
--    sqlplus $DB_USER/$DB_PASSWORD@$DB_CONNECT_STRING @db/003-forms-i18n.sql
--
--  Safe to re-run: each ALTER is wrapped so an already-applied column is
--  skipped rather than raising ORA-01430. A fresh database created from the
--  updated schema.sql already has these columns and this script is a no-op.
--
--  Nothing here is destructive and no existing row is rewritten — the new
--  columns are nullable, so submissions captured before the form builder
--  simply carry NULL and are treated as belonging to the contact form.
-- ═══════════════════════════════════════════════════════════════════

SET SERVEROUTPUT ON

DECLARE
  PROCEDURE add_column(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
      FROM user_tab_columns
     WHERE table_name = UPPER(p_table)
       AND column_name = UPPER(p_column);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_column || ' ' || p_definition || ')';
      DBMS_OUTPUT.PUT_LINE('added   ' || p_table || '.' || p_column);
    ELSE
      DBMS_OUTPUT.PUT_LINE('exists  ' || p_table || '.' || p_column || ' — skipped');
    END IF;
  END;
BEGIN
  -- Which editor-defined form produced the submission. NULL = the original
  -- hardcoded contact form.
  add_column('cms_form_submission', 'form_id',   'VARCHAR2(64)');

  -- Denormalised on purpose: the form can be renamed or deleted in the CMS,
  -- and a submission has to stay readable years later without a join to a
  -- definition that may no longer exist.
  add_column('cms_form_submission', 'form_name', 'VARCHAR2(200)');

  -- Answers with no fixed column, as JSON. CLOB rather than VARCHAR2 because
  -- a builder-defined form has no upper bound on field count.
  add_column('cms_form_submission', 'answers_json', 'CLOB');

  -- Which language the visitor was using. Drives the confirmation email.
  add_column('cms_form_submission', 'locale', 'VARCHAR2(8) DEFAULT ''en''');
END;
/

-- A JSON check constraint, added separately so a pre-existing column with
-- non-JSON content does not block the whole migration.
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM user_constraints
   WHERE constraint_name = 'CK_CMS_SUBMISSION_ANSWERS';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE cms_form_submission ADD CONSTRAINT ck_cms_submission_answers
         CHECK (answers_json IS NULL OR answers_json IS JSON)';
    DBMS_OUTPUT.PUT_LINE('added   constraint ck_cms_submission_answers');
  ELSE
    DBMS_OUTPUT.PUT_LINE('exists  constraint ck_cms_submission_answers — skipped');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Existing rows with invalid JSON would fail the constraint. Report and
    -- continue rather than aborting: the application tolerates bad JSON by
    -- returning undefined answers.
    DBMS_OUTPUT.PUT_LINE('SKIPPED constraint ck_cms_submission_answers: ' || SQLERRM);
END;
/

-- Reporting index: the submissions screen filters by form and orders by date.
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM user_indexes
   WHERE index_name = 'IX_CMS_SUBMISSION_FORM';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_cms_submission_form
         ON cms_form_submission (tenant_id, form_id, created_at DESC)';
    DBMS_OUTPUT.PUT_LINE('added   index ix_cms_submission_form');
  ELSE
    DBMS_OUTPUT.PUT_LINE('exists  index ix_cms_submission_form — skipped');
  END IF;
END;
/

COMMENT ON COLUMN cms_form_submission.form_id      IS 'Editor-defined form id; NULL for pre-builder submissions';
COMMENT ON COLUMN cms_form_submission.form_name    IS 'Form name at time of submission, denormalised deliberately';
COMMENT ON COLUMN cms_form_submission.answers_json IS 'Answers with no fixed column, as JSON';
COMMENT ON COLUMN cms_form_submission.locale       IS 'Locale the visitor was browsing in';
