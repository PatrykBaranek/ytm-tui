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

export function NowPlaying({
  track,
  state,
  width,
}: {
  track: Track | null;
  state: PlayerState;
  width: number;
}) {
  const inner = width - 4;
  const left = `${formatTime(state.position)} `;
  const right = ` ${formatTime(state.duration)}   vol ${state.volume}%`;
  const bar = progressBar(
    state.position,
    state.duration,
    inner - Bun.stringWidth(left) - Bun.stringWidth(right),
  );
  const subtitle = track
    ? [track.artists, track.album].filter(Boolean).join(' · ')
    : '';

  return (
    <box
      title="now playing"
      height={4}
      border
      borderColor={colors.border}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {track ? (
        <text>
          <span fg={state.status === 'error' ? colors.error : colors.playing}>
            {statusIcon[state.status]}{' '}
          </span>
          <span fg={colors.fg}>
            <strong>{track.title}</strong>
          </span>
          <span fg={colors.muted}>
            {fit(
              state.status === 'error'
                ? `  ${state.error}`
                : state.status === 'loading'
                  ? '  loading...'
                  : subtitle && `  ${subtitle}`,
              Math.max(0, inner - 2 - Bun.stringWidth(track.title)),
            )}
          </span>
        </text>
      ) : (
        <text fg={colors.muted}>
          Nothing playing. Pick a playlist, or search with /.
        </text>
      )}
      <text fg={colors.muted}>
        {left}
        <span fg={colors.accent}>{bar.slice(0, bar.lastIndexOf('━') + 1)}</span>
        {bar.slice(bar.lastIndexOf('━') + 1)}
        {right}
      </text>
    </box>
  );
}
