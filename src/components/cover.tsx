import type { ImageRenderProtocol } from '@opentui/core';
import { useState } from 'react';
import { colors } from '../theme';

interface CoverProps {
  source?: string;
  height: number;
  protocol?: ImageRenderProtocol;
}

// OpenTUI picks the image protocol: real pixels on kitty-graphics terminals (Ghostty, kitty,
// WezTerm), colored half-block characters elsewhere and inside tmux.
export function Cover({ source, height, protocol = 'auto' }: CoverProps) {
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <box
      title="cover"
      height={height}
      border
      borderColor={colors.border}
      alignItems="center"
      justifyContent="center"
    >
      {source && source !== failed ? (
        <image
          source={source}
          fit="fit"
          protocol={protocol}
          width="100%"
          height="100%"
          onError={() => setFailed(source)}
        />
      ) : (
        <text fg={colors.muted}>no cover</text>
      )}
    </box>
  );
}
