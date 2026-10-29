import { expect, test } from "bun:test"
import { helpText, parseArgs } from "./cli"

test("no arguments start the app", () => {
  expect(parseArgs([])).toEqual({ kind: "run" })
})

test("--help and --version, long and short", () => {
  expect(parseArgs(["--help"])).toEqual({ kind: "help" })
  expect(parseArgs(["-h"])).toEqual({ kind: "help" })
  expect(parseArgs(["--version"])).toEqual({ kind: "version" })
  expect(parseArgs(["-v"])).toEqual({ kind: "version" })
  expect(parseArgs(["-v", "--help"])).toEqual({ kind: "help" })
})

test("anything else is an error naming the argument", () => {
  expect(parseArgs(["--loud"])).toEqual({ kind: "error", message: "unknown option: --loud" })
  expect(parseArgs(["daft punk"])).toEqual({ kind: "error", message: "unknown option: daft punk" })
})

test("help names the version and the environment variables", () => {
  const text = helpText("1.2.3")
  expect(text).toStartWith("ytm-tui 1.2.3")
  for (const name of ["YTM_NO_SPLASH", "YTM_MPV_ARGS", "YTM_IMAGE_PROTOCOL"]) expect(text).toContain(name)
})
