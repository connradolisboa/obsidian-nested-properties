import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginTypes } from './PluginTypes.ts';

import { NestedPropertyRenderer } from './NestedPropertyRenderer.ts';
import { SettingsManager } from './SettingsManager.ts';
import { SettingsTab } from './SettingsTab.ts';

export class Plugin extends PluginBase<PluginTypes> {
  protected override createSettingsManager(): SettingsManager {
    return new SettingsManager(this);
  }

  protected override createSettingsTab(): SettingsTab {
    return new SettingsTab(this);
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    const renderer = new NestedPropertyRenderer(this);
    this.settingsManager.on('saveSettings', () => {
      renderer.applyBodyClasses();
      renderer.reloadAllProperties();
    });
    renderer.register();
  }
}
