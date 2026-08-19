/* ------------------------------------------------------------------
   Core data model.
   Everything the admin can control is expressed here.
-------------------------------------------------------------------*/

/* ---------------- locales ---------------- */

export type Locale = 'en' | 'ar';

export const LOCALES: { code: Locale; label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
];

export interface LocaleSettings {
  /** Locales the site serves. The first is the default and is never prefixed. */
  enabled: Locale[];
  /** Show the language switch in the header. */
  showSwitch: boolean;
}

/* ---------------- form builder ---------------- */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'date';

export interface FormFieldDef {
  id: string;
  /** Stable machine name. Becomes the key in the stored answers JSON, so
   *  renaming it orphans historical submissions — treat as permanent. */
  name: string;
  label: string;
  labelAr?: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  /** For select. */
  options?: string[];
  maxLength?: number;
  half?: boolean;
  /** Maps this answer onto a Dynamics lead attribute (firstname,
   *  emailaddress1, telephone1, companyname, subject, description).
   *  Anything unmapped is appended to the lead description. */
  crmField?: string;
}

export interface FormDef {
  id: string;
  name: string;
  fields: FormFieldDef[];
  submitLabel: string;
  submitLabelAr?: string;
  successMessage: string;
  successMessageAr?: string;
  /** Extra recipients for this form, on top of the site-wide list. */
  notifyEmails?: string[];
  /** Push submissions to Dynamics as leads. */
  crmPush?: boolean;
  /** PDPL consent line shown above the button. Empty = no checkbox. */
  consentText?: string;
  consentTextAr?: string;
}

/* ---------------- redirects ---------------- */

export interface RedirectRule {
  id: string;
  /** Source path, leading slash, no origin. e.g. /old-about */
  from: string;
  /** Destination path or absolute URL. */
  to: string;
  /** 308 when true, 307 when false. */
  permanent?: boolean;
}

export type AnimationPreset =
  | 'none'
  | 'fade-in'
  | 'fade-up'
  | 'fade-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'blur-in'
  | 'stagger';

export type FontKey = '' | 'serif' | 'sans' | 'arabicSerif' | 'arabicSans' | 'mono';

export type ThemeKey = 'light' | 'dark' | 'brand' | 'custom';

/** The style envelope is attached to EVERY block and to every page.
 *  This is what gives the admin colour / size / spacing / font control
 *  without letting them invent layouts. */
export interface StyleEnvelope {
  theme: ThemeKey;

  /* background */
  bgType: 'none' | 'color' | 'image' | 'gradient';
  bgColor?: string;
  bgColor2?: string;      // gradient stop 2
  bgGradientAngle?: number;
  bgImage?: string;       // /uploads/xxx.jpg
  bgPosition?: string;    // e.g. "center", "center 20%"
  bgOverlay?: number;     // 0-100 darkening veil over image
  bgFixed?: boolean;      // parallax-ish attachment

  /* colour */
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  borderColor?: string;

  /* typography */
  bodyFont?: FontKey;
  headingFont?: FontKey;
  bodyScale?: number;      // multiplier, 0.75 – 1.6
  headingScale?: number;   // multiplier, 0.6 – 2.0
  letterSpacing?: number;  // em, -0.05 – 0.4
  lineHeight?: number;     // 1.0 – 2.2
  uppercaseHeadings?: boolean;

  /* spacing + layout */
  paddingTop?: number;     // px
  paddingBottom?: number;  // px
  gap?: number;            // px, grid/flex gap inside the block
  maxWidth?: number;       // px content width
  align?: 'left' | 'center' | 'right';
  radius?: number;         // px, applied to media inside the block

  /* motion */
  animation: AnimationPreset;
  animationDuration?: number; // ms
  animationDelay?: number;    // ms

  /* visibility */
  hidden?: boolean;
  hideOnMobile?: boolean;
}

export interface Block {
  id: string;
  type: string;                 // key into the block registry
  label?: string;               // admin-only nickname
  style: StyleEnvelope;
  data: Record<string, any>;
}

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  noIndex?: boolean;
}


/** Frozen copy of a page as it looked the last time it was published.
 *  Public visitors are served this while the working copy is in draft.
 *  Written ONLY by the server (api/content PUT) - never by the browser. */
