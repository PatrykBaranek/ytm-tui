import { fit } from '../lib/format';
import type { SuggestionRow } from '../lib/search';
import { colors } from '../theme';

interface SearchSuggestionsProps {
  rows: SuggestionRow[];
  selected: number;
  query: string;
  width: number;
  top: number;
}

// The list that drops down under the search box. Recent searches are marked with ↺, and the
// part of a suggestion you already typed is dimmed so the completion stands out.
export function SearchSuggestions({
  rows,
  selected,
  query,
  width,
  top,
}: SearchSuggestionsProps) {
  const typed = query.trim().toLowerCase();
  const textWidth = width - 6;
  return (
    <box
      position="absolute"
      top={top}
      left={0}
      width={width}
      title={typed ? 'suggestions' : 'recent searches'}
      border
      borderColor={colors.borderFocused}
      backgroundColor={colors.overlay}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {rows.map((row, i) => {
        const text = fit(row.text, textWidth);
        const dim = text.toLowerCase().startsWith(typed) ? typed.length : 0;
        return (
          <box
            key={`${row.recent}-${row.text}`}
            height={1}
            backgroundColor={i === selected ? colors.rowSelected : 'transparent'}
          >
            <text>
              <span fg={colors.muted}>{row.recent ? '↺ ' : '  '}</span>
              <span fg={colors.muted}>{text.slice(0, dim)}</span>
              <span fg={colors.fg}>{text.slice(dim)}</span>
            </text>
          </box>
        );
      })}
    </box>
  );
}
