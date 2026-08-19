'use client';

import { useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  Button,
  Card,
  CardTitle,
  FieldShell,
  IconButton,
  Input,
  Muted,
  PaneHeader,
  Row,
  Select,
  SubHeading,
  Textarea,
  Toggle,
  cx,
} from '@/components/admin/ui';
import { RESERVED_FIELD_NAMES, toFieldName } from '@/lib/formdefs';
import type { FormDef, FormFieldDef, FormFieldType } from '@/lib/types';

/* ------------------------------------------------------------------
   The form builder.

   Marketing's actual ask was "we can't add a form without a developer".
   This is that, with two deliberate limits:

   - No layout control beyond half/full width, matching the same principle
     as the block editor: editors control content, components own layout.
   - Field machine names are generated once from the label and then locked.
     Renaming would orphan every historical submission, because the answers
     are stored as JSON keyed by name. The label stays freely editable, which
     is what people actually want to change.
-------------------------------------------------------------------*/

const TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Single line' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

/* Dynamics lead attributes an answer can be mapped onto. Anything left
   unmapped still reaches the CRM, appended to the lead description. */
const CRM_FIELDS = [
  { value: '', label: 'Not mapped' },
  { value: 'firstname', label: 'Name' },
  { value: 'emailaddress1', label: 'Email' },
  { value: 'telephone1', label: 'Phone' },
  { value: 'companyname', label: 'Company' },
  { value: 'subject', label: 'Subject' },
  { value: 'description', label: 'Message / description' },
];

