import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginTypes } from './PluginTypes.ts';

import { registerNestedPropertyRenderer } from './NestedPropertyRenderer.ts';
import { INDENT_CSS_VAR } from './NestedPropertyRenderer.ts';
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
    this.applyIndentationCssVar();
    this.settingsManager.on('saveSettings', () => {
      this.applyIndentationCssVar();
    });
    registerNestedPropertyRenderer(this);
  }

  private applyIndentationCssVar(): void {
    document.body.style.setProperty(INDENT_CSS_VAR, `${String(this.settings.indentationLevel)}px`);
  }
}
