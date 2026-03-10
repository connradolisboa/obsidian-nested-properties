import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';

import type { PluginTypes } from './PluginTypes.ts';

import { DEFAULT_INDENTATION_LEVEL } from './PluginSettings.ts';
import type { PluginSettings } from './PluginSettings.ts';

export class SettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return {
      indentationLevel: DEFAULT_INDENTATION_LEVEL
    };
  }
}