const rid = (p: string) =>
  `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export default function FormsAdmin() {
  const { doc, loading, update } = useAdmin();
  const [selected, setSelected] = useState<string | null>(null);
  const [openField, setOpenField] = useState<string | null>(null);

  if (loading || !doc) return <div className="p-[22px] text-dim">Loading…</div>;

  const forms = doc.forms || [];
  const current = forms.find((f) => f.id === selected) || forms[0] || null;

  function mutateForm(id: string, fn: (f: FormDef) => void) {
    update((d) => {
      const target = (d.forms || []).find((f) => f.id === id);
      if (target) fn(target);
    });
  }

  function addForm() {
    const id = rid('form');
    update((d) => {
      if (!d.forms) d.forms = [];
      d.forms.push({
        id,
        name: 'New form',
        submitLabel: 'Send',
        successMessage: 'Thank you — your message has been received.',
        crmPush: true,
        fields: [
          {
            id: rid('fld'),
            name: 'name',
            label: 'Your name',
            type: 'text',
            required: true,
            half: true,
            crmField: 'firstname',
          },
          {
            id: rid('fld'),
            name: 'email',
            label: 'Your email',
            type: 'email',
            required: true,
            half: true,
            crmField: 'emailaddress1',
          },
        ],
      });
    });
    setSelected(id);
  }

  function addField(form: FormDef) {
    const fieldId = rid('fld');
    mutateForm(form.id, (f) => {
      f.fields.push({
        id: fieldId,
        name: toFieldName('New field', f.fields.map((x) => x.name)),
        label: 'New field',
        type: 'text',
      });
    });
    setOpenField(fieldId);
  }

  function move(form: FormDef, index: number, delta: number) {
    mutateForm(form.id, (f) => {
      const to = index + delta;
      if (to < 0 || to >= f.fields.length) return;
      const [item] = f.fields.splice(index, 1);
      f.fields.splice(to, 0, item);
    });
  }

  return (
    <div className="grid min-h-0 xl:grid-cols-[280px_1fr]">
      {/* ---------------------------------------------------------- list */}
      <aside className="border-b border-edge xl:border-b-0 xl:border-r">
        <PaneHeader title="Forms">
          <Button size="sm" variant="primary" onClick={addForm}>
            + New
          </Button>
        </PaneHeader>
        <div className="flex flex-col gap-1 p-2.5">
          {forms.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelected(f.id)}
              className={cx(
                'rounded-panel px-3 py-2.5 text-left transition-colors',
                current?.id === f.id ? 'bg-subtle text-gold' : 'text-dim hover:bg-subtle hover:text-ink',
              )}
            >
              <strong className="block text-[12.5px] font-medium">{f.name}</strong>
              <small className="text-[11px] text-dim">
                {f.fields.length} field{f.fields.length === 1 ? '' : 's'} · {f.id}
              </small>
            </button>
          ))}
          {!forms.length && <Muted className="px-3 py-2">No forms yet.</Muted>}
        </div>
      </aside>

      {/* -------------------------------------------------------- editor */}
      <div className="min-w-0 p-[22px]">
        {!current ? (
          <Muted>Create a form to begin.</Muted>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="mb-1 text-[17px] font-medium">{current.name}</h2>
                <Muted>
                  Place this on a page with the <strong>Form</strong> section, using the ID{' '}
                  <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px]">
                    {current.id}
                  </code>
                </Muted>
              </div>
              {forms.length > 1 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (!confirm(`Delete "${current.name}"? Existing submissions are kept.`)) return;
                    update((d) => {
                      d.forms = (d.forms || []).filter((f) => f.id !== current.id);
                    });
                    setSelected(null);
                  }}
                >
                  Delete form
                </Button>
              )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* ------------------------------------------- settings */}
              <Card>
                <CardTitle>Form settings</CardTitle>
                <FieldShell label="Name (internal)">
                  <Input
                    value={current.name}
                    onChange={(e) => mutateForm(current.id, (f) => { f.name = e.target.value; })}
                  />
                </FieldShell>
                <Row>
                  <FieldShell label="Button label">
                    <Input
                      value={current.submitLabel}
                      onChange={(e) => mutateForm(current.id, (f) => { f.submitLabel = e.target.value; })}
                    />
                  </FieldShell>
                  <FieldShell label="Button label — Arabic">
                    <Input
                      dir="rtl"
                      value={current.submitLabelAr || ''}
                      onChange={(e) => mutateForm(current.id, (f) => { f.submitLabelAr = e.target.value; })}
                    />
                  </FieldShell>
                </Row>
                <FieldShell label="Thank-you message">
                  <Textarea
                    rows={2}
                    value={current.successMessage}
                    onChange={(e) => mutateForm(current.id, (f) => { f.successMessage = e.target.value; })}
                  />
                </FieldShell>
                <FieldShell label="Thank-you message — Arabic">
                  <Textarea
                    rows={2}
                    dir="rtl"
                    value={current.successMessageAr || ''}
                    onChange={(e) => mutateForm(current.id, (f) => { f.successMessageAr = e.target.value; })}
                  />
                </FieldShell>
                <FieldShell
                  label="Consent line"
                  help="Leave blank for no checkbox. When filled, ticking it is required to submit — use this for PDPL marketing consent."
                >
                  <Textarea
                    rows={2}
                    value={current.consentText || ''}
                    onChange={(e) => mutateForm(current.id, (f) => { f.consentText = e.target.value; })}
                  />
                </FieldShell>
                <FieldShell label="Consent line — Arabic">
                  <Textarea
                    rows={2}
                    dir="rtl"
                    value={current.consentTextAr || ''}
                    onChange={(e) => mutateForm(current.id, (f) => { f.consentTextAr = e.target.value; })}
                  />
                </FieldShell>
              </Card>

              {/* -------------------------------------------- routing */}
              <Card>
                <CardTitle>Where submissions go</CardTitle>
                <Muted className="mb-3.5">
                  Every submission is stored and visible under Submissions, whatever these say.
                </Muted>
                <FieldShell
                  label="Email these people"
                  help="Comma-separated. Added to the site-wide recipients in Settings."
                >
                  <Input
                    placeholder="sales@hadya.com, marketing@hadya.com"
                    value={(current.notifyEmails || []).join(', ')}
                    onChange={(e) =>
                      mutateForm(current.id, (f) => {
                        f.notifyEmails = e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean);
                      })
                    }
                  />
                </FieldShell>
                <div className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <strong className="block text-[12.5px]">Create a lead in Dynamics 365</strong>
                    <Muted>Turn off for forms that are not sales enquiries.</Muted>
                  </div>
                  <Toggle
                    label="Push to Dynamics"
                    checked={current.crmPush !== false}
                    onChange={(v) => mutateForm(current.id, (f) => { f.crmPush = v; })}
                  />
                </div>
              </Card>
            </div>

            {/* ---------------------------------------------- fields */}
            <div className="mt-6">
              <div className="mb-2.5 flex items-center justify-between">
                <SubHeading>Fields</SubHeading>
                <Button size="sm" onClick={() => addField(current)}>
                  + Add field
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                {current.fields.map((field, i) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={i}
                    total={current.fields.length}
                    open={openField === field.id}
                    onToggle={() => setOpenField(openField === field.id ? null : field.id)}
                    onMove={(delta) => move(current, i, delta)}
                    onChange={(patch) =>
                      mutateForm(current.id, (f) => {
                        const target = f.fields.find((x) => x.id === field.id);
                        if (target) Object.assign(target, patch);
                      })
                    }
                    onDelete={() =>
                      mutateForm(current.id, (f) => {
                        f.fields = f.fields.filter((x) => x.id !== field.id);
                      })
                    }
                  />
                ))}
                {!current.fields.length && <Muted>No fields yet — add one above.</Muted>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- one field row --------------------------- */

function FieldRow({
  field,
  index,
  total,
  open,
  onToggle,
  onMove,
  onChange,
  onDelete,
}: {
  field: FormFieldDef;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onMove: (delta: number) => void;
  onChange: (patch: Partial<FormFieldDef>) => void;
  onDelete: () => void;
}) {
  const reserved = RESERVED_FIELD_NAMES.includes(field.name);

  return (
    <div className="rounded-panel border border-edge bg-panel">
      <div className="group flex items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
        >
          <span aria-hidden="true" className="text-[10px] text-dim">
            {open ? '▾' : '▸'}
          </span>
          <span className="truncate text-[12.5px]">{field.label || '(no label)'}</span>
          <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10.5px] text-dim">
            {field.name}
          </span>
          <span className="text-[11px] text-dim">
            {TYPES.find((t) => t.value === field.type)?.label}
          </span>
          {field.required && (
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-gold">required</span>
          )}
        </button>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconButton aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </IconButton>
          <IconButton
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </IconButton>
          <IconButton aria-label="Delete field" danger onClick={onDelete}>
            ×
          </IconButton>
        </div>
      </div>

      {open && (
        <div className="border-t border-edge px-3 py-3.5">
          {reserved && (
            <p className="mb-3 text-[11.5px] text-danger">
              “{field.name}” is a reserved name and will be rejected on submit. Rename the label and
              re-create this field.
            </p>
          )}
          <Row>
            <FieldShell label="Label">
              <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
            </FieldShell>
            <FieldShell label="Label — Arabic">
              <Input
                dir="rtl"
                value={field.labelAr || ''}
                onChange={(e) => onChange({ labelAr: e.target.value })}
              />
            </FieldShell>
          </Row>
          <Row>
            <FieldShell label="Type">
              <Select
                value={field.type}
                onChange={(e) => onChange({ type: e.target.value as FormFieldType })}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell label="Send to Dynamics as" help="Unmapped answers are appended to the lead notes.">
              <Select
                value={field.crmField || ''}
                onChange={(e) => onChange({ crmField: e.target.value || undefined })}
              >
                {CRM_FIELDS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </Row>
          <FieldShell label="Placeholder" help="Defaults to the label when blank.">
            <Input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </FieldShell>

          {field.type === 'select' && (
            <FieldShell label="Options" help="One per line. A submitted value not on this list is rejected.">
              <Textarea
                rows={4}
                value={(field.options || []).join('\n')}
                onChange={(e) =>
                  onChange({
                    options: e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </FieldShell>
          )}

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2.5 text-[12.5px]">
              <Toggle
                label="Required"
                checked={!!field.required}
                onChange={(v) => onChange({ required: v })}
              />
              Required
            </label>
            <label className="flex items-center gap-2.5 text-[12.5px]">
              <Toggle
                label="Half width"
                checked={!!field.half}
                onChange={(v) => onChange({ half: v })}
              />
              Half width
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
