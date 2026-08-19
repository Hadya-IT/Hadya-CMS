import type { BlockDef, FieldDef } from '@/lib/types';

/* ------------------------------------------------------------------
   THE SECTION CONTRACT.

   Every entry here becomes permanent API surface: once an editor uses a
   block on a live page, changing its field names requires a migration.
   Add blocks deliberately. To add one:
     1. add a BlockDef here
     2. add a matching component in src/blocks/components.tsx
     3. register it in the RENDERERS map at the bottom of that file
   Nothing in the admin needs to change — the forms are generated from
   the `fields` array below.
-------------------------------------------------------------------*/

/* Responsive column control, shared by every grid block.
   Rows are not a setting — a grid of N columns with 8 items is 4 rows.
   That is why there is no "2x4" option: set columns, add items. */
const COL_6 = ['1', '2', '3', '4', '5', '6'].map((n) => ({ label: n, value: n }));
const COL_4 = ['1', '2', '3', '4'].map((n) => ({ label: n, value: n }));
const COL_2 = ['1', '2'].map((n) => ({ label: n, value: n }));

const colsDesktop: FieldDef = { name: 'columns', label: 'Columns — desktop', type: 'select', half: true, options: COL_6 };
const colsTablet: FieldDef = { name: 'columnsTablet', label: 'Columns — tablet', type: 'select', half: true, options: COL_4 };
const colsMobile: FieldDef = { name: 'columnsMobile', label: 'Columns — mobile', type: 'select', half: true, options: COL_2 };

const alignField = {
  name: 'mediaSide',
  label: 'Media position',
  type: 'select' as const,
  half: true,
  options: [
    { label: 'Right', value: 'right' },
    { label: 'Left', value: 'left' },
  ],
};

