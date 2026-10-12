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
  private activeTab: 'settings' | 'docs' = 'settings';

  public override display(): void {
    this.containerEl.empty();

    const tabs = this.containerEl.createDiv({ cls: 'npp-settings-tabs' });
    tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;';
    for (const [id, label] of [['settings', 'Settings'], ['docs', 'Docs']] as const) {
      const button = tabs.createEl('button', { text: label });
      if (id === this.activeTab) button.addClass('mod-cta');
      button.addEventListener('click', () => {
        this.activeTab = id;
        this.display();
      });
    }

    const content = this.containerEl.createDiv({ cls: 'npp-settings-content' });
    if (this.activeTab === 'docs') {
      this.renderDocs(content);
      return;
    }

    new Setting(content)
      .setName('Indentation')
      .setDesc(`Pixel offset of nested rows from their parent (default: ${String(DEFAULT_INDENTATION_LEVEL)}).`)
      .addSlider((slider) =>
        this.bind(slider.setLimits(0, MAX_INDENTATION_LEVEL, INDENTATION_STEP), 'indentationLevel')
          .setDynamicTooltip()
      );

    new Setting(content)
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

    new Setting(content)
      .setName('Show arrays of objects as tables')
      .setDesc('Render lists whose items are flat objects as an editable table instead of a tree.')
      .addToggle((toggle) => this.bind(toggle, 'shouldShowTables'));

    new Setting(content)
      .setName('Show indent guides')
      .setDesc('Draw a vertical guide line next to nested rows.')
      .addToggle((toggle) => this.bind(toggle, 'shouldShowIndentGuides'));

    new Setting(content)
      .setName('Show full keys')
      .setDesc('Size key labels to their content instead of truncating them.')
      .addToggle((toggle) => this.bind(toggle, 'isFullKeyDisplayEnabled'));
  }

  private renderDocs(el: HTMLElement): void {
    el.createEl('h3', { text: 'Nested Properties Plus Docs' });
    el.createEl('p', { text: 'A quick guide to structured frontmatter, property types, and editing nested values in Obsidian’s Properties panel.' });
    const search = el.createEl('input', { type: 'search', attr: { placeholder: 'Search the docs', 'aria-label': 'Search Nested Properties Plus docs' } });
    const entries: HTMLElement[] = [];
    const entry = (title: string, description: string, example?: string): void => {
      const details = el.createEl('details', { cls: 'npp-docs-entry' });
      details.createEl('summary', { text: title });
      details.createEl('p', { text: description });
      if (example) details.createEl('pre').createEl('code', { text: example });
      entries.push(details);
    };

    entry('Start with nested YAML', 'Nested objects and lists in frontmatter appear as collapsible properties in the native Properties panel and File properties sidebar. The stored YAML remains the source of truth.', '---\nproject:\n  name: Example\n  status: active\n  tasks:\n    - title: Draft\n      done: false\n---');
    entry('Choose a nested type', 'Use Obsidian’s Property type menu to choose Object, Mixed list, or List of objects for an empty or existing nested property. Object creates a map of key/value fields. Mixed list can hold nested values. List of objects displays flat object rows as an editable table.');
    entry('Per-path property types', 'Assign a type to one dotted property path. Inside arrays, choose whether the type applies to that field for every item or only the selected item. Choose Automatic to return to value-based type inference. Type assignments are stored in Obsidian’s types.json using compatible list/object type names and dotted keys.');
    entry('Edit nested values', 'Click a key to rename it or a value to edit it. Use Add property, Add item, or Add row as appropriate. Context menus provide actions such as reorder, duplicate, move, cut, copy, and delete; table headers also let you manage columns.');
    entry('Table behavior', 'Flat lists of objects can render as editable tables. Turn Show arrays of objects as tables off to render those values as a tree. On narrow screens, tables scroll horizontally. An explicitly typed empty object list can begin with a placeholder value column that you can rename.');
    entry('Expand depth', 'Initial expand level controls how many nested levels open when the note is viewed: 0 collapses all levels, 1 opens the top-level property, and higher values open deeper levels. A note can override the setting with nestedProperties.initialExpandLevel.', '---\nnestedProperties:\n  initialExpandLevel: 2\n---');
    entry('Display settings', 'Indentation sets the pixel offset of child rows. Show indent guides draws a guide beside nested rows. Show full keys avoids truncating long key labels. These settings affect display; they do not change the YAML structure.');

    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      for (const item of entries) item.hidden = Boolean(query) && !item.textContent?.toLocaleLowerCase().includes(query);
    });
  }
}
