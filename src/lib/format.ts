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

// Breaks text at spaces into at most `maxLines` lines of `width` columns. Text that doesn't fit
// ends in an ellipsis on the last line.
export function wrap(text: string, width: number, maxLines: number) {
  const lines: string[] = []
  if (width <= 0) return lines
  const words = text.split(/\s+/).filter(Boolean)
  let i = 0
  while (i < words.length && lines.length < maxLines) {
    if (lines.length === maxLines - 1) {
      lines.push(fit(words.slice(i).join(" "), width).trimEnd())
      break
    }
    let line = words[i++]!
    while (i < words.length && Bun.stringWidth(`${line} ${words[i]}`) <= width) line += ` ${words[i++]}`
    lines.push(fit(line, width).trimEnd())
  }
  return lines
}

export function progressBar(position: number, duration: number, width: number) {
  if (width <= 0) return ""
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0
  const filled = Math.round(ratio * width)
  return "━".repeat(filled) + "─".repeat(width - filled)
}
