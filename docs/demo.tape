# The README demo. Record it with docs/record-demo.sh, which also shrinks the GIF.
# It uses live YouTube Music data, so if a step lands on an odd moment, record again.
Output docs/demo.gif

Require bun
Require mpv
Require yt-dlp

Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 660
Set Padding 0
# Higher rates make the recorder drop frames, and the GIF then plays faster than real time.
Set Framerate 15
Set TypingSpeed 90ms

# A fresh session in a temporary folder, no sound, and block-drawn covers (the recorder's
# terminal has no kitty graphics). "ytm" runs this checkout instead of an installed copy.
Hide
Type "export XDG_STATE_HOME=$(mktemp -d) YTM_MPV_ARGS=--ao=null YTM_IMAGE_PROTOCOL=blocks" Enter
Type "alias ytm='bun src/index.tsx'" Enter
Type "clear" Enter
Show

Type "ytm" Sleep 300ms Enter
# The splash, then moods & genres.
Sleep 3.5s

# Chill (under Recently played) → its playlists → one of them, then back. The recorder drops
# frames while the glow redraws, so pauses here are longer than they look in the GIF.
Down Sleep 500ms Enter Sleep 3s
Down Sleep 500ms Down Sleep 500ms Enter Sleep 3.5s
Escape Sleep 1.2s Escape Sleep 1.5s

# Search with a suggestion, and play a song with a colorful cover so the glow shows.
Type "/" Sleep 400ms
Type "blinding l" Sleep 1.5s
Down Sleep 600ms Enter Sleep 2.5s
Enter Sleep 5s
Down Sleep 300ms Type "a" Sleep 1.5s

# Every key.
Type "?" Sleep 3s
Type "x" Sleep 1.5s

Hide
Type "q" Sleep 500ms
