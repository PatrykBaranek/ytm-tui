import type { SectionedView } from '../hooks/use-navigation';
import { pageLayout } from '../lib/browse';
import { fit, formatTime } from '../lib/format';
import { scrollStart } from '../lib/util';
import type { BrowseItem } from '../services/music';
import { colors } from '../theme';

// A short subtitle ending in a year lines up on the right; anything else reads as a description.
const MAX_RIGHT_WIDTH = 16;
const endsInYear = (subtitle: string) =>
  /\d{4}$/.test(subtitle) && Bun.stringWidth(subtitle) <= MAX_RIGHT_WIDTH;
// The width a row needs before a second column of text is worth squeezing in.
const MIN_DETAIL_WIDTH = 44;

interface RowText {
  glyph: string;
  label: string;
  detail: string;
  right: string;
}

function rowText(item: BrowseItem, showArtist: boolean): RowText {
  if ('track' in item) {
    const { title, artists, duration } = item.track;
    return {
      glyph: '  ',
      label: title,
      detail: showArtist ? artists : '',
      // Padded so a 10-minute song doesn't push its row's columns out of line.
      right: duration > 0 ? formatTime(duration).padStart(5) : '',
    };
  }
  if ('album' in item) {
    const { title, subtitle } = item.album;
    const dated = endsInYear(subtitle);
    return {
      glyph: '◉ ',
      label: title,
      detail: dated ? '' : subtitle,
      right: dated ? subtitle : '',
    };
  }
  if ('artist' in item)
    return { glyph: '  ', label: item.artist.name, detail: item.artist.subtitle, right: '' };
  return { glyph: '  ', label: item.category.title, detail: '', right: '' };
}

interface RowProps {
  item: BrowseItem;
  width: number;
  selected: boolean;
  focused: boolean;
  playing: boolean;
  showArtist: boolean;
}

function Row({ item, width, selected, focused, playing, showArtist }: RowProps) {
  const text = rowText(item, showArtist);
  const accent = focused ? colors.accent : colors.muted;
  const right = width >= 20 ? text.right : '';
  const rest = Math.max(0, width - 3 - (right ? Bun.stringWidth(right) + 1 : 0));
  const showDetail = !!text.detail && rest >= MIN_DETAIL_WIDTH;
  const labelWidth = showDetail ? Math.floor(rest * 0.6) : rest;
  return (
    <text>
      <span fg={accent}>{selected ? '▌' : ' '}</span>
      <span fg={playing ? colors.playing : colors.muted}>
        {playing ? '▶ ' : text.glyph}
      </span>
      <span fg={playing ? colors.playing : colors.fg}>
        {/* One short with a space after it, so the columns never touch. */}
        {showDetail ? `${fit(text.label, labelWidth - 1)} ` : fit(text.label, labelWidth)}
      </span>
      <span fg={colors.muted}>
        {showDetail ? fit(text.detail, rest - labelWidth) : ''}
        {right ? ` ${right}` : ''}
      </span>
    </text>
  );
}

interface SectionPageProps {
  view: SectionedView;
  width: number;
  rows: number;
  focused: boolean;
  playingId?: string;
}

// A page of named sections: home, search results, an artist.
export function SectionPage({ view, width, rows, focused, playingId }: SectionPageProps) {
  const layout = pageLayout(view, width);
  const selected = layout.cells.find((cell) => cell.item === view.selected);
  const top = scrollStart(selected?.y ?? 0, rows, layout.height);
  const onScreen = ({ y }: { y: number }) => y >= top && y < top + rows;

  return (
    <box width={width} height={rows} flexShrink={0}>
      {layout.headings.filter(onScreen).map((heading) => (
        <box
          key={`${heading.text}-${heading.x}`}
          position="absolute"
          left={heading.x}
          top={heading.y - top}
          width={heading.width}
          height={1}
        >
          <text fg={colors.muted}>
            <strong>{fit(` ${heading.text.toUpperCase()}`, heading.width).trimEnd()}</strong>
          </text>
        </box>
      ))}
      {layout.cells.filter(onScreen).map((cell) => {
        const item = view.items[cell.item]!;
        const isSelected = cell.item === view.selected;
        return (
          <box
            key={`${cell.item}-${cell.x}`}
            position="absolute"
            left={cell.x}
            top={cell.y - top}
            width={cell.width}
            height={1}
            backgroundColor={
              isSelected
                ? focused
                  ? colors.rowSelected
                  : colors.rowSelectedDim
                : 'transparent'
            }
          >
            <Row
              item={item}
              width={cell.width}
              selected={isSelected}
              focused={focused}
              playing={'track' in item && item.track.id === playingId}
              showArtist={view.kind !== 'artist'}
            />
          </box>
        );
      })}
    </box>
  );
}
