/* ------------------------------------------------------------------
   In-app help.

   Written for someone who has never seen a CMS. Kept as data rather than
   MDX so it is searchable, linkable by id, and can be surfaced next to
   the screen it describes without a second rendering pipeline.

   Rule for editing: describe what the editor sees, not what the code
   does. If a step cannot be followed by clicking, it does not belong.
-------------------------------------------------------------------*/

export interface GuideStep {
  do: string;
  note?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  audience: 'everyone' | 'admin';
  steps?: GuideStep[];
  body?: string[];
  table?: { head: string[]; rows: string[][] };
  warn?: string;
}

export interface GuideTopic {
  id: string;
  title: string;
  blurb: string;
  sections: GuideSection[];
}

export const GUIDE: GuideTopic[] = [
  /* ═══════════════════════════════════════════════ start here */
  {
    id: 'start',
    title: 'Start here',
    blurb: 'What this system is and the five things you will actually do.',
    sections: [
      {
        id: 'model',
        title: 'How the site is put together',
        summary: 'Three levels: pages, sections, and the fields inside them.',
        audience: 'everyone',
        body: [
          'A **page** is one address on the website — `/about-us`, `/contact-us`. Every page has its own entry in the Pages list.',
          'A **section** is a horizontal band on that page — a hero image, a block of text, a grid of cards. Pages are built by stacking sections. You choose from a library of ready-made section types; you cannot invent a new layout, which is deliberate: it is what keeps every page looking like it belongs to the same website.',
          'A **field** is one piece of content in a section — a heading, an image, a card title. Fields are what you edit day to day.',
        ],
      },
      {
        id: 'screens',
        title: 'The four columns on the Pages screen',
        summary: 'Left to right: pages, sections, the editor, the preview.',
        audience: 'everyone',
        table: {
          head: ['Column', 'What it does'],
          rows: [
            ['Pages', 'Every page on the site. Click one to open it.'],
            ['Sections', 'The bands making up that page, top to bottom. Click one to edit it.'],
            ['Editor', 'Three tabs — Page, Content, Design. This is where you type.'],
            ['Preview', 'The live page. Shows saved work only, so press Save & refresh.'],
          ],
        },
      },
      {
        id: 'save',
        title: 'Save is publish',
        summary: 'There is no separate publish button. Read this before editing a live page.',
        audience: 'everyone',
        warn: 'On a page that is already published, pressing Save puts your change in front of visitors immediately. There is no staging copy and no approval step.',
        body: [
          'To work safely on a live page, duplicate it first (the ⧉ button next to the page name). The copy is created as a draft. Edit the copy, check it, then swap the slugs.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ pages */
  {
    id: 'pages',
    title: 'Pages',
    blurb: 'Creating, publishing, renaming and deleting pages.',
    sections: [
      {
        id: 'add-page',
        title: 'Add a page',
        summary: 'Four fields and a save.',
        audience: 'everyone',
        steps: [
          { do: 'Open **Pages** and press **+ New** at the top of the left column.' },
          { do: 'In the **Page** tab, type the **Page title**.', note: 'This shows in the browser tab and search results.' },
          { do: 'Set the **URL slug** — lowercase, hyphens between words, no slash at the front.', note: 'Type `new-projects`, not `/New Projects`. Match the style of the existing pages.' },
          { do: 'Set **Status** to **Published**.', note: 'New pages start as Draft, which returns a 404 to visitors.' },
          { do: 'Turn on **Show in main menu** and set a **Menu order** number if you want it in the navigation.', note: 'Publishing alone does not add it to the menu — these are separate.' },
          { do: 'Press **Save changes** at the top right.' },
        ],
      },
      {
        id: 'publish',
        title: 'Publish a draft',
        summary: 'Change one dropdown.',
        audience: 'everyone',
        steps: [
          { do: 'Select the page, open the **Page** tab.' },
          { do: 'Change **Status** from Draft to Published.', note: 'Status sits near the top, under the URL slug. If you are looking at sliders you have scrolled too far.' },
          { do: 'Press **Save changes**. It is live instantly.' },
        ],
      },
      {
        id: 'slug',
        title: 'Changing a URL after publishing',
        summary: 'Avoid it. There is no redirect manager.',
        audience: 'everyone',
        warn: 'Changing the slug of a published page breaks every existing link to it — bookmarks, emails, search results, anything printed. The old address returns a 404 and nothing forwards.',
        body: ['Get the slug right before you publish. If you must change one, expect to update every place it was shared.'],
      },
      {
        id: 'seo',
        title: 'Search engine fields',
        summary: 'Title, description and share image, per page.',
        audience: 'everyone',
        body: [
          '**SEO title** — what Google shows as the blue clickable line. Around 60 characters.',
          '**Meta description** — the grey text beneath it. Around 155 characters. It does not affect ranking but it does affect whether people click.',
          '**Share image** — the picture that appears when the link is pasted into WhatsApp, LinkedIn or Teams. Landscape works best.',
          '**Hide from search engines** — use for pages that exist but should not be found, like a demo or a page only reachable by link.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ sections */
  {
    id: 'sections',
    title: 'Sections',
    blurb: 'Adding, ordering, hiding and filling in the bands of a page.',
    sections: [
      {
        id: 'add-section',
        title: 'Add a section',
        summary: 'Pick a type, fill the fields, save.',
        audience: 'everyone',
        steps: [
          { do: 'Select the page, then press **+ Add section**.' },
          { do: 'Pick a type from the library. They are grouped — Hero & banners, Text, Grids & cards, Media, Conversion.' },
          { do: 'It appears at the bottom of the page and opens on the **Content** tab.' },
          { do: 'Fill in the fields, then **Save changes**.' },
          { do: 'Press **Save & refresh** above the preview to see it.' },
        ],
      },
      {
        id: 'reorder',
        title: 'Reorder, copy, hide, delete',
        summary: 'Hover a section in the middle column for the buttons.',
        audience: 'everyone',
        table: {
          head: ['Button', 'Does'],
          rows: [
            ['↑ ↓', 'Move the section up or down the page'],
            ['⧉', 'Duplicate it, directly below'],
            ['×', 'Delete it — no undo once you save'],
          ],
        },
        body: [
          'To hide a section without losing it, open the **Design** tab and switch on **Hide this section**. It stays in the list, greyed out, and disappears from the website. Better than deleting anything seasonal.',
        ],
      },
      {
        id: 'library',
        title: 'What each section type is for',
        summary: 'Fourteen types. Most pages use four or five.',
        audience: 'everyone',
        table: {
          head: ['Section', 'Use it for'],
          rows: [
            ['Hero', 'Full-screen opener with a background image. One per page, at the top.'],
            ['Page banner', 'Shorter version for interior pages.'],
            ['Rich text', 'Paragraphs of writing with a heading.'],
            ['Split feature', 'A statement on one side, an angled image on the other.'],
            ['Stats band', 'A row of numbers — founded, units, keys.'],
            ['Card grid', 'Numbered cards with images. Sectors, services, capabilities.'],
            ['Product / card grid', 'Flexible cards, 1–6 columns, text below or over the image.'],
            ['Project grid', 'Staggered portfolio layout with category and year.'],
            ['Leader profile', 'Copy beside a portrait with a name and role.'],
            ['Link cards', 'Bordered cards that link out — news, downloads.'],
            ['Gallery', 'A plain grid of images.'],
            ['Accordion / FAQ', 'Expandable question and answer rows.'],
            ['CTA band', 'Full-width call to action with a button.'],
            ['Contact', 'Address, map and the enquiry form.'],
          ],
        },
      },
      {
        id: 'grids',
        title: 'Grid columns',
        summary: 'You set columns. Rows come from how many items you add.',
        audience: 'everyone',
        body: [
          'There is no "2×4" setting. A grid of 2 columns with 8 cards **is** 2×4. Set the column count, then add cards until it looks right.',
          '**2×2** — 2 columns, 4 cards. **4×4** — 4 columns, 16 cards.',
          'Every grid has three separate column settings: desktop, tablet and mobile. Four across on a laptop should usually be two on a tablet and one on a phone. Six across on a phone is unreadable.',
        ],
      },
      {
        id: 'card-layouts',
        title: 'Card layouts',
        summary: 'Five ways to combine an image and its text.',
        audience: 'everyone',
        table: {
          head: ['Layout', 'Looks like'],
          rows: [
            ['Text below image', 'Plain — image, then title and description underneath'],
            ['Text below, in a box', 'The same, inside a bordered card that lifts on hover'],
            ['Text over image', 'Centred on top of a darkened photo'],
            ['Text over image, bottom', 'Sitting at the base over a gradient — good for names and prices'],
            ['Text over image, on hover', 'Photo only until the mouse is over it, then text fades in'],
          ],
        },
        body: [
          'The hover version shows its text permanently on phones and tablets, because there is no hover on a touchscreen.',
          'Fastest way to choose: add the section, then change the dropdown and press Save & refresh between each.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ design */
  {
    id: 'design',
    title: 'Design tab',
    blurb: 'Colour, type, spacing and animation. Optional — ignore it if the defaults look right.',
    sections: [
      {
        id: 'design-what',
        title: 'What you can and cannot change',
        summary: 'You control the look of a section, not its layout.',
        audience: 'everyone',
        body: [
          'The Design tab changes the **appearance** of one section — background, colours, font sizes, spacing, animation.',
          'It cannot rearrange what is inside a section. That is on purpose. Layout stays with the section type so pages cannot drift apart, and so nothing breaks on a phone.',
          'If you need a layout that does not exist, that is a request for a new section type, not a design change.',
        ],
      },
      {
        id: 'design-groups',
        title: 'The groups, and which ones matter',
        summary: 'Three of them cover almost every real request.',
        audience: 'everyone',
        table: {
          head: ['Group', 'Use when'],
          rows: [
            ['Theme & background', 'A section should be light, dark, or sit on a photo. The most useful control here.'],
            ['Spacing & layout', 'Two sections are crowded, or a band feels too tall. Adjust Space above / below.'],
            ['Animation', 'You want the section to arrive differently as it scrolls into view.'],
            ['Colour', 'One section needs to break the palette. Use sparingly.'],
            ['Typography', 'A heading is too large or too small for its content.'],
            ['Visibility', 'Hide a section, or hide it only on phones.'],
          ],
        },
      },
      {
        id: 'design-tips',
        title: 'Things that go wrong',
        summary: 'Four fixes for four common confusions.',
        audience: 'everyone',
        body: [
          '**Cards are too tight together** — that is *Gap between items* on the Design tab, not the Content tab.',
          '**Content width and Corner radius show 0** — zero means "use the site default". It is not broken.',
          '**The section vanished** — check Design → Visibility → Hide this section.',
          '**Text is unreadable on a photo** — raise *Image darkening %* rather than changing the text colour.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ media */
  {
    id: 'media',
    title: 'Images',
    blurb: 'Uploading, reusing and replacing pictures.',
    sections: [
      {
        id: 'upload',
        title: 'Add an image',
        summary: 'Two ways in.',
        audience: 'everyone',
        steps: [
          { do: 'In any image field, press **Upload** to add a new file, or **Choose** to pick one already in the library.' },
          { do: 'Or open **Media** in the sidebar and upload several at once, then choose them later.' },
        ],
        body: [
          'Accepted: JPG, PNG, WebP, GIF, SVG, AVIF. Maximum 10 MB.',
          'Resize before uploading. A 6 MB photo straight from a camera will load slowly on a phone; 1600–2400 pixels wide is plenty for a full-width background.',
        ],
      },
      {
        id: 'delete-image',
        title: 'Deleting images',
        summary: 'Check where it is used first.',
        audience: 'everyone',
        warn: 'Deleting a file from the Media library does not remove it from pages that use it. Those sections will show a broken image. Replace it in the sections first, then delete.',
      },
    ],
  },

  /* ═══════════════════════════════════════════════ leads */
  {
    id: 'leads',
    title: 'Submissions',
    blurb: 'Enquiries from the website contact form.',
    sections: [
      {
        id: 'leads-read',
        title: 'Reading the status column',
        summary: 'Whether the enquiry reached the CRM.',
        audience: 'everyone',
        table: {
          head: ['Status', 'Means'],
          rows: [
            ['In Dynamics', 'Saved here and pushed to the CRM. Nothing to do.'],
            ['Stored here', 'Saved here. No CRM is connected, so follow up from this screen.'],
            ['Sending', 'Being pushed right now. Refresh in a moment.'],
            ['Not sent', 'Saved here but the CRM rejected it. The enquiry is safe — someone needs to look at the error.'],
          ],
        },
        body: [
          'The enquiry is written down before any CRM push is attempted. A CRM outage can never lose an enquiry, and the visitor never sees an error.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ analytics */
  {
    id: 'analytics',
    title: 'Analytics',
    blurb: 'What the numbers mean — and why they are currently invented.',
    sections: [
      {
        id: 'sample-warning',
        title: 'The figures are sample data',
        summary: 'Nothing on the Analytics screen is a measurement of your site yet.',
        audience: 'everyone',
        warn: 'Until a Google Tag Manager container and a GA4 property are connected, every number on the Analytics screen is fabricated. Do not use it for reporting, budget decisions, or anything a client or the board will see.',
        body: [
          'It exists so the screen can be reviewed and agreed before the real connection is made. A red banner and a diagonal watermark appear on the page while it is in this state, so a screenshot cannot lose the warning.',
        ],
      },
      {
        id: 'terms',
        title: 'What the words mean',
        summary: 'Plain definitions for the metrics on the screen.',
        audience: 'everyone',
        table: {
          head: ['Term', 'Meaning'],
          rows: [
            ['Session', 'One visit. The same person returning tomorrow is a second session.'],
            ['User', 'One person, counted by browser. Phone and laptop count as two.'],
            ['Bounce rate', 'Share of visits that saw one page and did nothing. Lower is better.'],
            ['Conversion rate', 'Share of visits that submitted the form. 1–3% is normal for a corporate site.'],
            ['Impressions', 'Times an ad was shown. Not clicks.'],
            ['CTR', 'Clicks ÷ impressions. How compelling the ad is.'],
            ['CPC', 'Average cost of one click.'],
            ['Cost per lead', 'Ad spend ÷ form submissions. The number the budget argument turns on.'],
            ['Event', 'A tracked action — a button click, a form start, scrolling to the bottom.'],
          ],
        },
      },
      {
        id: 'gtm-setup',
        title: 'Connecting Google Tag Manager',
        summary: 'One field. Real data starts collecting immediately.',
        audience: 'admin',
        steps: [
          { do: 'Create a container at tagmanager.google.com for your domain. Copy the ID — it looks like `GTM-XXXXXXX`.' },
          { do: 'Paste it into **Settings → Analytics → GTM container ID** and save.' },
          { do: 'Load the public site and confirm the container fires in GTM Preview mode.' },
        ],
        body: [
          'The site already pushes these events to the dataLayer, so you can build triggers on them without editing any code: `form_start`, `form_submit`, `cta_click`, `tel_click`, `email_click`, `file_download`, `scroll_90`.',
          'Installing GTM starts **collection**. The Analytics screen keeps showing sample data until a GA4 reader is implemented — those are two separate jobs.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ admin */
  {
    id: 'settings',
    title: 'Settings & access',
    blurb: 'Site-wide options, roles and sign-in. Admin only.',
    sections: [
      {
        id: 'roles',
        title: 'Who can do what',
        summary: 'Two roles.',
        audience: 'admin',
        table: {
          head: ['Role', 'Can'],
          rows: [
            ['Editor', 'Pages, sections, images, submissions'],
            ['Admin', 'Everything above, plus Settings and anything that changes how the system is wired'],
          ],
        },
        body: ['Roles come from Entra ID app roles. To change someone, assign the role in Entra — not here.'],
      },
      {
        id: 'tokens',
        title: 'Design tokens',
        summary: 'The site-wide palette and fonts.',
        audience: 'admin',
        warn: 'These apply everywhere at once. Changing the accent colour restyles every section on every page. Check a few pages before you save.',
      },
      {
        id: 'signin',
        title: 'Signing in',
        summary: 'Company account, or a local password when SSO is off.',
        audience: 'admin',
        body: [
          'When single sign-on is configured, the login screen shows **Sign in with Microsoft** and the password box disappears. That is intentional: a deployed site cannot be entered through a leftover local password.',
          'The local username and password are only for development, before SSO is set up. They are not your company email.',
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════ troubleshooting */
  {
    id: 'trouble',
    title: 'When something looks wrong',
    blurb: 'The five most common confusions, and what to check.',
    sections: [
      {
        id: 'fixes',
        title: 'Quick checks',
        summary: 'Work down this list before asking for help.',
        audience: 'everyone',
        table: {
          head: ['Symptom', 'Check'],
          rows: [
            ['My change is not on the site', 'Did you press Save changes? The preview shows saved work only.'],
            ['The page returns "not found"', 'Status is probably still Draft.'],
            ['The page is live but not in the menu', 'Show in main menu is a separate switch from Status.'],
            ['A section is missing', 'Design → Visibility → Hide this section.'],
            ['An image is broken', 'It was probably deleted from the Media library while still in use.'],
            ['Cards look cramped', 'Design tab → Gap between items, not the Content tab.'],
            ['Someone else saved over my work', 'Two people edited at once. Reload before editing, and avoid working on the same page simultaneously.'],
          ],
        },
      },
    ],
  },
];

export const GUIDE_INDEX = GUIDE.flatMap((t) =>
  t.sections.map((s) => ({
    topicId: t.id,
    topicTitle: t.title,
    ...s,
    haystack: [
      t.title, s.title, s.summary,
      ...(s.body || []),
      ...(s.steps || []).flatMap((x) => [x.do, x.note || '']),
      ...(s.table ? s.table.rows.flat() : []),
      s.warn || '',
    ].join(' ').toLowerCase(),
  })),
);
