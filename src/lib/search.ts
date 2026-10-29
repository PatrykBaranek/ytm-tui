export interface SuggestionRow {
  text: string
  recent: boolean // from your own search history, not YouTube Music
}

const MAX_ROWS = 8
const MAX_RECENT_WHILE_TYPING = 3
const MAX_HISTORY = 20

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// What the list under the search box shows: your recent searches while the box is empty; while
// typing, the recent ones containing the text first, then YouTube Music's suggestions.
export function suggestionRows(query: string, history: string[], suggestions: string[]): SuggestionRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return history.slice(0, MAX_ROWS).map((text) => ({ text, recent: true }))
  const recent = history.filter((text) => text.toLowerCase().includes(q)).slice(0, MAX_RECENT_WHILE_TYPING)
  const fresh = suggestions.filter((text) => !recent.some((r) => same(r, text)))
  return [...recent.map((text) => ({ text, recent: true })), ...fresh.map((text) => ({ text, recent: false }))].slice(
    0,
    MAX_ROWS,
  )
}

// Puts a search first in the history, once (ignoring case), keeping the newest MAX_HISTORY.
export const rememberSearch = (history: string[], query: string) =>
  [query, ...history.filter((s) => !same(s, query))].slice(0, MAX_HISTORY)
