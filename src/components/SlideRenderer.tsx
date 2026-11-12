import { memo } from 'react';
import type { Slide, ThemeId } from '../../shared/schema.js';
import { renderSlideInner } from '../lib/slideMarkup.js';

interface SlideRendererProps {
  slide: Slide;
  index: number;
  total: number;
  theme: ThemeId;
  className?: string;
}

export const SlideRenderer = memo(function SlideRenderer({
  slide,
  index,
  total,
  theme,
  className = '',
}: SlideRendererProps) {
  return (
    <article
      className={`slide layout-${slide.layout} ${className}`.trim()}
      data-theme={theme}
      data-index={index}
      aria-label={`第 ${index + 1} 页：${slide.title}`}
      dangerouslySetInnerHTML={{ __html: renderSlideInner(slide, index, total) }}
    />
  );
});
