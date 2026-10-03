// Host entry: intentionally an empty shell. All behavior lives in the web
// client bundle (lib/client.js); keeping this side dependency-free is what
// immunizes the plugin against dsh core boot failures.
export const name = "dsh-opening-animation";

export function apply(): void {}
