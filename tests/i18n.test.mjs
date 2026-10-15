// Every LOC tag the scripts and the modinfo use is defined in the English, and every language file under
// text/<lang>/ carries exactly the English tag set, each tag once, under the Language the modinfo loads it with, with
// the same {1_Num}-style placeholders and every number. A missing tag shows the player the English (or the raw tag),
// a duplicate rolls back the whole file, and a lost placeholder shows the wrong value.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// The game's own tags the mod borrows.
const GAME_TAGS = new Set(["LOC_MODULE_BASE_STANDARD_NAME", "LOC_OPTIONS_CONFIRM_CHANGES", "LOC_UI_CONTENT_MGR_SUBTITLE",
  "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION", "LOC_UI_MINI_MAP_RESOURCE", "LOC_UI_MINI_MAP_YIELDS"]);

function englishRows() {
  const rows = [...read("text/en_us/ModText.xml").matchAll(/<Row\s+Tag="([A-Z0-9_]+)"\s*>\s*<Text>([\s\S]*?)<\/Text>/g)];
  return rows.map((match) => ({ tag: match[1], text: unescape(match[2]) }));
}

function languageRows(xml) {
  const re = /<Replace\s+Tag="([A-Z0-9_]+)"\s+Language="([^"]+)"\s*>\s*<Text>([\s\S]*?)<\/Text>\s*<\/Replace>/g;
  return [...xml.matchAll(re)].map((match) => ({ tag: match[1], language: match[2], text: unescape(match[3]) }));
}

const placeholders = (text) => (text.match(/\{\d+_[A-Za-z]+\}/g) ?? []).sort().join(" ");
const numbers = (text) => (text.match(/\d+/g) ?? []).sort();

const english = englishRows();
const englishText = new Map(english.map((row) => [row.tag, row.text]));

// Language folder -> the locale the modinfo loads it under.
const loaded = new Map([...read("zoom-tilt-rotate.modinfo")
  .matchAll(/<Item locale="([^"]+)">text\/([a-z_]+)\/ModText\.xml<\/Item>/g)].map((match) => [match[2], match[1]]));

test("the English has each tag once", () => {
  assert.equal(englishText.size, english.length);
});

test("every tag the scripts and modinfo use is defined", () => {
  const sources = fs.readdirSync("ui").filter((file) => file.endsWith(".js")).map((file) => read(path.join("ui", file)));
  sources.push(read("zoom-tilt-rotate.modinfo"));
  const used = new Set(sources.flatMap((source) => source.match(/LOC_[A-Z0-9_]+/g) ?? []));
  const missing = [...used].filter((tag) => !englishText.has(tag) && !GAME_TAGS.has(tag));
  assert.deepEqual(missing, []);
});

test("every English tag is used", () => {
  const sources = fs.readdirSync("ui").map((file) => read(path.join("ui", file))).join("\n") +
    read("zoom-tilt-rotate.modinfo");
  // The options group header is named by the game from the group id.
  const unused = [...englishText.keys()].filter((tag) => !sources.includes(tag) &&
    tag !== "LOC_OPTIONS_GROUP_ZOOM_TILT_ROTATE");
  assert.deepEqual(unused, []);
});

test("the modinfo loads every language folder, in both scopes", () => {
  const folders = fs.readdirSync("text", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "en_us").map((entry) => entry.name).sort();
  assert.deepEqual([...loaded.keys()].sort(), folders);
  const lines = read("zoom-tilt-rotate.modinfo").match(/<Item locale=/g) ?? [];
  assert.equal(lines.length, folders.length * 2);
});

for (const [folder, locale] of loaded) {
  test(`${folder} matches the English`, () => {
    const xml = read(path.join("text", folder, "ModText.xml"));
    const rows = languageRows(xml);
    assert.equal((xml.match(/<Replace\b/g) ?? []).length, rows.length, "a Replace element the check can't read");
    const seen = new Set();
    for (const row of rows) {
      assert.ok(!seen.has(row.tag), `duplicate ${row.tag}`);
      seen.add(row.tag);
      assert.equal(row.language, locale, `${row.tag} Language`);
      assert.ok(englishText.has(row.tag), `${row.tag} isn't an English tag`);
      assert.ok(row.text.trim(), `${row.tag} is empty`);
      const source = englishText.get(row.tag);
      assert.equal(placeholders(row.text), placeholders(source), `${row.tag} placeholders`);
      const have = numbers(row.text);
      for (const number of numbers(source)) {
        const index = have.indexOf(number);
        assert.ok(index >= 0, `${row.tag} loses the number ${number}`);
        have.splice(index, 1);
      }
    }
    assert.deepEqual([...englishText.keys()].filter((tag) => !seen.has(tag)), [], "missing tags");
  });
}
