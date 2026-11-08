import type { ImageRenderProtocol } from '@opentui/core';
import { isSectioned, type View } from '../hooks/use-navigation';
import { colors } from '../theme';
import { ItemList } from './item-list';
import { PageHeaderView, pageHeaderRows } from './page-header';
import { SectionPage } from './section-page';
import { TrackList } from './track-list';

const emptyText: Record<View['kind'], string> = {
  home: 'Nothing to show yet.',
  playlists: 'No playlists here.',
  playlist: 'Nothing here yet.',
  artist: 'No songs or albums found for this artist.',
  search: 'No results.',
};

interface BrowsePaneProps {
  view: View;
  focused: boolean;
  width: number;
  rows: number;
  playingId?: string;
  coverProtocol?: ImageRenderProtocol;
}

// The main area: whatever view is on top of the navigation stack.
export function BrowsePane({
  view,
  focused,
  width,
  rows,
  playingId,
  coverProtocol,
}: BrowsePaneProps) {
  const headerRows = pageHeaderRows(view.header, rows);
  const listRows = Math.max(1, rows - headerRows);

  return (
    <box width={width} height={rows} flexDirection="column" flexShrink={0}>
      {view.header && (
        <PageHeaderView
          header={view.header}
          width={width}
          rows={rows}
          loud={view.kind === 'artist'}
          protocol={coverProtocol}
        />
      )}
      {view.status === 'loading' ? (
        <text fg={colors.muted}> Loading...</text>
      ) : view.status === 'error' ? (
        <text fg={colors.error}>
          {' '}
          Couldn't load {view.title}: {view.error}. Press enter to retry.
        </text>
      ) : view.items.length === 0 ? (
        <text fg={colors.muted}> {emptyText[view.kind]}</text>
      ) : isSectioned(view) ? (
        <SectionPage
          view={view}
          width={width}
          rows={listRows}
          focused={focused}
          playingId={playingId}
        />
      ) : view.kind === 'playlists' ? (
        <ItemList
          items={view.items.map((playlist) => ({
            key: playlist.id,
            label: playlist.title,
            detail: playlist.subtitle,
          }))}
          selected={view.selected}
          focused={focused}
          rows={listRows}
          width={width}
        />
      ) : (
        <TrackList
          tracks={view.items}
          selected={view.selected}
          focused={focused}
          rows={listRows}
          width={width}
          playingId={playingId}
          // Every row of an album shares its album, and tracks have an order worth showing.
          numbered={!!view.header}
          showAlbum={width >= 76 && !view.header}
        />
      )}
    </box>
  );
}
