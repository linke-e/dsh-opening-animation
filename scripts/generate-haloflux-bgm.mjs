// Regenerates src/client/animations/haloflux-bgm-assets.ts from
// assets/haloflux-bgm.mp3 — the FULL "Synthwave 421k" track (7'54", 64 kbps
// stereo) by The Cynic Project, cynicmusic — CC0, from the HALOFLUX wallpaper
// project (committed alongside this script). The engine streams it at runtime:
// the base64 constant is decoded into a Blob and played through a Blob
// object URL (never a 10 MB data-URL string in the bundle). To refresh the
// asset from the source project:
//   ffmpeg -y -i sw421k.mp3 -codec:a libmp3lame -b:a 64k assets/haloflux-bgm.mp3
// then run: node scripts/generate-haloflux-bgm.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mp3 = await readFile(path.join(root, "assets", "haloflux-bgm.mp3"));

const ts = `// haloflux-bgm-assets.ts — GENERATED FILE, do not edit by hand.
// Regenerate with: node scripts/generate-haloflux-bgm.mjs
// Source: assets/haloflux-bgm.mp3 — the full "Synthwave 421k" track (7'54",
// 64 kbps stereo) by The Cynic Project (cynicmusic), from the Pixelsphere
// soundtrack, released under CC0 (HALOFLUX wallpaper project credits). The
// haloflux engine streams it as the default BGM in wallMedia "off" mode:
// this constant is decoded into a Blob and played via a Blob object URL.
export const HALOFLUX_BGM_BASE64 = "${mp3.toString("base64")}";
`;

const target = path.join(root, "src", "client", "animations", "haloflux-bgm-assets.ts");
await writeFile(target, ts);
console.log(`wrote ${target} (${ts.length} bytes)`);
