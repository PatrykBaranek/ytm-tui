import { measureText, type ImageRenderProtocol } from '@opentui/core';
import type { SectionedView } from '../hooks/use-navigation';
import type { Preview } from '../lib/browse';
import { fit, wrap } from '../lib/format';
import type { Track } from '../services/music';
import { colors } from '../theme';
import { Cover } from './cover';
import { SectionPage } from './section-page';
import { QueueList } from './side-panel';

// Below these the list needs the room more than the cover does.
const SPOTLIGHT_MIN_WIDTH = 64;
const SPOTLIGHT_MIN_ROWS = 12;
const SPOTLIGHT_GAP = 3;
// Under the cover: a blank line, up to two for the title, and one for the subtitle.
const TEXT_ROWS = 4;
const TITLE_LINES = 2;
// Largest first; a name that fits neither is drawn as plain text.
const NAME_FONTS = ['block', 'tiny'] as const;
const NAME_LINES = 2;

// Terminal cells are about twice as tall as they are wide, so a square cover has half as many
// rows as columns.
export function spotlightSize(width: number, rows: number) {
  if (width < SPOTLIGHT_MIN_WIDTH || rows < SPOTLIGHT_MIN_ROWS)
    return { width: 0, cover: 0 };
  const cover = Math.min(rows - TEXT_ROWS, Math.floor((width * 0.4) / 2));
  return { width: cover * 2, cover };
}

// A name broken into lines of this font, or undefined if it can't fit the space.
function nameLines(
  text: string,
  font: (typeof NAME_FONTS)[number],
  width: number,
  rows: number,
) {
  const fits = (line: string) => measureText({ text: line, font }).width <= width;
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const joined = `${lines.at(-1)} ${word}`;
    if (lines.length && fits(joined)) lines[lines.length - 1] = joined;
    else if (fits(word)) lines.push(word);
    else return undefined;
  }
  const { height } = measureText({ text, font });
  return lines.length <= NAME_LINES && lines.length * height <= rows ? lines : undefined;
}

function BigName({ text, width, rows }: { text: string; width: number; rows: number }) {
  // The fonts only have plain ASCII.
  const printable = /^[\x20-\x7e]+$/.test(text);
  for (const font of printable ? NAME_FONTS : []) {
    const lines = nameLines(text, font, width, rows);
    if (lines)
      return lines.map((line) => (
        <ascii-font key={line} text={line} font={font} color={colors.fg} />
      ));
  }
  return (
    <text fg={colors.fg}>
      <strong>{fit(text.toUpperCase(), width).trimEnd()}</strong>
    </text>
  );
}

interface SpotlightProps {
  subject: Preview;
  coverSource: string | undefined;
  coverProtocol?: ImageRenderProtocol;
  width: number;
  coverRows: number;
}

// The selected item, large. A mood has no cover, so its name stands in for one.
function Spotlight({ subject, coverSource, coverProtocol, width, coverRows }: SpotlightProps) {
  if (!subject.cover)
    return (
      <box height={coverRows} alignItems="center" justifyContent="center" flexDirection="column">
        <BigName text={subject.title} width={width} rows={coverRows - 1} />
        <text fg={colors.muted}>{fit(subject.subtitle, width).trimEnd()}</text>
      </box>
    );
  return (
    <>
      <Cover
        // The settled cover lags a moment behind the selection; don't show "no cover" meanwhile.
        source={coverSource ?? subject.cover}
        height={coverRows}
        protocol={coverProtocol}
      />
      <box height={1} flexShrink={0} />
      {wrap(subject.title.toUpperCase(), width, TITLE_LINES).map((line) => (
        <box key={line} height={1} flexShrink={0}>
          <text fg={colors.fg}>
            <strong>{line}</strong>
          </text>
        </box>
      ))}
      <box height={1} flexShrink={0}>
        <text fg={colors.muted}>{fit(subject.subtitle, width).trimEnd()}</text>
      </box>
    </>
  );
}

interface HomePageProps {
  view: Extract<SectionedView, { kind: 'home' }>;
  width: number;
  rows: number;
  listFocused: boolean;
  queueFocused: boolean;
  playingId?: string;
  subject: Preview | undefined;
  coverSource: string | undefined;
  coverProtocol?: ImageRenderProtocol;
  queue: Track[];
  queueSelection: number;
  autoplay: boolean;
}

// One big cover beside one list: the open tab's rows, or the queue while it has focus.
export function HomePage({
  view,
  width,
  rows,
  listFocused,
  queueFocused,
  playingId,
  subject,
  coverSource,
  coverProtocol,
  queue,
  queueSelection,
  autoplay,
}: HomePageProps) {
  const spotlight = spotlightSize(width, rows);
  const listWidth = Math.max(
    1,
    spotlight.width ? width - spotlight.width - SPOTLIGHT_GAP : width,
  );

  return (
    <box width={width} height={rows} flexDirection="row" flexShrink={0}>
      {spotlight.width > 0 && (
        <box
          width={spotlight.width}
          height={rows}
          marginRight={SPOTLIGHT_GAP}
          flexDirection="column"
          flexShrink={0}
        >
          {subject && (
            <Spotlight
              subject={subject}
              coverSource={coverSource}
              coverProtocol={coverProtocol}
              width={spotlight.width}
              coverRows={spotlight.cover}
            />
          )}
        </box>
      )}
      <box width={listWidth} height={rows} flexDirection="column" flexShrink={0}>
        {queueFocused ? (
          <QueueList
            queue={queue}
            selection={queueSelection}
            focused
            rows={Math.max(1, rows - 1)}
            width={listWidth}
            autoplay={autoplay}
          />
        ) : (
          <SectionPage
            view={view}
            width={listWidth}
            rows={rows}
            focused={listFocused}
            playingId={playingId}
          />
        )}
      </box>
    </box>
  );
}
