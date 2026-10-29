export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`
}

const graphemes = new Intl.Segmenter()

// Truncates (with an ellipsis) or pads text to exactly `width` terminal columns.
// Measures with Bun.stringWidth so wide CJK characters and emoji count as two columns.
export function fit(text: string, width: number) {
  if (width <= 0) return ""
  const textWidth = Bun.stringWidth(text)
  if (textWidth <= width) return text + " ".repeat(width - textWidth)

  let out = ""
  let used = 0
  for (const { segment } of graphemes.segment(text)) {
    const w = Bun.stringWidth(segment)
    if (used + w > width - 1) break
    out += segment
    used += w
  }
  return out + "…" + " ".repeat(width - 1 - used)
}

export function progressBar(position: number, duration: number, width: number) {
  if (width <= 0) return ""
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0
  const filled = Math.round(ratio * width)
  return "━".repeat(filled) + "─".repeat(width - filled)
}
