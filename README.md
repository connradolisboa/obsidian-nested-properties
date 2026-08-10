# Nested Properties (fork)

[![GitHub release](https://img.shields.io/github/v/release/connradolisboa/obsidian-nested-properties)](https://github.com/connradolisboa/obsidian-nested-properties/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/connradolisboa/obsidian-nested-properties/total)](https://github.com/connradolisboa/obsidian-nested-properties/releases)

This is a plugin for [Obsidian](https://obsidian.md/) that allows to view/edit nested frontmatter properties.

This is an independent fork of the original [Nested Properties](https://github.com/mnaoumov/obsidian-nested-properties) plugin by Michael Naumov, maintained separately under its own plugin ID (`nested-properties-fork`) so it no longer tracks upstream releases.

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

- Render nested YAML objects and arrays as a collapsible tree inside the Properties editor
- Collapse/expand individual properties or all at once
- Context menu (Cut, Copy, Paste, Remove) on nested properties
- Add new properties at any nesting level
- Horizontal scrolling for deeply nested structures

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
window.DEBUG.enable('nested-properties-fork');
```

For more details, refer to the [documentation](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md).

## License

This fork is distributed under the same [MIT License](LICENSE) as the original project. See the [LICENSE](LICENSE) file for the original copyright notice.

Fork maintained by [Connrado Lisboa](https://github.com/connradolisboa/).
