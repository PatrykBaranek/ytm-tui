import { Innertube, Log, YTNodes } from "youtubei.js"

export interface Track {
  id: string
  title: string
  artists: string
  album: string
  duration: number
  cover: string
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

export interface MusicSource {
  search(query: string): Promise<Track[]>
  // Songs YouTube Music would play after this one; used for autoplay when the queue runs out.
  radio(trackId: string): Promise<Track[]>
  categories(): Promise<Category[]>
  // Playlists YouTube Music's editors made for a category.
  playlists(categoryId: string): Promise<PlaylistInfo[]>
  playlist(playlistId: string): Promise<Track[]>
}

const joinNames = (artists?: { name: string }[]) => artists?.map((a) => a.name).join(", ") ?? ""

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
        },
      ]
    : []

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
  }
}
