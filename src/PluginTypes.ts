import type { PluginTypesBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginTypesBase';

import type { Plugin } from './Plugin.ts';
import type { PluginSettings } from './PluginSettings.ts';
import type { SettingsManager } from './SettingsManager.ts';
import type { SettingsTab } from './SettingsTab.ts';

export interface PluginTypes extends PluginTypesBase {
  plugin: Plugin;
  pluginSettings: PluginSettings;
  pluginSettingsManager: SettingsManager;
  pluginSettingsTab: SettingsTab;
}
