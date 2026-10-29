import { useEffect, useState } from 'react';
import { loadPalette, type Rgb } from '../lib/palette';

// Glow colors for a cover URL; null (the default glow) while loading or without a cover.
export function useCoverPalette(url: string | undefined) {
  const [palette, setPalette] = useState<Rgb[] | null>(null);
  useEffect(() => {
    if (!url) return setPalette(null);
    let current = true;
    loadPalette(url).then(
      (colors) => current && setPalette(colors),
      () => current && setPalette(null),
    );
    return () => {
      current = false;
    };
  }, [url]);
  return palette;
}
