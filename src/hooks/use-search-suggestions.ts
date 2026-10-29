import { useEffect, useRef, useState } from 'react';
import { rememberSearch, suggestionRows } from '../lib/search';
import { clamp } from '../lib/util';
import type { MusicSource } from '../services/music';
import { useLatestState } from './use-latest-state';

// Wait for a pause in typing before asking YouTube Music, instead of one request per key.
const DEBOUNCE_MS = 150;

// The list under the search box: recent searches and YouTube Music's suggestions for the text
// typed so far. ↑/↓ highlight a row; enter searches the highlighted row, or the text if none is.
export function useSearchSuggestions(
  music: MusicSource,
  savedHistory: string[] = [],
) {
  const [history, setHistory, historyRef] = useLatestState(savedHistory);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected, selectedRef] = useLatestState(-1);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      music.suggestions(q).then(
        (found) => !cancelled && setSuggestions(found),
        () => {}, // suggestions are a nicety; searching still works without them
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [music, query]);

  const rows = suggestionRows(query, history, suggestions);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  return {
    query,
    rows,
    selected,
    history,
    // Typing starts over from the text itself.
    onInput(value: string) {
      setQuery(value);
      setSelected(-1);
    },
    // ↑ from the first row goes back to the text as typed.
    move(delta: number) {
      setSelected(
        clamp(selectedRef.current + delta, -1, rowsRef.current.length - 1),
      );
    },
    // The search to run when enter is pressed.
    take(typed: string) {
      const row = rowsRef.current[selectedRef.current];
      setSelected(-1);
      return row?.text ?? typed;
    },
    remember(search: string) {
      setHistory(rememberSearch(historyRef.current, search));
    },
  };
}
