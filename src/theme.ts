// Panels are transparent so the ambient glow (src/components/ambient.ts) shows through.
export const colors = {
  rowSelected: "#ffffff24",
  border: "#ffffff38",
  borderFocused: "#f7768e",
  fg: "#ececec",
  muted: "#a0a0a8",
  accent: "#f7768e",
  playing: "#9ece6a",
  error: "#ff5f5f",
  // Opaque on purpose: a background with any transparency only tints the cells below and keeps
  // their characters, so the lists would show through the key help.
  overlay: "#0c0c11",
}
