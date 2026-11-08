import { Innertube, Log, YTNodes } from "youtubei.js"
import type { YTMusic } from "youtubei.js"

type Album = YTMusic.Album

export interface Track {
  id: string
  title: string
  artists: string
  album: string
  duration: number
  cover: string
  // Where the song's artist and album pages live. Songs saved by older versions don't have them,
  // and YouTube Music doesn't link every song to an album.
  artistId?: string
  albumId?: string
}

// A mood or genre from YouTube Music's "Moods & genres" page, e.g. Chill or Hip-hop.
export interface Category {
  id: string
  title: string
  group: string // "Moods & moments" or "Genres"
}

export interface PlaylistInfo {
  id: string
  title: string
  subtitle: string // a few of its artists
  cover: string
}

// One row of an artist page: a song to play or an album to open, under a section like "Top songs".
export type ArtistItem = { section: string; track: Track } | { section: string; album: PlaylistInfo }

export interface ArtistPage {
  name: string
  items: ArtistItem[]
}

export interface MusicSource {
  search(query: string): Promise<Track[]>
  // How YouTube Music would complete a half-typed search, e.g. "daft p" → "daft punk get lucky".
  suggestions(query: string): Promise<string[]>
  // Songs YouTube Music would play after this one; used for autoplay when the queue runs out.
  radio(trackId: string): Promise<Track[]>
  categories(): Promise<Category[]>
  // Playlists YouTube Music's editors made for a category.
  playlists(categoryId: string): Promise<PlaylistInfo[]>
  playlist(playlistId: string): Promise<Track[]>
  artist(artistId: string): Promise<ArtistPage>
  album(albumId: string): Promise<Track[]>
}

const joinNames = (artists?: { name: string }[]) => artists?.map((a) => a.name).join(", ") ?? ""

// A song can have several artists; its artist page is the first one that links to a channel.
const firstArtistId = (artists?: { channel_id?: string }[]) =>
  artists?.find((a) => a.channel_id?.startsWith("UC"))?.channel_id

// Thumbnails come largest first, but search results only go up to 120px. YouTube Music image
// URLs end in a size like "=w120-h120", so rewriting it fetches a sharper cover.
const coverUrl = (thumbnails?: { url: string }[]) =>
  thumbnails?.[0]?.url.replace(/=w\d+-h\d+/, "=w400-h400") ?? ""

// Search results and playlist rows share one shape. Music videos in playlists list their
// artists as `authors`; rows without an id are songs that are no longer available.
const listItemTrack = (item: YTNodes.MusicResponsiveListItem): Track[] =>
  item.id
    ? [
        {
          id: item.id,
          title: item.title ?? "Untitled",
          artists: joinNames(item.artists ?? item.authors),
          album: item.album?.name ?? "",
          duration: item.duration?.seconds ?? 0,
          cover: coverUrl(item.thumbnail?.contents),
          artistId: firstArtistId(item.artists) ?? firstArtistId(item.authors),
          albumId: item.album?.id,
        },
      ]
    : []

interface AlbumInfo {
  title: string
  artists: string
  artistId?: string
  cover: string
}

const albumInfo = (header: Album["header"]): AlbumInfo => {
  if (header?.is(YTNodes.MusicResponsiveHeader)) {
    const browseId = header.strapline_text_one.endpoint?.payload?.browseId
    return {
      title: header.title.toString(),
      artists: header.strapline_text_one.toString(),
      artistId: typeof browseId === "string" && browseId.startsWith("UC") ? browseId : undefined,
      cover: coverUrl(header.thumbnail?.contents),
    }
  }
  if (header?.is(YTNodes.MusicDetailHeader))
    return {
      title: header.title.toString(),
      artists: header.author?.name ?? "",
      artistId: header.author?.channel_id,
      cover: coverUrl(header.thumbnails),
    }
  return { title: "", artists: "", cover: "" }
}

// Album rows leave out the cover and album, and sometimes the artist, because the album's header
// shows them. A row's own artist wins: on a compilation the header only says "Various Artists".
export const inheritFromAlbum = (track: Track, albumId: string, album: AlbumInfo): Track => ({
  ...track,
  artists: track.artists || album.artists,
  artistId: track.artistId ?? album.artistId,
  album: track.album || album.title,
  albumId,
  cover: track.cover || album.cover,
})

// Editor-made playlists have ids starting with RDCLAK5uy; the rest of a category page is
// community playlists, albums and videos.
const isEditorial = (item: YTNodes.MusicTwoRowItem) => item.item_type === "playlist" && !!item.id?.includes("RDCLAK5uy")

