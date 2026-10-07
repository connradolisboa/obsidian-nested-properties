# Nested Properties Plus

[![GitHub release](https://img.shields.io/github/v/release/connradolisboa/obsidian-nested-properties)](https://github.com/connradolisboa/obsidian-nested-properties/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/connradolisboa/obsidian-nested-properties/total)](https://github.com/connradolisboa/obsidian-nested-properties/releases)

This is a plugin for [Obsidian](https://obsidian.md/) that allows to view/edit nested frontmatter properties.

This started as a fork of [Nested Properties](https://github.com/mnaoumov/obsidian-nested-properties) by Michael Naumov. It has its own plugin ID (`nested-properties-plus`), name and CSS class prefix (`npp-`), so it can be installed next to the original without the two being confused. Don't enable both at once: they patch the same Obsidian internals.

Type assignments are stored in Obsidian's own `types.json` using the same `list`/`object` type names and dotted keys as the original, so switching between the two keeps your types.

Inspired by the [Feature request](https://forum.obsidian.md/t/properties-bases-support-multi-level-yaml-mapping-of-mappings-nested-attributes/63826).

```yaml
---
level1simple: simple1
level1Nested:
  level2simple: simple2
  level2Nested:
    level3simple: simple3
    level3Nested:
      level4simple: simple4
      level4Nested:
        level5simple: simple5
---
```

![Nested Properties Screenshot](<./images/screenshot.png>)

## Features

- Nested objects and arrays render as a collapsible tree inside the native Properties panel (and the File properties sidebar)
- Nested property types in Obsidian's own *Property type* menu: **Object**, **Mixed list**, and **List of objects**. Choosing a type on an empty property creates its matching structure; a list of objects opens as a table
- Per-path types for nested properties, with **Automatic** to go back to inferring from the value. Inside arrays you can set a field's type for all items or just one item
- Changing to a type the current value doesn't fit asks for confirmation before converting it
- Lists of flat objects render as an **editable table**: edit cells with the native widgets, add/rename/reorder/delete columns, add/insert/duplicate/move/delete rows. An empty typed table gets a visible `value` cell on its first row, which can be renamed
- Flat lists (strings, numbers, booleans) render as normal list properties and stay expanded
- Edit everything in place: rename nested keys by clicking them, add properties and list items, reorder, duplicate, cut/copy/paste and remove from the context menu
- Collapsed properties show a one-line summary with an item count
- Indent guides, adjustable indentation, initial expand level (per vault, or per note with `nestedProperties.initialExpandLevel`), and full key display
- Touch-friendly row and property controls, with horizontally scrollable tables on narrow screens

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Indentation | `16` | Pixel offset of nested rows from their parent |
| Initial expand level | `0` | How many levels are expanded when a note opens (`0` collapses everything). Override per note with `nestedProperties.initialExpandLevel` |
| Show arrays of objects as tables | on | Render lists of flat objects as an editable table instead of a tree |
| Show indent guides | on | Draw a vertical guide line next to nested rows |
| Show full keys | off | Size key labels to their content instead of truncating them |

## Installation

The plugin is not available in [the official Community Plugins repository](https://obsidian.md/plugins) yet.

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/connradolisboa/obsidian-nested-properties).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command in the `DevTools Console`:

```js
window.DEBUG.enable('nested-properties-plus');
```

For more details, refer to the [documentation](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md).

## License

This fork is distributed under the same [MIT License](LICENSE) as the original project. See the [LICENSE](LICENSE) file for the original copyright notice.

Fork maintained by [Connrado Lisboa](https://github.com/connradolisboa/).
