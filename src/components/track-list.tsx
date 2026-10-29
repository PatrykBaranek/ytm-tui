import { fit, formatTime } from '../lib/format';
import { scrollStart } from '../lib/util';
import type { Track } from '../services/music';
import { colors } from '../theme';

interface TrackListProps {
  tracks: Track[];
  selected: number;
  focused: boolean;
  rows: number;
  width: number;
  playingId?: string;
  showAlbum?: boolean;
  numbered?: boolean;
}

export function TrackList({
  tracks,
  selected,
  focused,
  rows,
  width,
  playingId,
  showAlbum = false,
  numbered = false,
}: TrackListProps) {
  const first = scrollStart(selected, rows, tracks.length);
  const marker = numbered ? String(tracks.length).length + 1 : 2;
  const time = 8;
  const rest = Math.max(0, width - marker - time);
  // Narrow panes (the queue) only have room for titles.
  const showArtist = rest >= 30;
  const titleWidth = showArtist
    ? Math.floor(rest * (showAlbum ? 0.45 : 0.6))
    : rest;
  const albumWidth = showAlbum ? Math.floor(rest * 0.25) : 0;
  const artistWidth = showArtist ? rest - titleWidth - albumWidth : 0;
  // Fit each column one short and add a space so neighbouring columns never touch.
  const column = (text: string, w: number) =>
    w > 1 ? fit(text, w - 1) + ' ' : '';

  return (
    <>
      {tracks.slice(first, first + rows).map((track, offset) => {
        const index = first + offset;
        const isSelected = index === selected;
        const isPlaying = track.id === playingId;
        return (
          <box
            key={`${track.id}-${index}`}
            height={1}
            backgroundColor={
              isSelected && focused ? colors.rowSelected : 'transparent'
            }
          >
            <text>
              <span fg={isPlaying ? colors.playing : colors.muted}>
                {numbered
                  ? fit(String(index + 1), marker)
                  : isPlaying
                    ? '▶ '
                    : '  '}
              </span>
              <span fg={isPlaying ? colors.playing : colors.fg}>
                {column(track.title, titleWidth)}
              </span>
              <span fg={colors.muted}>
                {column(track.artists, artistWidth)}
                {column(track.album, albumWidth)}
                {formatTime(track.duration).padStart(time)}
              </span>
            </text>
          </box>
        );
      })}
    </>
  );
}
