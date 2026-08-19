'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { AnimationPreset } from '@/lib/types';

interface Props {
  animation?: AnimationPreset;
  delay?: number;
  duration?: number;
  index?: number;      // used by the 'stagger' preset
  as?: 'div' | 'span' | 'section' | 'article' | 'figure' | 'li';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * One IntersectionObserver per element. Presets only — deliberately no
 * timeline editor, no per-element keyframe control. Editors pick from
 * the list in the style panel and nothing else.
 *
 * The presets are pairs of utility classes rather than keyframes, because
 * each one is a single transition between two states. Duration and delay
 * come in as inline variables so the editor controls them per section.
 */

const FROM: Record<AnimationPreset, string> = {
  none: '',
  'fade-in': 'opacity-0',
  'fade-up': 'opacity-0 translate-y-7',
  'fade-down': 'opacity-0 -translate-y-7',
  'slide-left': 'opacity-0 translate-x-10',
  'slide-right': 'opacity-0 -translate-x-10',
  'zoom-in': 'opacity-0 scale-[0.94]',
  'blur-in': 'opacity-0 [filter:blur(12px)]',
  stagger: 'opacity-0 translate-y-7',
};

const TO = 'opacity-100 translate-x-0 translate-y-0 scale-100 [filter:blur(0)]';

const TRANSITION =
  'transition-[opacity,transform,filter] ease-[cubic-bezier(0.22,0.61,0.36,1)] ' +
  'duration-[var(--rv-dur)] delay-[var(--rv-delay)] will-change-[opacity,transform] ' +
  'motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0 ' +
  'motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:[filter:none]';

export default function Reveal({
  animation = 'fade-up',
  delay = 0,
  duration = 900,
  index = 0,
  as = 'div',
  className = '',
  style,
  children,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(animation === 'none');

  useEffect(() => {
    if (animation === 'none') return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animation]);

  const totalDelay = animation === 'stagger' ? delay + index * 110 : delay;
  const Tag = as as any;

  return (
    <Tag
      ref={ref}
      className={[animation === 'none' ? '' : TRANSITION, shown ? TO : FROM[animation], className]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...style,
        ['--rv-delay' as any]: `${totalDelay}ms`,
        ['--rv-dur' as any]: `${duration}ms`,
      }}
    >
      {children}
    </Tag>
  );
}