export function createYouTubeMusic(): MusicSource {
  // youtubei.js logs parser warnings to the console, which would draw over the TUI.
  Log.setLevel(Log.Level.NONE)

  let client: Promise<Innertube> | undefined
  const yt = () =>
    (client ??= Innertube.create({ retrieve_player: false }).catch((err) => {
      client = undefined // retry on the next call instead of caching the failure
      throw err
    }))

  return {
    async search(query) {
      const results = await (await yt()).music.search(query, { type: "song" })
      return (results.songs?.contents ?? []).flatMap(listItemTrack)
    },

    async suggestions(query) {
      // The first section holds text completions; the second, songs and artists, is left out.
      const sections = await (await yt()).music.getSearchSuggestions(query)
      return sections.flatMap((section) =>
        section.contents.flatMap((item) => (item.is(YTNodes.SearchSuggestion) ? [item.suggestion.toString()] : [])),
      )
    },

    async radio(trackId) {
      const panel = await (await yt()).music.getUpNext(trackId)
      return panel.contents.flatMap((item) =>
        item.is(YTNodes.PlaylistPanelVideo) && item.video_id
          ? [
              {
                id: item.video_id,
                title: item.title.toString(),
                artists: joinNames(item.artists),
                album: item.album?.name ?? "",
                duration: item.duration.seconds,
                cover: coverUrl(item.thumbnail),
                artistId: firstArtistId(item.artists),
                albumId: item.album?.id,
              },
            ]
          : [],
      )
    },

    async categories() {
      const page = await (await yt()).actions.execute("/browse", {
        browseId: "FEmusic_moods_and_genres",
        client: "YTMUSIC",
        parse: true,
      })
      return (page.contents_memo?.getType(YTNodes.Grid) ?? []).flatMap((grid) => {
        const group = grid.header?.is(YTNodes.GridHeader) ? grid.header.title.toString() : ""
        return grid.items.flatMap((item) => {
          const params = item.is(YTNodes.MusicNavigationButton) ? item.endpoint.payload?.params : undefined
          return item.is(YTNodes.MusicNavigationButton) && typeof params === "string"
            ? [{ id: params, title: item.button_text, group }]
            : []
        })
      })
    },

    async playlists(categoryId) {
      const page = await (await yt()).actions.execute("/browse", {
        browseId: "FEmusic_moods_and_genres_category",
        params: categoryId,
        client: "YTMUSIC",
        parse: true,
      })
      const seen = new Set<string>()
      return (page.contents_memo?.getType(YTNodes.MusicTwoRowItem) ?? []).flatMap((item) =>
        isEditorial(item) && item.id && !seen.has(item.id) && seen.add(item.id)
          ? [
              {
                id: item.id,
                title: item.title.toString(),
                subtitle: item.subtitle?.toString() ?? "",
                cover: coverUrl(item.thumbnail),
              },
            ]
          : [],
      )
    },

    async playlist(playlistId) {
      const playlist = await (await yt()).music.getPlaylist(playlistId)
      return (playlist.items ?? []).flatMap((item) =>
        item.is(YTNodes.MusicResponsiveListItem) ? listItemTrack(item) : [],
      )
    },

    async artist(artistId) {
      const page = await (await yt()).music.getArtist(artistId)
      const name = page.header?.title?.toString() ?? ""
      const items = page.sections.flatMap((shelf): ArtistItem[] => {
        if (shelf.is(YTNodes.MusicShelf)) {
          const section = shelf.title.toString()
          return shelf.contents.flatMap((item) =>
            item.item_type === "song" || item.item_type === "video"
              ? listItemTrack(item).map((track) => ({
                  section,
                  track: { ...track, artists: track.artists || name, artistId: track.artistId ?? artistId },
                }))
              : [],
          )
        }
        // The other carousels are videos, playlists and similar artists; only albums open here.
        const section = shelf.header?.is(YTNodes.MusicCarouselShelfBasicHeader) ? shelf.header.title.toString() : ""
        return shelf.contents.flatMap((item) =>
          item.is(YTNodes.MusicTwoRowItem) && item.item_type === "album" && item.id?.startsWith("MPR")
            ? [
                {
                  section,
                  album: {
                    id: item.id,
                    title: item.title.toString(),
                    subtitle: item.subtitle?.toString() ?? "",
                    cover: coverUrl(item.thumbnail),
                  },
                },
              ]
            : [],
        )
      })
      return { name, items }
    },

    async album(albumId) {
      const page = await (await yt()).music.getAlbum(albumId)
      const info = albumInfo(page.header)
      return page.contents.flatMap((item) => listItemTrack(item).map((t) => inheritFromAlbum(t, albumId, info)))
    },
  }
}