export const BLOCKS: BlockDef[] = [
  /* ---------------------------------------------------------- HERO */
  {
    type: 'hero',
    name: 'Hero',
    group: 'Hero & banners',
    icon: '▤',
    description: 'Full-height opener with a background image, headline and footer captions.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'title', label: 'Headline', type: 'html', help: 'Use <em> for the italic accent, <br> for a line break.' },
      { name: 'subtitle', label: 'Sub-headline', type: 'textarea' },
      { name: 'image', label: 'Background image', type: 'image' },
      { name: 'height', label: 'Height (vh)', type: 'number', min: 40, max: 100, half: true },
      { name: 'kenBurns', label: 'Slow zoom on background', type: 'boolean', half: true },
      { name: 'captionTitle', label: 'Footer caption', type: 'text', half: true },
      { name: 'captionSub', label: 'Footer caption — small', type: 'text', half: true },
      { name: 'scrollLabel', label: 'Scroll hint', type: 'text', half: true },
      { name: 'ctaLabel', label: 'Button label', type: 'text', half: true },
      { name: 'ctaHref', label: 'Button link', type: 'url', half: true },
    ],
    defaultData: {
      eyebrow: 'Jeddah · Kingdom of Saudi Arabia',
      title: 'Crafting <em>enduring</em><br>landmarks in the Kingdom',
      subtitle: 'A leading real estate developer and facility manager.',
      image: '/uploads/hero.jpg',
      height: 100,
      kenBurns: true,
      captionTitle: 'Arabian heritage, reimagined.',
      captionSub: 'Jeddah, Kingdom of Saudi Arabia',
      scrollLabel: 'Scroll',
      ctaLabel: '',
      ctaHref: '',
    },
    defaultStyle: {
      theme: 'dark',
      bgType: 'none',
      paddingTop: 0,
      paddingBottom: 0,
      align: 'center',
      animation: 'fade-up',
    },
  },

  /* -------------------------------------------------- IMAGE BANNER */
  {
    type: 'imageBanner',
    name: 'Page banner',
    group: 'Hero & banners',
    icon: '▬',
    description: 'Short banner for interior pages — image, eyebrow and title.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'title', label: 'Title', type: 'html' },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { name: 'image', label: 'Background image', type: 'image' },
      { name: 'height', label: 'Height (vh)', type: 'number', min: 25, max: 90, half: true },
      { name: 'overlay', label: 'Image darkening %', type: 'number', min: 0, max: 90, half: true },
    ],
    defaultData: {
      eyebrow: '',
      title: 'Page title',
      subtitle: '',
      image: '/uploads/jameel.jpg',
      height: 52,
      overlay: 50,
    },
    defaultStyle: { theme: 'dark', paddingTop: 0, paddingBottom: 0, align: 'left', animation: 'fade-up' },
  },

  /* ----------------------------------------------------- RICH TEXT */
  {
    type: 'richText',
    name: 'Rich text',
    group: 'Text',
    icon: '¶',
    description: 'Eyebrow, heading and a body of formatted text.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'body', label: 'Body', type: 'html', help: 'Supports <p>, <strong>, <em>, <a>, <ul>, <li>.' },
      { name: 'columns', label: 'Text columns', type: 'select', half: true, options: [
        { label: 'One', value: '1' }, { label: 'Two', value: '2' },
      ]},
      { name: 'measure', label: 'Line length (ch)', type: 'number', min: 30, max: 110, half: true },
    ],
    defaultData: {
      eyebrow: 'About',
      heading: 'A heading goes <em>here.</em>',
      body: '<p>Replace this with your own copy.</p>',
      columns: '1',
      measure: 62,
    },
  },

  /* --------------------------------------------------- SPLIT / LEGACY */
  {
    type: 'splitFeature',
    name: 'Split feature',
    group: 'Text',
    icon: '◨',
    description: 'Statement + body + inline stats on one side, an angled image on the other.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'statement', label: 'Statement', type: 'html' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'image', label: 'Image', type: 'image' },
      { name: 'imageCaption', label: 'Image caption', type: 'text', half: true },
      { name: 'imageSub', label: 'Image caption — small', type: 'text', half: true },
      alignField,
      { name: 'tilt', label: '3D tilt on image', type: 'boolean', half: true },
      { name: 'showFlowLine', label: 'Decorative flowing line', type: 'boolean', half: true },
      {
        name: 'stats', label: 'Stats', type: 'array', itemLabel: 'Stat', max: 6,
        fields: [
          { name: 'value', label: 'Value', type: 'text', half: true },
          { name: 'label', label: 'Label', type: 'text', half: true },
        ],
      },
    ],
    defaultData: {
      eyebrow: 'Our Legacy',
      statement: 'A statement about <em>what you build.</em>',
      body: 'Supporting paragraph.',
      image: '/uploads/jameel.jpg',
      imageCaption: 'Jameel Square',
      imageSub: 'Commercial · Jeddah',
      mediaSide: 'right',
      tilt: true,
      showFlowLine: true,
      stats: [
        { value: '2009', label: 'Founding flagship' },
        { value: '7', label: 'Flagship developments' },
      ],
    },
  },

  /* ------------------------------------------------------ STATS BAND */
  {
    type: 'statsBand',
    name: 'Stats band',
    group: 'Text',
    icon: '№',
    description: 'A row of numbers with labels.',
    fields: [
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'columns', label: 'Columns', type: 'select', half: true, options: [
        { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' },
      ]},
      { name: 'divider', label: 'Top divider line', type: 'boolean', half: true },
      {
        name: 'items', label: 'Stats', type: 'array', itemLabel: 'Stat', min: 2, max: 8,
        fields: [
          { name: 'value', label: 'Value', type: 'text', half: true },
          { name: 'label', label: 'Label', type: 'text', half: true },
        ],
      },
    ],
    defaultData: {
      heading: '',
      columns: '4',
      divider: true,
      items: [
        { value: '2009', label: 'Founded' },
        { value: '7', label: 'Developments' },
        { value: '287', label: 'Residential units' },
        { value: '161', label: 'Hotel keys' },
      ],
    },
  },

  /* -------------------------------------------------------- CARD GRID */
  {
    type: 'cardGrid',
    name: 'Card grid',
    group: 'Grids & cards',
    icon: '▦',
    description: 'Numbered cards with an image, title and short body. Used for sectors / services.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      colsDesktop, colsTablet, colsMobile,
      { name: 'showNumbers', label: 'Show 01 / 02 numbering', type: 'boolean', half: true },
      { name: 'ratio', label: 'Image ratio', type: 'select', half: true, options: [
        { label: 'Portrait 3:4', value: '3/4' },
        { label: 'Square 1:1', value: '1/1' },
        { label: 'Landscape 4:3', value: '4/3' },
        { label: 'Tall 2:3', value: '2/3' },
      ]},
      { name: 'headingSide', label: 'Heading layout', type: 'select', half: true, options: [
        { label: 'Heading left, eyebrow right', value: 'split' },
        { label: 'Stacked', value: 'stacked' },
      ]},
      {
        name: 'items', label: 'Cards', type: 'array', itemLabel: 'Card', min: 1, max: 12,
        fields: [
          { name: 'image', label: 'Image', type: 'image' },
          { name: 'title', label: 'Title', type: 'text' },
          { name: 'body', label: 'Body', type: 'textarea' },
          { name: 'href', label: 'Link (optional)', type: 'url' },
        ],
      },
    ],
    defaultData: {
      eyebrow: 'Capabilities · 01 — 04',
      heading: 'Four disciplines. <em>One standard.</em>',
      columns: '4', columnsTablet: '2', columnsMobile: '1',
      showNumbers: true,
      ratio: '3/4',
      headingSide: 'split',
      items: [
        { image: '/uploads/diyar.jpg', title: 'Residential', body: 'Communities and residences designed for elevated, multi-generational living.', href: '' },
      ],
    },
  },

  /* ----------------------------------------------------- PRODUCT GRID */
  {
    type: 'productGrid',
    name: 'Product / card grid',
    group: 'Grids & cards',
    icon: '▥',
    description: 'Flexible card grid. Text below the image, or over it. 1–6 columns.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      colsDesktop, colsTablet, colsMobile,
      { name: 'cardStyle', label: 'Card layout', type: 'select', half: true, options: [
        { label: 'Text below image', value: 'below' },
        { label: 'Text below, in a box', value: 'boxed' },
        { label: 'Text over image', value: 'overlay' },
        { label: 'Text over image, bottom', value: 'overlay-bottom' },
        { label: 'Text over image, on hover', value: 'overlay-hover' },
      ]},
      { name: 'ratio', label: 'Image shape', type: 'select', half: true, options: [
        { label: 'Square 1:1', value: '1/1' },
        { label: 'Portrait 3:4', value: '3/4' },
        { label: 'Tall 2:3', value: '2/3' },
        { label: 'Landscape 4:3', value: '4/3' },
        { label: 'Wide 3:2', value: '3/2' },
        { label: 'Cinematic 16:9', value: '16/9' },
      ]},
      { name: 'overlayStrength', label: 'Image darkening under text %', type: 'number', min: 0, max: 90, half: true },
      { name: 'hoverZoom', label: 'Zoom image on hover', type: 'boolean', half: true },
      { name: 'showTag', label: 'Show tag line', type: 'boolean', half: true },
      { name: 'showBody', label: 'Show description', type: 'boolean', half: true },
      { name: 'showPrice', label: 'Show price / meta', type: 'boolean', half: true },
      { name: 'ctaLabel', label: 'Card link label (blank = none)', type: 'text', half: true },
      {
        name: 'items', label: 'Cards', type: 'array', itemLabel: 'Card', min: 1, max: 36,
        fields: [
          { name: 'image', label: 'Image', type: 'image' },
          { name: 'title', label: 'Title', type: 'text' },
          { name: 'tag', label: 'Tag line', type: 'text', half: true },
          { name: 'price', label: 'Price / meta', type: 'text', half: true },
          { name: 'body', label: 'Description', type: 'textarea' },
          { name: 'href', label: 'Link', type: 'url' },
        ],
      },
    ],
    defaultData: {
      eyebrow: '',
      heading: 'Our offering',
      columns: '3', columnsTablet: '2', columnsMobile: '1',
      cardStyle: 'below',
      ratio: '1/1',
      overlayStrength: 45,
      hoverZoom: true,
      showTag: true, showBody: true, showPrice: false,
      ctaLabel: '',
      items: [
        { image: '/uploads/diyar.jpg', title: 'Card one', tag: 'Category', price: '', body: 'A short description of this card.', href: '' },
        { image: '/uploads/movenpick.jpg', title: 'Card two', tag: 'Category', price: '', body: 'A short description of this card.', href: '' },
        { image: '/uploads/jameel.jpg', title: 'Card three', tag: 'Category', price: '', body: 'A short description of this card.', href: '' },
      ],
    },
  },

  /* -------------------------------------------------------- WORK GRID */
  {
    type: 'workGrid',
    name: 'Project grid',
    group: 'Grids & cards',
    icon: '▧',
    description: 'Staggered two-column portfolio grid with kicker, year and title.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'ctaLabel', label: 'Button label', type: 'text', half: true },
      { name: 'ctaHref', label: 'Button link', type: 'url', half: true },
      colsDesktop, colsTablet, colsMobile,
      { name: 'stagger', label: 'Stagger alternate cards', type: 'boolean', half: true },
      {
        name: 'items', label: 'Projects', type: 'array', itemLabel: 'Project', min: 1, max: 24,
        fields: [
          { name: 'image', label: 'Image', type: 'image' },
          { name: 'kicker', label: 'Category · location', type: 'text', half: true },
          { name: 'meta', label: 'Year / metric', type: 'text', half: true },
          { name: 'title', label: 'Project name', type: 'text' },
          { name: 'href', label: 'Link (optional)', type: 'url' },
        ],
      },
    ],
    defaultData: {
      eyebrow: 'Selected Works',
      heading: 'Landmarks in <em>the making.</em>',
      ctaLabel: 'View Archive',
      ctaHref: '/contact-us',
      columns: '2', columnsTablet: '2', columnsMobile: '1',
      stagger: true,
      items: [],
    },
    defaultStyle: { theme: 'dark' },
  },

  /* ----------------------------------------------------------- PROFILE */
  {
    type: 'profile',
    name: 'Leader profile',
    group: 'Grids & cards',
    icon: '☖',
    description: 'Copy on one side, a portrait with name and role on the other.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'image', label: 'Portrait', type: 'image' },
      { name: 'label', label: 'Portrait label', type: 'text', half: true },
      { name: 'name', label: 'Name', type: 'text', half: true },
      { name: 'role', label: 'Role', type: 'text', half: true },
      alignField,
    ],
    defaultData: {
      eyebrow: 'Our Team',
      heading: 'An approach that focuses on <em>leadership.</em>',
      body: 'Supporting paragraph about the team.',
      image: '/uploads/ceo.jpg',
      label: 'Executive Management',
      name: 'Mr. Osama El Haddad',
      role: 'President',
      mediaSide: 'right',
    },
    defaultStyle: { theme: 'brand' },
  },

  /* -------------------------------------------------------- LINK CARDS */
  {
    type: 'linkCards',
    name: 'Link cards',
    group: 'Grids & cards',
    icon: '▤',
    description: 'Bordered cards that link out — news, newsletters, downloads.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'description', label: 'Description', type: 'textarea' },
      colsDesktop, colsTablet, colsMobile,
      { name: 'readLabel', label: 'Link label', type: 'text', half: true },
      {
        name: 'items', label: 'Cards', type: 'array', itemLabel: 'Card', min: 1, max: 24,
        fields: [
          { name: 'kicker', label: 'Kicker', type: 'text', half: true },
          { name: 'href', label: 'Link', type: 'url', half: true },
          { name: 'title', label: 'Title', type: 'text' },
        ],
      },
    ],
    defaultData: {
      eyebrow: 'Our News',
      heading: 'Newsletters & updates.',
      description: 'Quarterly newsletters covering our projects, milestones and market activity.',
      columns: '3', columnsTablet: '2', columnsMobile: '1',
      readLabel: 'Read →',
      items: [],
    },
  },

  /* ----------------------------------------------------------- GALLERY */
  {
    type: 'gallery',
    name: 'Gallery',
    group: 'Media',
    icon: '▩',
    description: 'A simple image grid with optional captions.',
    fields: [
      { name: 'heading', label: 'Heading', type: 'html' },
      colsDesktop, colsTablet, colsMobile,
      { name: 'ratio', label: 'Image ratio', type: 'select', half: true, options: [
        { label: 'Landscape 4:3', value: '4/3' },
        { label: 'Square 1:1', value: '1/1' },
        { label: 'Portrait 3:4', value: '3/4' },
        { label: 'Wide 16:9', value: '16/9' },
      ]},
      {
        name: 'items', label: 'Images', type: 'array', itemLabel: 'Image', min: 1, max: 30,
        fields: [
          { name: 'image', label: 'Image', type: 'image' },
          { name: 'caption', label: 'Caption', type: 'text' },
        ],
      },
    ],
    defaultData: { heading: '', columns: '3', columnsTablet: '2', columnsMobile: '2', ratio: '4/3', items: [] },
  },

  /* --------------------------------------------------------- ACCORDION */
  {
    type: 'accordion',
    name: 'Accordion / FAQ',
    group: 'Text',
    icon: '≣',
    description: 'Expandable question and answer rows.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      {
        name: 'items', label: 'Rows', type: 'array', itemLabel: 'Row', min: 1, max: 30,
        fields: [
          { name: 'q', label: 'Question', type: 'text' },
          { name: 'a', label: 'Answer', type: 'html' },
        ],
      },
    ],
    defaultData: { eyebrow: '', heading: 'Frequently asked', items: [{ q: 'Question', a: '<p>Answer.</p>' }] },
  },

  /* ---------------------------------------------------------- CTA BAND */
  {
    type: 'ctaBand',
    name: 'CTA band',
    group: 'Conversion',
    icon: '➜',
    description: 'A full-width call to action with an optional background image.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'buttonLabel', label: 'Button label', type: 'text', half: true },
      { name: 'buttonHref', label: 'Button link', type: 'url', half: true },
      { name: 'newTab', label: 'Open in new tab', type: 'boolean', half: true },
      { name: 'layout', label: 'Layout', type: 'select', half: true, options: [
        { label: 'Text left, button right', value: 'split' },
        { label: 'Centred', value: 'centred' },
      ]},
    ],
    defaultData: {
      eyebrow: 'Careers',
      heading: 'Build something that <em>endures.</em>',
      body: 'If you share our standards, we would like to hear from you.',
      buttonLabel: 'Apply for a job →',
      buttonHref: 'https://careers.hadya.com/',
      newTab: true,
      layout: 'split',
    },
    defaultStyle: { theme: 'dark', bgType: 'image', bgImage: '/uploads/plaza.jpg', bgOverlay: 72 },
  },

  /* ----------------------------------------------------------- CONTACT */
  {
    /* The standalone form block. `contact` still exists and still carries
       its own enquiry form — this one exists for the case that block cannot
       serve: a form on a careers or RFP page with no address panel attached.
       The dropdown is populated from the forms built in /admin/forms. */
    type: 'form',
    name: 'Form',
    group: 'Conversion',
    icon: '▢',
    description: 'Any form you built in Forms, with an optional heading and intro.',
    fields: [
      {
        name: 'formId',
        label: 'Which form',
        type: 'text',
        help: 'The form ID from the Forms screen. Leave blank to use the first form.',
      },
      { name: 'eyebrow', label: 'Eyebrow', type: 'text', half: true },
      { name: 'formLabel', label: 'Label above the fields', type: 'text', half: true },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'intro', label: 'Intro text', type: 'html' },
      { name: 'narrow', label: 'Constrain form width', type: 'boolean', half: true },
    ],
    defaultData: {
      formId: '',
      eyebrow: 'Get in touch',
      heading: 'Tell us about your <em>project.</em>',
      intro: '',
      formLabel: '',
      narrow: true,
    },
  },
  {
    type: 'contact',
    name: 'Contact',
    group: 'Conversion',
    icon: '✉',
    description: 'Address, inquiries, an optional map and an optional enquiry form.',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'html' },
      { name: 'hqLabel', label: 'Address label', type: 'text', half: true },
      { name: 'inquiriesLabel', label: 'Inquiries label', type: 'text', half: true },
      { name: 'address', label: 'Address', type: 'html', help: 'Use <br> for line breaks.' },
      { name: 'email', label: 'Email', type: 'text', half: true },
      { name: 'phone', label: 'Phone', type: 'text', half: true },
      { name: 'mapEmbed', label: 'Map embed URL', type: 'url' },
      { name: 'showMap', label: 'Show map', type: 'boolean', half: true },
      { name: 'showForm', label: 'Show enquiry form', type: 'boolean', half: true },
      { name: 'formLabel', label: 'Form label', type: 'text', half: true },
      { name: 'formButton', label: 'Form button', type: 'text', half: true },
    ],
    defaultData: {
      eyebrow: 'Get in touch',
      heading: "Let's discuss the <em>next landmark.</em>",
      hqLabel: 'Headquarters',
      inquiriesLabel: 'Inquiries',
      address: "Muhyi Ad Din An Nadhir, Al Ham'mra<br>Jeddah 23212, Kingdom of Saudi Arabia<br>P.O. Box 15496",
      email: 'info@hadya.com',
      phone: '+966 12 6010 300',
      mapEmbed: 'https://www.google.com/maps?q=Jameel%20Square%20Tahlia%20Jeddah%20Saudi%20Arabia&output=embed',
      showMap: true,
      showForm: true,
      formLabel: 'Send us an email',
      formButton: 'Send message',
    },
  },
];

export const BLOCK_MAP: Record<string, BlockDef> = Object.fromEntries(
  BLOCKS.map((b) => [b.type, b]),
);

export const BLOCK_GROUPS = Array.from(new Set(BLOCKS.map((b) => b.group)));
