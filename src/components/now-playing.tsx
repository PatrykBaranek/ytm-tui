import { fit, formatTime, progressBar } from '../lib/format';
import type { Track } from '../services/music';
import type { PlayerState } from '../services/player';
import { colors } from '../theme';

const statusIcon: Record<PlayerState['status'], string> = {
  idle: '■',
  loading: '◌',
  playing: '▶',
  paused: '‖',
  error: '✕',
};

interface NowPlayingProps {
  track: Track | null;
  state: PlayerState;
  autoplay: boolean;
  width: number;
}

// Two lines above the key hints: the song, then how far along it is.
export function NowPlaying({ track, state, autoplay, width }: NowPlayingProps) {
  const inner = Math.max(0, width - 2);
  const left = `${formatTime(state.position)} `;
  // Until mpv reports it (or for a song picked up from the last session), use the listed length.
  const duration = state.duration || track?.duration || 0;
  const right = ` ${formatTime(duration)}   vol ${state.volume}%   `;
  const autoplayLabel = `autoplay ${autoplay ? 'on' : 'off'}`;
  const bar = progressBar(
    state.position,
    duration,
    inner -
      Bun.stringWidth(left) -
      Bun.stringWidth(right) -
      Bun.stringWidth(autoplayLabel),
  );
  const detail =
    state.status === 'error'
      ? ` · ${state.error}`
      : state.status === 'loading'
        ? ' · loading...'
        : track?.artists && ` · ${track.artists}`;

  return (
    <box
      height={2}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
      flexShrink={0}
    >
      <box height={1}>
        {track ? (
          <text>
            <span fg={state.status === 'error' ? colors.error : colors.playing}>
              {statusIcon[state.status]}{' '}
            </span>
            <span fg={colors.fg}>
              <strong>{fit(track.title, Math.max(0, inner - 2)).trimEnd()}</strong>
            </span>
            <span fg={colors.muted}>
              {fit(
                detail || '',
                Math.max(0, inner - 2 - Bun.stringWidth(track.title)),
              )}
            </span>
          </text>
        ) : (
          <text fg={colors.muted}>
            {fit('Nothing playing. Pick something, or search with /.', inner)}
          </text>
        )}
      </box>
      <box height={1}>
        <text fg={colors.muted}>
          {left}
          <span fg={colors.accent}>{bar.slice(0, bar.lastIndexOf('━') + 1)}</span>
          {bar.slice(bar.lastIndexOf('━') + 1)}
          {right}
          <span fg={autoplay ? colors.playing : colors.muted}>{autoplayLabel}</span>
        </text>
      </box>
    </box>
  );
}
