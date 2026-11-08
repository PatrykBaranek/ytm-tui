import type {
  ArtistInfo,
  BrowseItem,
  Category,
  Explore,
  PlaylistInfo,
  SearchResults,
  Track,
} from '../services/music';
import { layoutBlocks, type Block, type PageLayout } from './page-layout';

const SEARCH_SHELF_ROWS = 3;
// Side-by-side columns stop being readable below this.
const MIN_COLUMNS_WIDTH = 60;

export const RECENT_SECTION = 'Recent';
const SONGS_SECTION = 'Songs';

export function itemKey(item: BrowseItem) {
  if ('track' in item) return `${item.section}:${item.track.id}`;
  if ('album' in item) return `${item.section}:${item.album.id}`;
  if ('artist' in item) return `${item.section}:${item.artist.id}`;
  return `${item.section}:${item.category.id}`;
}

const trackRows = (section: string, tracks: Track[]): BrowseItem[] =>
  tracks.map((track) => ({ section, track }));

const albumRows = (section: string, albums: PlaylistInfo[]): BrowseItem[] =>
  albums.map((album) => ({ section, album }));

const artistRows = (section: string, artists: ArtistInfo[]): BrowseItem[] =>
  artists.map((artist) => ({ section, artist }));

// Home's tabs, in the order they appear. A tab with nothing in it is left out.
export function homeItems(
  recent: Track[],
  explore: Explore,
  categories: Category[],
): BrowseItem[] {
  return withRecent(
    [
      ...categories.map((category) => ({ section: 'Moods', category })),
      ...trackRows('For you', explore.quickPicks),
      ...albumRows('New', explore.albums),
      ...trackRows('Trending', explore.trending),
    ],
    recent,
  );
}

// The home rows with a new Recent tab at the front.
export function withRecent(items: BrowseItem[], recent: Track[]): BrowseItem[] {
  return [
    ...trackRows(RECENT_SECTION, recent),
    ...items.filter((item) => item.section !== RECENT_SECTION),
  ];
}

export const homeTabs = (items: BrowseItem[]) => [
  ...new Set(items.map((item) => item.section)),
];

// The first row of the tab beside the selected row's, or the same row at either end.
export function switchTab(items: BrowseItem[], selected: number, delta: number) {
  const tabs = homeTabs(items);
  const next = tabs[tabs.indexOf(items[selected]?.section ?? '') + delta];
  return next === undefined
    ? selected
    : items.findIndex((item) => item.section === next);
}

export function searchItems({ songs, artists, albums }: SearchResults): BrowseItem[] {
  return [
    ...artistRows('Artists', artists.slice(0, SEARCH_SHELF_ROWS)),
    ...albumRows('Albums', albums.slice(0, SEARCH_SHELF_ROWS)),
    ...trackRows(SONGS_SECTION, songs),
  ];
}

// Enter on a fresh search plays the top song, as artists and albums sit above it.
export const firstSongRow = (items: BrowseItem[]) =>
  Math.max(0, items.findIndex((item) => 'track' in item));

function blocksOf(items: BrowseItem[]) {
  const blocks: Block[] = [];
  items.forEach((item, index) => {
    let block = blocks.at(-1);
    if (block?.title !== item.section) {
      block = { title: item.section, items: [] };
      blocks.push(block);
    }
    block.items.push(index);
  });
  return blocks;
}

export function pageLayout(
  { kind, items, selected }: { kind: 'home' | 'artist' | 'search'; items: BrowseItem[]; selected: number },
  width: number,
): PageLayout {
  // Home shows one tab at a time, and the selected row says which.
  if (kind === 'home') {
    const tab = items[selected]?.section;
    const rows = items.flatMap((item, index) => (item.section === tab ? [index] : []));
    return {
      cells: rows.map((item, y) => ({ item, x: 0, y, width, section: 0 })),
      headings: [],
      height: rows.length,
    };
  }
  const blocks = blocksOf(items);
  if (kind === 'artist' || width < MIN_COLUMNS_WIDTH)
    return layoutBlocks(blocks.map((block) => [block]), width);
  const songs = blocks.filter((block) => block.title === SONGS_SECTION);
  const others = blocks.filter((block) => block.title !== SONGS_SECTION);
  return layoutBlocks([others, songs].filter((row) => row.length), width);
}

export interface Preview {
  title: string;
  subtitle: string;
  cover: string;
}

const trackPreview = (track: Track): Preview => ({
  title: track.title,
  subtitle: [track.artists, track.album].filter(Boolean).join(' · '),
  cover: track.cover,
});

// The title, details and cover to show for a row.
export function previewOf(
  item: BrowseItem | PlaylistInfo | Track | null | undefined,
): Preview | undefined {
  if (!item) return undefined;
  if ('section' in item) {
    if ('track' in item) return trackPreview(item.track);
    if ('album' in item) return item.album;
    if ('artist' in item)
      return {
        title: item.artist.name,
        subtitle: item.artist.subtitle,
        cover: item.artist.cover,
      };
    return { title: item.category.title, subtitle: item.category.group, cover: '' };
  }
  return 'duration' in item ? trackPreview(item) : item;
}

// A row with a cover to show wins; otherwise the song that's playing does.
export const chooseSubject = (
  row: Preview | undefined,
  playing: Preview | undefined,
) => (row?.cover ? row : (playing ?? row));
