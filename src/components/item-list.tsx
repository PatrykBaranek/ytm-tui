import { fit } from '../lib/format';
import { scrollStart } from '../lib/util';
import { colors } from '../theme';

export interface ListItem {
  key: string;
  label: string;
  detail: string;
}

// One row per mood, genre or playlist: a name and muted detail text. Songs use TrackList.
export function ItemList({
  items,
  selected,
  focused,
  rows,
  width,
}: {
  items: ListItem[];
  selected: number;
  focused: boolean;
  rows: number;
  width: number;
}) {
  const first = scrollStart(selected, rows, items.length);
  const rest = Math.max(0, width - 2);
  // Size the name column to the longest name in the whole list, so it doesn't shift while scrolling.
  const longest = Math.max(0, ...items.map((item) => Bun.stringWidth(item.label)));
  const labelWidth = Math.min(longest + 3, Math.floor(rest * 0.6));

  return (
    <>
      {items.slice(first, first + rows).map((item, offset) => {
        const index = first + offset;
        return (
          <box
            key={item.key}
            height={1}
            backgroundColor={
              index === selected && focused ? colors.rowSelected : 'transparent'
            }
          >
            <text>
              {'  '}
              <span fg={colors.fg}>{fit(item.label, labelWidth)}</span>
              <span fg={colors.muted}>{fit(item.detail, rest - labelWidth)}</span>
            </text>
          </box>
        );
      })}
    </>
  );
}
