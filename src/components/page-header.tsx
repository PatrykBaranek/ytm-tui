import type { ImageRenderProtocol } from '@opentui/core';
import { useState } from 'react';
import { fit, wrap } from '../lib/format';
import type { PageHeader } from '../services/music';
import { colors } from '../theme';

const BANNER_WIDTH = 18;
const BANNER_ROWS = 3;
const MIN_BANNER_WIDTH = 50;
// Below this many rows the page's list needs the room more than the description does.
const MIN_FULL_ROWS = 14;

export const pageHeaderRows = (header: PageHeader | undefined, rows: number) =>
  !header ? 0 : rows < MIN_FULL_ROWS ? 2 : BANNER_ROWS + 1;

interface PageHeaderViewProps {
  header: PageHeader;
  width: number;
  rows: number; // how tall the whole page is
  loud: boolean; // an artist's name is shouted
  protocol?: ImageRenderProtocol;
}

export function PageHeaderView({
  header,
  width,
  rows,
  loud,
  protocol = 'auto',
}: PageHeaderViewProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const full = rows >= MIN_FULL_ROWS;
  const banner =
    full && !!header.image && header.image !== failed && width >= MIN_BANNER_WIDTH;
  const inner = Math.max(0, width - 1 - (banner ? BANNER_WIDTH + 2 : 0));
  const body = !full
    ? []
    : header.subtitle
      ? [fit(header.subtitle, inner).trimEnd(), ...wrap(header.text, inner, 1)]
      : wrap(header.text, inner, 2);

  return (
    <box
      height={pageHeaderRows(header, rows)}
      flexDirection="row"
      paddingLeft={1}
      flexShrink={0}
    >
      {banner && (
        <box
          width={BANNER_WIDTH}
          height={BANNER_ROWS}
          marginRight={2}
          flexShrink={0}
        >
          <image
            source={header.image}
            fit="cover"
            protocol={protocol}
            width="100%"
            height="100%"
            onError={() => setFailed(header.image)}
          />
        </box>
      )}
      <box flexDirection="column" flexGrow={1}>
        <box height={1}>
          <text fg={colors.fg}>
            <strong>
              {fit(loud ? header.title.toUpperCase() : header.title, inner).trimEnd()}
            </strong>
          </text>
        </box>
        {body.map((line, i) => (
          <box key={i} height={1}>
            <text fg={colors.muted}>{line}</text>
          </box>
        ))}
      </box>
    </box>
  );
}
