import { expect, test } from "bun:test"
import { inheritFromAlbum, type Track } from "./music"

const row: Track = { id: "r1", title: "Row", artists: "", album: "", duration: 100, cover: "" }
const album = { title: "The Album", artists: "The Band", artistId: "UCband", cover: "album.jpg" }

test("album rows take what they lack from the album's header", () => {
  expect(inheritFromAlbum(row, "MPRa", album)).toEqual({
    ...row,
    artists: "The Band",
    artistId: "UCband",
    album: "The Album",
    albumId: "MPRa",
    cover: "album.jpg",
  })
})

test("a row's own artist wins, so compilations keep each song's artist", () => {
  const own = { ...row, artists: "Guest", artistId: "UCguest" }
  const various = { title: "Hits", artists: "Various Artists", cover: "" }
  expect(inheritFromAlbum(own, "MPRa", various)).toMatchObject({ artists: "Guest", artistId: "UCguest", album: "Hits" })
})

test("a header with nothing to give leaves a usable row", () => {
  expect(inheritFromAlbum(row, "MPRa", { title: "", artists: "", cover: "" })).toMatchObject({
    artists: "",
    album: "",
    albumId: "MPRa",
    cover: "",
  })
})
