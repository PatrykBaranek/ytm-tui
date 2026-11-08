import type { ImageRenderProtocol } from '@opentui/core';
import type { Preview } from '../lib/browse';
import { fit } from '../lib/format';
import type { Track } from '../services/music';
import { colors } from '../theme';
import { Cover } from './cover';
import { TrackList } from './track-list';

const innerWidth = (width: number) => Math.max(1, width - 4);

// How the column's height divides up. Terminal cells are about twice as tall as they are wide, so
// a square cover filling the column needs about half as many rows as columns.
export function sidePanelRows(width: number, height: number) {
  const fitted = Math.min(Math.floor(innerWidth(width) / 2), Math.floor(height * 0.5));
  // Cover plus a blank line, title and subtitle, a blank line, the queue's heading.
  const cover = fitted >= 4 && height - fitted - 5 >= 3 ? fitted : 0;
  const fixed = (cover ? cover + 1 : 0) + 4;
  return { cover, queue: Math.max(1, height - fixed) };
}

interface QueueListProps {
  queue: Track[];
  selection: number;
  focused: boolean;
  rows: number;
  width: number;
  autoplay: boolean;
}

// The queue's heading and its songs.
export function QueueList({
  queue,
  selection,
  focused,
  rows,
  width,
  autoplay,
}: QueueListProps) {
  return (
    <>
      <box height={1} flexShrink={0}>
        <text fg={focused ? colors.accent : colors.muted}>
          <strong>{fit(`UP NEXT · ${queue.length}`, width).trimEnd()}</strong>
        </text>
      </box>
      {queue.length === 0 ? (
        <text fg={colors.muted}>
          {autoplay
            ? 'Empty. Press a to queue a song; autoplay picks similar ones.'
            : 'Empty. Press a to queue a song.'}
        </text>
      ) : (
        <TrackList
          tracks={queue}
          selected={selection}
          focused={focused}
          rows={rows}
          width={width}
          numbered
        />
      )}
    </>
  );
}

interface SidePanelProps {
  width: number;
  height: number;
  focused: boolean;
  divider: boolean; // false when it fills the screen on a narrow terminal
  subject: Preview | undefined;
  coverSource: string | undefined;
  coverProtocol?: ImageRenderProtocol;
  queue: Track[];
  queueSelection: number;
  autoplay: boolean;
}

// The cover and details of what's selected, then the queue.
export function SidePanel({
  width,
  height,
  focused,
  divider,
  subject,
  coverSource,
  coverProtocol,
  queue,
  queueSelection,
  autoplay,
}: SidePanelProps) {
  const inner = innerWidth(width);
  const rows = sidePanelRows(width, height);

  return (
    <box
      width={width}
      height={height}
      // Only when it's on: OpenTUI draws a full box for any border color it is given.
      {...(divider && {
        border: ['left'] as const,
        borderColor: focused ? colors.borderFocused : colors.border,
      })}
      paddingLeft={2}
      paddingRight={1}
      flexDirection="column"
      flexShrink={0}
    >
      {rows.cover > 0 && (
        <box marginBottom={1} flexShrink={0}>
          <Cover source={coverSource} height={rows.cover} protocol={coverProtocol} />
        </box>
      )}
      <box height={1} flexShrink={0}>
        <text fg={colors.fg}>
          <strong>{fit(subject?.title ?? '', inner).trimEnd()}</strong>
        </text>
      </box>
      <box height={1} marginBottom={1} flexShrink={0}>
        <text fg={colors.muted}>{fit(subject?.subtitle ?? '', inner).trimEnd()}</text>
      </box>
      <QueueList
        queue={queue}
        selection={queueSelection}
        focused={focused}
        rows={rows.queue}
        width={inner}
        autoplay={autoplay}
      />
    </box>
  );
}
