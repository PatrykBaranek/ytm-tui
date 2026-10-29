import { useEffect, useRef } from 'react';
import { errorMessage } from '../lib/util';
import type { MusicSource, Track } from '../services/music';
import type { Player } from '../services/player';
import { useLatestState } from './use-latest-state';

export interface Playback {
  current: Track | null;
  queue: Track[];
  history: Track[];
}

// The queue and autoplay rules: what plays now, what plays next, and what played before.
// `notify` receives status messages for the status line.
export function usePlayback(
  player: Player,
  music: MusicSource,
  notify: (message: string) => void,
) {
  const [playback, setPlayback, playbackRef] = useLatestState<Playback>({
    current: null,
    queue: [],
    history: [],
  });
  const [autoplay, setAutoplay, autoplayRef] = useLatestState(true);

  function start(track: Track, queue: Track[], history: Track[]) {
    setPlayback({ current: track, queue, history: history.slice(-50) });
    player.play(track);
  }

  // Plays a track right away; whatever was playing moves to history.
  function playNow(track: Track) {
    const { current, queue, history } = playbackRef.current;
    start(track, queue, current ? [...history, current] : history);
  }

  function enqueue(track: Track) {
    const p = playbackRef.current;
    if (!p.current) return playNow(track);
    setPlayback({ ...p, queue: [...p.queue, track] });
    notify(`Added "${track.title}" to the queue`);
  }

  // Plays tracks[index] and makes the rest of the list the up-next queue, like starting a playlist.
  function playFrom(tracks: Track[], index: number) {
    const track = tracks[index];
    if (!track) return;
    const { current, history } = playbackRef.current;
    start(
      track,
      tracks.slice(index + 1),
      current ? [...history, current] : history,
    );
  }

  function enqueueAll(tracks: Track[]) {
    const p = playbackRef.current;
    if (!p.current) return playFrom(tracks, 0);
    setPlayback({ ...p, queue: [...p.queue, ...tracks] });
    notify(`Added ${tracks.length} songs to the queue`);
  }

  function removeFromQueue(index: number) {
    const p = playbackRef.current;
    setPlayback({ ...p, queue: p.queue.filter((_, i) => i !== index) });
  }

  async function next() {
    const { current, queue, history } = playbackRef.current;
    const played = current ? [...history, current] : history;
    const [head, ...rest] = queue;
    if (head) return start(head, rest, played);

    if (!autoplayRef.current || !current) {
      player.stop();
      setPlayback({ current: null, queue: [], history: played });
      return;
    }

    notify(`Finding songs like "${current.title}"...`);
    try {
      const seen = new Set([...played.map((t) => t.id)]);
      const radio = (await music.radio(current.id))
        .filter((t) => !seen.has(t.id))
        .slice(0, 25);
      if (playbackRef.current.current !== current) return; // the user picked something meanwhile
      const [first, ...more] = radio;
      if (!first) {
        notify('Autoplay found no similar songs');
        player.stop();
        return setPlayback({ current: null, queue: [], history: played });
      }
      start(first, more, played);
      notify(`Autoplay queued ${radio.length} similar songs`);
    } catch (err) {
      notify(`Autoplay failed: ${errorMessage(err)}`);
    }
  }

  function previous() {
    if (player.state.position > 5) return player.seek(0, 'absolute');
    const { current, queue, history } = playbackRef.current;
    const prev = history.at(-1);
    if (!prev) return player.seek(0, 'absolute');
    start(prev, current ? [current, ...queue] : queue, history.slice(0, -1));
  }

  function toggleAutoplay() {
    const on = !autoplayRef.current;
    setAutoplay(on);
    notify(`Autoplay ${on ? 'on' : 'off'}`);
  }

  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => player.onEnded(() => void nextRef.current()), [player]);

  return {
    playback,
    playbackRef,
    autoplay,
    playNow,
    playFrom,
    enqueue,
    enqueueAll,
    removeFromQueue,
    next,
    previous,
    toggleAutoplay,
  };
}
