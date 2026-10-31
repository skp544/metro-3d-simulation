// Downloads each line article's station table from English Wikipedia into
// data/raw/wikipedia/<date>.json. Used only to cross-check OSM (names, station layout).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

type WikiStation = { name: string; layout: string | null };

const { lines } = JSON.parse(await readFile("data/manual/lines.json", "utf8")) as {
  lines: { id: string; wikipedia: string }[];
};

const LAYOUT = /^(elevated|underground|at[- ]grade)$/i;
const text = (html: string) =>
  html
    .replace(/<sup[\s\S]*?<\/sup>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;|&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const cells = (row: string) =>
  [...row.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g)].map((m) => ({ attrs: m[1], html: m[2] }));

// One row per station, with a layout cell that may span several rows (rowspan).
// Branches (Blue, Green) and planned extensions (Magenta) have separate tables, so read all of them;
// build-dataset.ts matches by name, so rows for unbuilt stations are harmless.
function parseTable(table: string): WikiStation[] {
  const out: WikiStation[] = [];
  let carry: { layout: string; rows: number } | null = null;
  for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cs = cells(row);
    // The first linked cell that isn't a row number is the English station name.
    const nameCell = cs.find((c) => /<a /.test(c.html) && !/^\d+$/.test(text(c.html)));
    const layoutCell = cs.find((c) => LAYOUT.test(text(c.html)));
    let layout: string | null = null;
    if (layoutCell) {
      layout = text(layoutCell.html).toLowerCase().replace(/[- ]/, "_");
      const span = Number(/rowspan="?(\d+)/.exec(layoutCell.attrs)?.[1] ?? 1);
      carry = span > 1 ? { layout, rows: span - 1 } : null;
    } else if (carry && nameCell) {
      layout = carry.layout;
      if (--carry.rows === 0) carry = null;
    }
    if (nameCell && layout) out.push({ name: text(nameCell.html), layout });
  }
  return out;
}

const parseStations = (html: string) =>
  (html.match(/<table[^>]*wikitable[\s\S]*?<\/table>/g) ?? [])
    .filter((t) => /Layout/i.test(text(t.slice(0, 3000))))
    .flatMap(parseTable);

// Infobox "Stations" and "Line length": reference figures for validate.ts (warning-level comparison).
function parseInfobox(html: string) {
  const box = /<table[^>]*class="[^"]*infobox[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
  const field = (label: RegExp) => {
    for (const row of box.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const th = /<th[^>]*>([\s\S]*?)<\/th>/.exec(row);
      const td = /<td[^>]*>([\s\S]*?)<\/td>/.exec(row);
      if (th && td && label.test(text(th[1]))) return text(td[1]);
    }
    return null;
  };
  // Blue lists branches separately ("Line 3 (Main Line): 50 Line 4 (Branch): 8"): sum the parts.
  const num = (s: string | null) => {
    if (!s) return null;
    const parts = [...s.matchAll(/:\s*([\d.,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
    if (parts.length > 1) return Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
    const first = /[\d.,]+/.exec(s);
    return first ? Number(first[0].replace(/,/g, "")) : null;
  };
  const stations = field(/^Stations$/i);
  return {
    stations: num(stations),
    lengthKm: num(field(/^(Line )?length$/i)),
    // true when branches are counted separately, so an interchange between branches counts twice
    perBranch: !!stations && [...stations.matchAll(/:\s*[\d.,]+/g)].length > 1,
  };
}

async function fetchArticle(title: string) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|revid&redirects=1&format=json&formatversion=2`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "metro-route-dataset/0.1" } });
    if (res.ok) return ((await res.json()) as { parse: { title: string; revid: number; text: string } }).parse;
    if (res.status !== 429 || attempt === 4) throw new Error(`Wikipedia HTTP ${res.status} for ${title}`);
    await sleep(5000 * attempt);
  }
}

const result: Record<string, { article: string; revid: number; infobox: ReturnType<typeof parseInfobox>; stations: WikiStation[] }> = {};
for (const line of lines) {
  const parse = await fetchArticle(line.wikipedia);
  const stations = parseStations(parse.text);
  const infobox = parseInfobox(parse.text);
  result[line.id] = { article: parse.title, revid: parse.revid, infobox, stations };
  console.log(`${line.id}: ${stations.length} rows with layout, infobox ${JSON.stringify(infobox)} (rev ${parse.revid})`);
  await sleep(1500);
}

const date = new Date().toISOString().slice(0, 10);
await mkdir("data/raw/wikipedia", { recursive: true });
await writeFile(
  `data/raw/wikipedia/${date}.json`,
  JSON.stringify({ fetchedAt: new Date().toISOString(), licence: "CC BY-SA 4.0", lines: result }, null, 1),
);
console.log(`Saved data/raw/wikipedia/${date}.json`);
