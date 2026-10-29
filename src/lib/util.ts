export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

// The first row to draw so the selection stays roughly centered once a list is taller than its pane.
export const scrollStart = (selected: number, rows: number, length: number) =>
  clamp(selected - Math.floor(rows / 2), 0, Math.max(0, length - rows))

export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
