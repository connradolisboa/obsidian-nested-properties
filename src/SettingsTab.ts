import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';

import type { PluginTypes } from './PluginTypes.ts';

import {
  DEFAULT_INDENTATION_LEVEL,
  DEFAULT_INITIAL_EXPAND_LEVEL
} from './PluginSettings.ts';

const MAX_INDENTATION_LEVEL = 160;
const INDENTATION_STEP = 4;
const MAX_INITIAL_EXPAND_LEVEL = 10;

export class SettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Indentation')
      .setDesc(`Pixel offset of nested rows from their parent (default: ${String(DEFAULT_INDENTATION_LEVEL)}).`)
      .addSlider((slider) =>
        this.bind(slider.setLimits(0, MAX_INDENTATION_LEVEL, INDENTATION_STEP), 'indentationLevel')
          .setDynamicTooltip()
      );

    new Setting(this.containerEl)
      .setName('Initial expand level')
      .setDesc(
        `How many levels arrive expanded: 0 collapses everything, 1 opens the property but not its children (default: ${
          String(DEFAULT_INITIAL_EXPAND_LEVEL)
        }). A note can override it with nestedProperties.initialExpandLevel.`
      )
      .addSlider((slider) =>
        this.bind(slider.setLimits(0, MAX_INITIAL_EXPAND_LEVEL, 1), 'initialExpandLevel')
          .setDynamicTooltip()
      );

    new Setting(this.containerEl)
      .setName('Show arrays of objects as tables')
      .setDesc('Render lists whose items are flat objects as an editable table instead of a tree.')
      .addToggle((toggle) => this.bind(toggle, 'shouldShowTables'));

    new Setting(this.containerEl)
      .setName('Show indent guides')
      .setDesc('Draw a vertical guide line next to nested rows.')
      .addToggle((toggle) => this.bind(toggle, 'shouldShowIndentGuides'));

    new Setting(this.containerEl)
      .setName('Show full keys')
      .setDesc('Size key labels to their content instead of truncating them.')
      .addToggle((toggle) => this.bind(toggle, 'isFullKeyDisplayEnabled'));
  }
}
