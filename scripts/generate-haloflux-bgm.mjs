// Regenerates src/client/animations/haloflux-bgm-assets.ts from
// assets/haloflux-bgm.mp3 — "Synthwave 421k" by The Cynic Project, cynicmusic —
// CC0, from the HALOFLUX wallpaper project. The committed asset is a 128 s
// excerpt with a 3 s tail fade: the engine's run ceiling is 120 s, and the
// full 7'54" track made the client bundle ~5.5 MB (base64-inlined), which was
// the dominant cost of every page load. To refresh the asset from the source
// project's full track:
//   ffmpeg -y -i sw421k.mp3 -codec:a libmp3lame -b:a 64k -t 128 -af "afade=t=out:st=125:d=3" assets/haloflux-bgm.mp3
// then run: node scripts/generate-haloflux-bgm.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mp3 = await readFile(path.join(root, "assets", "haloflux-bgm.mp3"));

const ts = `// haloflux-bgm-assets.ts — GENERATED FILE, do not edit by hand.
// Regenerate with: node scripts/generate-haloflux-bgm.mjs
// Source: assets/haloflux-bgm.mp3 — a 128 s excerpt of "Synthwave 421k"
// (64 kbps stereo, 3 s tail fade) by The Cynic Project (cynicmusic), from the
// Pixelsphere soundtrack, released under CC0 (HALOFLUX wallpaper project
// credits; the full 7'54" track lives upstream). The haloflux engine streams
// it as the default BGM in wallMedia "off" mode: this constant is decoded
// into a Blob and played via a Blob object URL.
export const HALOFLUX_BGM_BASE64 = "${mp3.toString("base64")}";
`;

const target = path.join(root, "src", "client", "animations", "haloflux-bgm-assets.ts");
await writeFile(target, ts);
console.log(`wrote ${target} (${ts.length} bytes)`);
