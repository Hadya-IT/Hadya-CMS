import 'server-only';

/* ------------------------------------------------------------------
   The five CMS roles and what each may do.

   Roles are assigned in-CMS (cms_user_role, keyed by email) by a
   Marketing Admin. Entra App Roles remain a fallback so the first
   Marketing Admin can bootstrap: the Entra "Admin" role maps to
   MARKETING_ADMIN, "Editor" to AGENCY_EDITOR.

   Capabilities, not ranks. The old ADMIN>EDITOR ladder cannot express
   an Approver who publishes but does not manage settings, so every
   permission check names the capability it needs.
-------------------------------------------------------------------*/

export type CmsRole =
  | 'MARKETING_ADMIN'
  | 'AGENCY_EDITOR'
  | 'CONTRIBUTOR'
  | 'APPROVER'
  | 'READ_ONLY';

export const ALL_ROLES: CmsRole[] = [
  'MARKETING_ADMIN',
  'AGENCY_EDITOR',
  'CONTRIBUTOR',
  'APPROVER',
  'READ_ONLY',
];

export type Capability =
  | 'view'             // read admin content, preview drafts
  | 'editContent'      // change text/blocks/images on pages
  | 'createPages'
  | 'deleteDrafts'     // delete never-published pages
  | 'deletePublished'  // delete pages that are (or were) live
  | 'editPageMeta'     // slug, nav label/order/visibility, page style
  | 'editSeo'          // page + global SEO fields
  | 'manageMedia'
  | 'viewLeads'
  | 'submitReview'     // move own work into the approval queue
  | 'review'           // see the queue, comment, return, reject
  | 'publish'          // approve & publish / unpublish
  | 'schedule'         // approve & schedule / set unpublish time
  | 'manageSettings'   // global design, integrations, redirects
  | 'manageUsers'
  | 'restoreRevisions'
  | 'overrideWorkflow'; // publish directly, bypass the queue

const MATRIX: Record<CmsRole, Capability[]> = {
  MARKETING_ADMIN: [
    'view', 'editContent', 'createPages', 'deleteDrafts', 'deletePublished',
    'editPageMeta', 'editSeo', 'manageMedia', 'viewLeads', 'submitReview',
    'review', 'publish', 'schedule', 'manageSettings', 'manageUsers',
    'restoreRevisions', 'overrideWorkflow',
  ],
  AGENCY_EDITOR: [
    'view', 'editContent', 'createPages', 'deleteDrafts',
    'editPageMeta', 'editSeo', 'manageMedia', 'viewLeads', 'submitReview',
  ],
  CONTRIBUTOR: [
    'view', 'editContent', 'manageMedia', 'submitReview',
  ],
  APPROVER: [
    'view', 'editContent', 'editPageMeta', 'editSeo',
    'review', 'publish', 'schedule', 'viewLeads',
  ],
  READ_ONLY: [
    'view', 'viewLeads',
  ],
};

export function can(role: CmsRole, cap: Capability): boolean {
  return MATRIX[role]?.includes(cap) ?? false;
}

/** Legacy tokens and Entra App Roles carry ADMIN / EDITOR. */
export function upgradeLegacyRole(r: string | undefined | null): CmsRole {
  const v = (r || '').toUpperCase();
  if (v === 'ADMIN' || v === 'MARKETING_ADMIN') return 'MARKETING_ADMIN';
  if (v === 'EDITOR' || v === 'AGENCY_EDITOR') return 'AGENCY_EDITOR';
  if ((ALL_ROLES as string[]).includes(v)) return v as CmsRole;
  return 'READ_ONLY';
}

export const ROLE_LABELS: Record<CmsRole, string> = {
  MARKETING_ADMIN: 'Marketing Admin',
  AGENCY_EDITOR: 'Agency Marketing Editor',
  CONTRIBUTOR: 'Content Contributor',
  APPROVER: 'Approver / Manager',
  READ_ONLY: 'Read Only',
};