export interface PublishedSnapshot {
  title: string;
  slug: string;
  navLabel?: string;
  showInNav: boolean;
  navOrder: number;
  seo: PageSeo;
  style: StyleEnvelope;
  blocks: Block[];
  i18n?: Partial<Record<Locale, PageTranslation>>;
  publishedAt: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;                 // '' === home
  navLabel?: string;
  showInNav: boolean;
  navOrder: number;
  status: 'draft' | 'published';
  seo: PageSeo;
  style: StyleEnvelope;         // page-level background / fonts / colours
  blocks: Block[];
  updatedAt: string;
  /** Per-locale overlay. English is the canonical document; a locale only
   *  stores the fields that were actually translated, and anything missing
   *  falls through to the English value at render time. */
  i18n?: Partial<Record<Locale, PageTranslation>>;
  /** Last published state; survives the page being switched back to draft. */
  lastPublished?: PublishedSnapshot;
}

export interface PageTranslation {
  title?: string;
  navLabel?: string;
  seo?: { title?: string; description?: string };
  /** blockId -> fieldName -> translated value */
  blocks?: Record<string, Record<string, string>>;
}

export interface MediaVariant {
  width: number;
  url: string;
  objectName?: string;
  format: 'webp' | 'jpeg' | 'png';
  size?: number;
}

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
  alt?: string;
  altAr?: string;
  objectName?: string;
  /** Intrinsic dimensions of the original, when they could be read. */
  width?: number;
  height?: number;
  /** Derived responsive renditions, narrowest first. Absent on files
   *  uploaded before image optimisation existed, and on SVG/GIF. */
  variants?: MediaVariant[];
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
  external?: boolean;
}

export interface SiteSettings {
  brandName: string;
  brandTagline: string;
  logoLight: string;            // shown on dark backgrounds
  logoDark: string;             // shown on light backgrounds
  favicon: string;

  /* global design tokens — every block inherits from these */
  tokens: {
    cream: string;
    creamAlt: string;
    ink: string;
    inkSoft: string;
    gold: string;
    goldSoft: string;
    navy: string;
    line: string;
    serifFamily: string;
    sansFamily: string;
    arabicSerifFamily: string;
    arabicSansFamily: string;
    baseFontSize: number;
    contentWidth: number;
    radius: number;
  };

  header: {
    sticky: boolean;
    transparentOnHero: boolean;
    showLangSwitch: boolean;
    ctaLabel: string;
    ctaHref: string;
  };

  footer: {
    copy: string;
    links: NavLink[];
    showBrand: boolean;
  };

  /** Analytics wiring. The container ID lives in settings rather than env so
   *  marketing can change it without a redeploy. */
  analytics?: {
    gtmId?: string;
    ga4MeasurementId?: string;
  };

  /** Locale configuration. Absent = English only. */
  locales?: LocaleSettings;

  /** Site-wide strings that are not attached to a page. */
  i18n?: Partial<
    Record<
      Locale,
      {
        brandTagline?: string;
        headerCtaLabel?: string;
        footerCopy?: string;
        navLabels?: Record<string, string>;
      }
    >
  >;

  /** Cookie / tracking consent banner. Gates GTM before it loads. */
  consent?: {
    enabled: boolean;
    title: string;
    body: string;
    titleAr?: string;
    bodyAr?: string;
    acceptLabel: string;
    rejectLabel: string;
    policyLabel?: string;
    policyHref?: string;
  };

  /** Where new form submissions are emailed. */
  notifications?: {
    enabled: boolean;
    leadRecipients: string[];
    /** Blind-copy the submitter with a confirmation. */
    confirmToSubmitter?: boolean;
  };

  /** Editor-managed redirects, applied on the public site. */
  redirects?: RedirectRule[];

  splash: {
    enabled: boolean;
    word: string;
    sub: string;
    durationMs: number;
  };

  navExtra: NavLink[];          // links added by hand, on top of pages flagged showInNav
}

export interface ContentDoc {
  settings: SiteSettings;
  pages: Page[];
  media: MediaItem[];
  /** Editor-defined forms. Absent on documents saved before the form
   *  builder existed; readContent() normalises it to []. */
  forms?: FormDef[];
  version: number;
}

/* ---------------- admin form schema ---------------- */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'html'
  | 'number'
  | 'boolean'
  | 'select'
  | 'color'
  | 'image'
  | 'url'
  | 'array';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  fields?: FieldDef[];          // for arrays
  itemLabel?: string;           // for arrays
  defaultValue?: any;
  half?: boolean;               // render at half width
}

export interface BlockDef {
  type: string;
  name: string;
  group: 'Hero & banners' | 'Text' | 'Grids & cards' | 'Media' | 'Conversion';
  description: string;
  icon: string;
  fields: FieldDef[];
  defaultData: Record<string, any>;
  defaultStyle?: Partial<StyleEnvelope>;
}
