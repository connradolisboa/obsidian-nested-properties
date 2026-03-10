import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';

import type { PluginTypes } from './PluginTypes.ts';

import { DEFAULT_INDENTATION_LEVEL } from './PluginSettings.ts';

export class SettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Indentation level')
      .setDesc(`Pixel offset for nested property values (default: ${String(DEFAULT_INDENTATION_LEVEL)})`)
      .addSlider((slider) =>
        this.bind(slider.setLimits(0, 400, 8), 'indentationLevel')
          .setDynamicTooltip()
      );
  }
}
