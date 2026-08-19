'use client';

import type { ReactNode } from 'react';
import type { StyleEnvelope, FieldDef } from '@/lib/types';
import { Field } from './Fields';
import { Row } from './ui';

/* ------------------------------------------------------------------
   One panel, every block. This is the deliberate limit on editor power:
   they get real control over colour, type, spacing and motion, but the
   layout of each block stays owned by the component.
-------------------------------------------------------------------*/

const F: Record<string, FieldDef> = {
  theme: { name: 'theme', label: 'Theme preset', type: 'select', half: true, options: [
    { label: 'Light (cream)', value: 'light' },
    { label: 'Dark (navy)', value: 'dark' },
    { label: 'Brand (warm)', value: 'brand' },
    { label: 'Custom', value: 'custom' },
  ]},
  align: { name: 'align', label: 'Text alignment', type: 'select', half: true, options: [
    { label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' },
  ]},

  bgType: { name: 'bgType', label: 'Background', type: 'select', half: true, options: [
    { label: 'Theme default', value: 'none' },
    { label: 'Solid colour', value: 'color' },
    { label: 'Gradient', value: 'gradient' },
    { label: 'Image', value: 'image' },
  ]},
  bgColor: { name: 'bgColor', label: 'Background colour', type: 'color' },
  bgColor2: { name: 'bgColor2', label: 'Gradient second colour', type: 'color' },
  bgGradientAngle: { name: 'bgGradientAngle', label: 'Gradient angle', type: 'number', min: 0, max: 360 },
  bgImage: { name: 'bgImage', label: 'Background image', type: 'image' },
  bgPosition: { name: 'bgPosition', label: 'Image position', type: 'text', half: true, placeholder: 'center' },
  bgOverlay: { name: 'bgOverlay', label: 'Image darkening %', type: 'number', min: 0, max: 95 },
  bgFixed: { name: 'bgFixed', label: 'Fixed background (parallax)', type: 'boolean', half: true },

  textColor: { name: 'textColor', label: 'Body text colour', type: 'color' },
  headingColor: { name: 'headingColor', label: 'Heading colour', type: 'color' },
  accentColor: { name: 'accentColor', label: 'Accent colour', type: 'color' },
  borderColor: { name: 'borderColor', label: 'Line / border colour', type: 'color' },

  headingFont: { name: 'headingFont', label: 'Heading font', type: 'select', half: true, options: [
    { label: 'Default (serif)', value: '' },
    { label: 'Serif — Cormorant', value: 'serif' },
    { label: 'Sans — Inter', value: 'sans' },
    { label: 'Arabic serif — Amiri', value: 'arabicSerif' },
    { label: 'Arabic sans — IBM Plex', value: 'arabicSans' },
    { label: 'Mono', value: 'mono' },
  ]},
  bodyFont: { name: 'bodyFont', label: 'Body font', type: 'select', half: true, options: [
    { label: 'Default (sans)', value: '' },
    { label: 'Serif — Cormorant', value: 'serif' },
    { label: 'Sans — Inter', value: 'sans' },
    { label: 'Arabic serif — Amiri', value: 'arabicSerif' },
    { label: 'Arabic sans — IBM Plex', value: 'arabicSans' },
    { label: 'Mono', value: 'mono' },
  ]},
  headingScale: { name: 'headingScale', label: 'Heading size ×', type: 'number', min: 0.6, max: 2, step: 0.05 },
  bodyScale: { name: 'bodyScale', label: 'Body size ×', type: 'number', min: 0.75, max: 1.6, step: 0.05 },
  letterSpacing: { name: 'letterSpacing', label: 'Letter spacing (em)', type: 'number', min: -0.05, max: 0.4, step: 0.005 },
  lineHeight: { name: 'lineHeight', label: 'Line height', type: 'number', min: 1, max: 2.2, step: 0.05 },
  uppercaseHeadings: { name: 'uppercaseHeadings', label: 'Uppercase headings', type: 'boolean', half: true },

  paddingTop: { name: 'paddingTop', label: 'Space above (px)', type: 'number', min: 0, max: 260 },
  paddingBottom: { name: 'paddingBottom', label: 'Space below (px)', type: 'number', min: 0, max: 260 },
  gap: { name: 'gap', label: 'Gap between items (px)', type: 'number', min: 0, max: 90 },
  maxWidth: { name: 'maxWidth', label: 'Content width (px)', type: 'number', min: 600, max: 1800, step: 10 },
  radius: { name: 'radius', label: 'Corner radius (px)', type: 'number', min: 0, max: 40 },

  animation: { name: 'animation', label: 'Animation preset', type: 'select', options: [
    { label: 'None', value: 'none' },
    { label: 'Fade in', value: 'fade-in' },
    { label: 'Fade up', value: 'fade-up' },
    { label: 'Fade down', value: 'fade-down' },
    { label: 'Slide from end', value: 'slide-left' },
    { label: 'Slide from start', value: 'slide-right' },
    { label: 'Zoom in', value: 'zoom-in' },
    { label: 'Blur in', value: 'blur-in' },
    { label: 'Stagger children', value: 'stagger' },
  ]},
  animationDuration: { name: 'animationDuration', label: 'Duration (ms)', type: 'number', min: 100, max: 2500, step: 50 },
  animationDelay: { name: 'animationDelay', label: 'Delay (ms)', type: 'number', min: 0, max: 2000, step: 50 },

  hidden: { name: 'hidden', label: 'Hide this section', type: 'boolean', half: true },
  hideOnMobile: { name: 'hideOnMobile', label: 'Hide on mobile', type: 'boolean', half: true },
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mb-2.5 rounded-panel border border-edge bg-panel" open>
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-[9px]
          text-[11px] uppercase tracking-[0.12em] text-dim
          [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="text-gold transition-transform group-open:rotate-90">
          &#9656;
        </span>
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

export default function StylePanel({
  style, onChange, showVisibility = true, scope = 'block',
}: {
  style: StyleEnvelope;
  onChange: (next: StyleEnvelope) => void;
  showVisibility?: boolean;
  /** 'page' hides the controls that only mean something on a section.
   *  Page-level padding and animation are not applied to anything — showing
   *  them implies control the editor does not have. */
  scope?: 'block' | 'page';
}) {
  const set = (k: string) => (v: any) => onChange({ ...style, [k]: v });
  const f = (key: keyof typeof F) => (
    <Field key={key as string} def={F[key]} value={(style as any)[key]} onChange={set(key as string)} />
  );

  return (
    <div>
      <Group title="Theme & background">
        <Row>{f('theme')}{f('align')}</Row>
        <Row>{f('bgType')}{style.bgType === 'image' ? f('bgFixed') : null}</Row>
        {(style.bgType === 'color' || style.bgType === 'gradient') && f('bgColor')}
        {style.bgType === 'gradient' && (<>{f('bgColor2')}{f('bgGradientAngle')}</>)}
        {style.bgType === 'image' && (<>{f('bgImage')}<Row>{f('bgPosition')}</Row>{f('bgOverlay')}</>)}
      </Group>

      <Group title="Colour">
        {f('headingColor')}
        {f('textColor')}
        {f('accentColor')}
        {f('borderColor')}
      </Group>

      <Group title="Typography">
        <Row>{f('headingFont')}{f('bodyFont')}</Row>
        {f('headingScale')}
        {f('bodyScale')}
        {f('lineHeight')}
        {f('letterSpacing')}
        <Row>{f('uppercaseHeadings')}</Row>
      </Group>

      {scope === 'block' && (
        <Group title="Spacing & layout">
          {f('paddingTop')}
          {f('paddingBottom')}
          {f('gap')}
          {f('maxWidth')}
          {f('radius')}
        </Group>
      )}

      {scope === 'block' && (
        <Group title="Animation">
          {f('animation')}
          {style.animation !== 'none' && (<>{f('animationDuration')}{f('animationDelay')}</>)}
        </Group>
      )}

      {showVisibility && (
        <Group title="Visibility">
          <Row>{f('hidden')}{f('hideOnMobile')}</Row>
        </Group>
      )}
    </div>
  );
}
