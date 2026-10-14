# Translating Zoom, Tilt, & Rotate (`text/`)

Every string a player sees from this mod is a `LOC_ZOOM_TILT_ROTATE_*` tag defined here: the mod's name and description
in the Additional Content list, the rows in Options > Add-ons, the Camera keys window, the camera panel and the dials
on screen, their tooltips, and the key names the key list shows. The scripts carry the English beside each tag only as
a fallback for a language file that's missing a line.

## Files

| File | Contents |
| --- | --- |
| `en_us/ModText.xml` | The English source. |
| `<lang>/ModText.xml` | The same tags in one language: `de_de`, `es_es`, `fr_fr`, `it_it`, `ja_jp`, `ko_kr`, `pl_pl`, `pt_br`, `ru_ru`, `zh_cn` (Simplified, `zh_Hans_CN`) and `zh_hk` (Traditional, `zh_Hant_HK`). |

The eleven languages are translations that use the game's own words for its terms (Options, Add-ons, the
minimap, the journal), taken from the game's l10n files. To correct one, edit its `<Text>`; to change the English,
edit the English and update every language. A new language needs no code change: add its file here and a line for
it in both `UpdateText` lists in `zoom-tilt-rotate.modinfo`.

## Two file shapes

English uses an `EnglishText` block with `Row`; every other language uses a `LocalizedText` block with `Replace` and a
`Language` attribute:

```xml
<Database>
    <LocalizedText>
        <Replace Tag="LOC_MOD_ZOOM_TILT_ROTATE_NAME" Language="de_DE"><Text>...</Text></Replace>
    </LocalizedText>
</Database>
```

## Rules

- Every tag once per file: one duplicate tag rolls back the whole file.
- Keep the placeholders exactly: `{1_Num}` is a number of degrees or a magnification, `{1_Key}` a key on the number
  pad.
- Keep the numbers (1x, 7x, 18x, 36x, 0) and the degree sign.
- Key names (`KEY_NAME_*`) are what that language's keyboards print: Strg rather than Ctrl in German, Maj for Shift in
  French.
- `npm run verify` checks every language file against the English tag set, placeholders and numbers.
