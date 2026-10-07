import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';

import type { PluginSettings } from './PluginSettings.ts';
import type { PluginTypes } from './PluginTypes.ts';

import {
  DEFAULT_INDENTATION_LEVEL,
  DEFAULT_INITIAL_EXPAND_LEVEL
} from './PluginSettings.ts';

export class SettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return {
      indentationLevel: DEFAULT_INDENTATION_LEVEL,
      initialExpandLevel: DEFAULT_INITIAL_EXPAND_LEVEL,
      isFullKeyDisplayEnabled: false,
      shouldShowIndentGuides: true,
      shouldShowTables: true
    };
  }
}
