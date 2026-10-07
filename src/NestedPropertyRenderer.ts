import type { GenericObject } from 'obsidian-dev-utils/TypeGuards';
import type {
  PropertyRenderContext,
  PropertyWidget,
  PropertyWidgetComponentBase
} from 'obsidian-typings';

import {
  Menu,
  Notice,
  setIcon
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';

import type { Plugin } from './Plugin.ts';

import {
  ComplexWidgets,
  LIST_WIDGET_TYPE,
  OBJECT_LIST_WIDGET_TYPE
} from './ComplexWidgets.ts';
import { TypeChangeModal } from './TypeChangeModal.ts';
import {
  getFieldTypeKey,
  getItemTypeKey,
  getPathDepth,
  getRootPath
} from './TypeKeys.ts';
import {
  cloneValue,
  convertValue,
  formatValueSummary,
  getTableColumns,
  isLossyConversion,
  isPlainObject,
  isTableArray,
  moveItem,
  moveKey,
  renameKey,
  replaceObjectContents
} from './ValueUtils.ts';

export const INDENT_CSS_VAR = '--npp-indent';
const FULL_KEY_DISPLAY_CLASS = 'npp-full-key-display';
const NO_INDENT_GUIDES_CLASS = 'npp-no-indent-guides';
const MENU_DELAY_IN_MILLISECONDS = 200;

type Container = GenericObject | unknown[];

interface MetadataEditorLike {
  serialize(): unknown;
  synchronize(data: unknown): void;
}

/**
 * A slot in the model: `parent[key]`, addressed in the vault by `path`.
 */
interface NodeRef {
  readonly key: number | string;
  readonly parent: Container;
  readonly path: string;
}

interface PendingFocus {
  readonly path: string;
  readonly target: 'key' | 'value';
}

/**
 * Renders one top-level complex property. Owns a private mutable copy of the value: edits mutate it in place
 * and push a fresh clone to Obsidian, and structural edits re-render the tree from it, so later edits never
 * write back a stale snapshot.
 */
class NestedTree {
  private readonly plugin: Plugin;
  private readonly propertyEl: HTMLElement | null;
  private readonly rootPath: string;

  public constructor(
    private readonly renderer: NestedPropertyRenderer,
    private readonly el: HTMLElement,
    private readonly model: Container,
    private readonly ctx: PropertyRenderContext
  ) {
    this.plugin = renderer.plugin;
    this.rootPath = getRootPath(ctx.sourcePath, ctx.key);
    const propertyEl = el.closest('.metadata-property');
    this.propertyEl = propertyEl instanceof HTMLElement ? propertyEl : null;
  }

  public focus(): void {
    const target = this.el.querySelector('.npp-body input, .npp-body textarea, .npp-body [contenteditable]');
    if (target instanceof HTMLElement) {
      target.focus();
    }
  }

  public mount(): void {
    this.setUpRootProperty();
    this.render();
  }

  private addEntryButton(containerEl: HTMLElement, text: string, onClick: () => void): HTMLElement {
    const buttonEl = containerEl.createDiv({ cls: 'npp-add-button' });
    setIcon(buttonEl.createSpan({ cls: 'npp-add-button-icon' }), 'plus');
    buttonEl.createSpan({ text });
    buttonEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      onClick();
    });
    return buttonEl;
  }

  private addTypeSubmenu(menu: Menu, title: string, typeKey: string, refs: NodeRef[]): void {
    const metadataTypeManager = this.plugin.app.metadataTypeManager;
    const firstRef = refs[0];
    if (!firstRef) {
      return;
    }
    const assignedType = metadataTypeManager.getAssignedWidget(typeKey);
    const inferred = this.renderer.widgets.inferWidget(getValue(firstRef));
    menu.addItem((item) => {
      item.setTitle(title).setIcon('lucide-info').setSection('type');
      const submenu = item.setSubmenu();
      submenu.addItem((subItem) => {
        subItem.setTitle(assignedType ? 'Automatic' : `Automatic (${inferred.name()})`)
          .setIcon('lucide-loader')
          .setChecked(!assignedType)
          .onClick(() => {
            invokeAsyncSafely(() => this.changeType(typeKey, null, refs));
          });
      });
      for (const widget of Object.values(metadataTypeManager.registeredTypeWidgets)) {
        submenu.addItem((subItem) => {
          subItem.setTitle(widget.name())
            .setIcon(widget.icon)
            .setChecked(widget.type === assignedType)
            .onClick(() => {
              invokeAsyncSafely(() => this.changeType(typeKey, widget, refs));
            });
        });
      }
    });
  }

  private afterRender(): void {
    window.setTimeout(() => {
      const metadataContainerEl = this.el.closest('.metadata-container');
      if (metadataContainerEl instanceof HTMLElement) {
        injectHeaderActions(this.renderer, metadataContainerEl);
      }
      this.applyPendingFocus();
    }, 0);
  }

  private applyPendingFocus(): void {
    const pendingFocus = this.renderer.pendingFocus;
    if (!pendingFocus) {
      return;
    }
    const targetEl = this.el.querySelector(`[data-npp-path="${CSS.escape(pendingFocus.path)}"]`);
    if (!(targetEl instanceof HTMLElement)) {
      return;
    }
    this.renderer.pendingFocus = null;
    if (pendingFocus.target === 'key') {
      const keyInputEl = targetEl.querySelector('.metadata-property-key-input');
      if (keyInputEl instanceof HTMLInputElement) {
        keyInputEl.focus();
        keyInputEl.select();
      }
      return;
    }
    const valueEl = targetEl.matches('.metadata-property-value') ? targetEl : targetEl.querySelector(':scope > .metadata-property-value');
    const focusTargetEl = valueEl?.querySelector('input, textarea, [contenteditable]');
    if (focusTargetEl instanceof HTMLElement) {
      focusTargetEl.focus();
    } else if (valueEl instanceof HTMLElement) {
      valueEl.click();
    }
  }

  private async changeType(typeKey: string, widget: null | PropertyWidget, refs: NodeRef[]): Promise<void> {
    const metadataTypeManager = this.plugin.app.metadataTypeManager;
    if (widget) {
      const isLossy = refs.some((ref) => {
        const value = getValue(ref);
        return value !== null && value !== undefined && value !== '' && isLossyConversion(widget.type, value);
      });
      if (isLossy && !await TypeChangeModal.confirm(this.plugin.app, widget.name())) {
        return;
      }
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!widget) {
      await metadataTypeManager.unsetType(typeKey);
      this.render();
      return;
    }

    await metadataTypeManager.setType(typeKey, widget.type);
    let hasChanged = false;
    for (const ref of refs) {
      const value = getValue(ref);
      if (value === undefined) {
        continue;
      }
      const converted = convertValue(widget.type, value);
      if (converted !== value) {
        setValue(ref, converted);
        hasChanged = true;
      }
    }
    if (hasChanged) {
      this.commit(true);
    } else {
      this.render();
    }
  }

  private commit(isStructural: boolean): void {
    this.ctx.onChange(cloneValue(this.model));
    if (isStructural) {
      this.render();
    }
  }

  private createMenu(): Menu {
    const menu = new Menu();
    menu.onHide(() => {
      this.renderer.lastMenuCloseTime = Date.now();
    });
    menu.addSections(['type', 'action', 'clipboard', '', 'danger']);
    return menu;
  }

  private createSummary(treeEl: HTMLElement, value: unknown, rowEl: HTMLElement | null, path: string): void {
    const summaryEl = treeEl.createDiv({ cls: 'npp-summary' });
    const count = Array.isArray(value) ? value.length : Object.keys(value as GenericObject).length;
    summaryEl.createSpan({ cls: 'npp-summary-count', text: Array.isArray(value) ? `${String(count)} items` : `${String(count)} fields` });
    summaryEl.createSpan({ cls: 'npp-summary-text', text: formatValueSummary(value) });
    if (!rowEl) {
      return;
    }
    summaryEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      rowEl.removeClass('npp-collapsed');
      this.renderer.expansionOverrides.set(path, true);
    });
  }

  private getColumnWidget(rows: GenericObject[], path: string, column: string): PropertyWidget {
    const assigned = this.renderer.getAssignedWidget(`${path}.0.${column}`);
    if (assigned && !this.renderer.widgets.isComplexWidget(assigned)) {
      return assigned;
    }
    const sample = rows.map((row) => row[column]).find((cell) => cell !== null && cell !== undefined && cell !== '');
    return this.renderer.widgets.inferWidget(sample ?? '');
  }

  private getWidget(path: string, value: unknown): PropertyWidget {
    const widgets = this.renderer.widgets;
    const assigned = this.renderer.getAssignedWidget(path);
    if (assigned && (!widgets.isComplexWidget(assigned) || assigned.validate(value))) {
      return assigned;
    }
    return widgets.inferWidget(value);
  }

  private promptInline(hostEl: HTMLElement, placeholder: string, initialValue: string, onSubmit: (value: string) => void, onCancel: () => void): void {
    hostEl.empty();
    const inputEl = hostEl.createEl('input', {
      attr: { placeholder, type: 'text' },
      cls: 'npp-inline-input',
      value: initialValue
    });
    let isDone = false;
    function finish(shouldSubmit: boolean): void {
      if (isDone) {
        return;
      }
      isDone = true;
      const value = inputEl.value.trim();
      if (shouldSubmit && value) {
        onSubmit(value);
      } else {
        onCancel();
      }
    }
    inputEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
    });
    inputEl.addEventListener('keydown', (evt) => {
      evt.stopPropagation();
      if (evt.key === 'Enter' || evt.key === 'Tab') {
        evt.preventDefault();
        finish(true);
      } else if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(false);
      }
    });
    inputEl.addEventListener('blur', () => {
      finish(true);
    });
    inputEl.focus();
    inputEl.select();
  }

  private render(): void {
    this.el.empty();
    this.el.addClass('npp-root-value');
    const treeEl = this.el.createDiv({ cls: 'npp-tree' });
    this.createSummary(treeEl, this.model, this.propertyEl, this.rootPath);
    if (!this.propertyEl) {
      // Outside the Properties panel (e.g. a Bases cell) a full tree doesn't fit, so show the summary only.
      treeEl.addClass('npp-inline');
      return;
    }
    const bodyEl = treeEl.createDiv({ cls: 'npp-body' });
    this.renderContainer(bodyEl, this.model, this.rootPath);
    this.afterRender();
  }

  private renderArray(containerEl: HTMLElement, arr: unknown[], path: string): void {
    const assigned = this.renderer.getAssignedWidget(path);
    const isObjectList = assigned?.type === OBJECT_LIST_WIDGET_TYPE;
    const isFlatObjectTable = this.plugin.settings.shouldShowTables && isTableArray(arr);
    if ((isFlatObjectTable || (isObjectList && arr.length === 0)) && arr.every(isPlainObject)) {
      containerEl.addClass('npp-object-list-layout');
      this.renderTable(containerEl, arr, path);
      return;
    }
    containerEl.removeClass('npp-object-list-layout');
    for (const index of arr.keys()) {
      this.renderEntry(containerEl, { key: index, parent: arr, path: `${path}.${String(index)}` });
    }
    this.addEntryButton(containerEl, isObjectList ? 'Add row' : 'Add item', () => {
      arr.push(isObjectList ? {} : '');
      this.renderer.pendingFocus = { path: `${path}.${String(arr.length - 1)}`, target: 'value' };
      this.commit(true);
    });
  }

  private renderCollapseButton(keyEl: HTMLElement, rowEl: HTMLElement): void {
    const collapseButtonEl = keyEl.createDiv({ cls: 'npp-collapse-btn' });
    setIcon(collapseButtonEl, 'right-triangle');
    collapseButtonEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      toggleCollapsed(this.renderer, rowEl);
    });
  }

  private renderContainer(containerEl: HTMLElement, value: Container, path: string): void {
    if (Array.isArray(value)) {
      this.renderArray(containerEl, value, path);
    } else {
      this.renderObject(containerEl, value, path);
    }
  }

  private renderEntry(containerEl: HTMLElement, ref: NodeRef): void {
    const value = getValue(ref);
    const widget = this.getWidget(ref.path, value);
    const isComplex = this.renderer.widgets.isComplexWidget(widget);
    const isArrayItem = Array.isArray(ref.parent);

    const rowEl = containerEl.createDiv({
      attr: { 'data-npp-path': ref.path },
      cls: ['metadata-property', 'npp-row']
    });
    if (isComplex) {
      rowEl.addClass('npp-collapsible');
      rowEl.toggleClass('npp-collapsed', !this.renderer.isExpanded(ref.path, this.ctx.sourcePath));
    }
    rowEl.addEventListener('contextmenu', (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this.showMenu(evt, ref);
    });

    const keyEl = rowEl.createDiv({ cls: 'metadata-property-key' });
    if (isComplex) {
      this.renderCollapseButton(keyEl, rowEl);
    }
    const iconEl = keyEl.createSpan({ cls: 'metadata-property-icon' });
    setIcon(iconEl, widget.icon);
    iconEl.setAttr('aria-label', widget.name());
    iconEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      this.showMenu(evt, ref);
    });

    const label = isArrayItem ? String(Number(ref.key) + 1) : String(ref.key);
    const keyInputEl = keyEl.createEl('input', {
      attr: { autocapitalize: 'none', spellcheck: 'false', type: 'text' },
      cls: ['metadata-property-key-input', ...(isArrayItem ? ['npp-index-key'] : [])],
      value: label
    });
    keyInputEl.size = Math.max(1, label.length);
    if (isArrayItem) {
      keyInputEl.readOnly = true;
      keyInputEl.tabIndex = -1;
    } else {
      this.setUpKeyRename(keyInputEl, ref);
    }

    const valueEl = rowEl.createDiv({ cls: 'metadata-property-value' });
    if (isComplex) {
      const treeEl = valueEl.createDiv({ cls: 'npp-tree' });
      this.createSummary(treeEl, value, rowEl, ref.path);
      const bodyEl = treeEl.createDiv({ cls: 'npp-body' });
      this.renderContainer(bodyEl, value as Container, ref.path);
      return;
    }

    valueEl.setAttr('data-property-type', widget.type);
    widget.render(valueEl, value, {
      ...this.ctx,
      key: label,
      onChange: (newValue: unknown) => {
        setValue(ref, newValue);
        this.commit(false);
      }
    });
  }

  private renderObject(containerEl: HTMLElement, obj: GenericObject, path: string): void {
    for (const key of Object.keys(obj)) {
      this.renderEntry(containerEl, { key, parent: obj, path: `${path}.${key}` });
    }
    const buttonEl = this.addEntryButton(containerEl, 'Add property', () => {
      this.promptInline(buttonEl, 'Property name', '', (key) => {
        // `Object.keys` rather than `Object.hasOwn`, whose type guard narrows `obj` to `never` below.
        if (Object.keys(obj).includes(key)) {
          new Notice(`Property "${key}" already exists.`);
          this.render();
          return;
        }
        obj[key] = '';
        this.renderer.pendingFocus = { path: `${path}.${key}`, target: 'value' };
        this.commit(true);
      }, () => {
        this.render();
      });
    });
  }

  private renderTable(containerEl: HTMLElement, rows: GenericObject[], path: string): void {
    const columns = getTableColumns(rows);
    const wrapEl = containerEl.createDiv({ cls: 'npp-table-wrap' });
    const tableEl = wrapEl.createEl('table', { cls: 'npp-table' });

    const headRowEl = tableEl.createTHead().insertRow();
    headRowEl.createEl('th', { cls: 'npp-table-index', text: '#' });
    for (const column of columns) {
      const widget = this.getColumnWidget(rows, path, column);
      const thEl = headRowEl.createEl('th', { cls: 'npp-table-column' });
      const labelEl = thEl.createDiv({ cls: 'npp-table-column-label' });
      setIcon(labelEl.createSpan({ cls: 'npp-table-column-icon' }), widget.icon);
      labelEl.createSpan({ text: column });
      const openMenu = (evt: MouseEvent): void => {
        evt.stopPropagation();
        evt.preventDefault();
        this.showColumnMenu(evt, thEl, rows, path, column);
      };
      thEl.addEventListener('click', openMenu);
      thEl.addEventListener('contextmenu', openMenu);
    }
    const addColumnEl = headRowEl.createEl('th', { attr: { 'aria-label': 'Add column' }, cls: 'npp-table-add-column' });
    setIcon(addColumnEl, 'plus');
    addColumnEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      addColumnEl.addClass('is-editing');
      this.promptInline(addColumnEl, 'Column name', '', (column) => {
        if (columns.includes(column)) {
          new Notice(`Column "${column}" already exists.`);
          this.render();
          return;
        }
        for (const row of rows) {
          row[column] = null;
        }
        this.renderer.pendingFocus = { path: `${path}.0.${column}`, target: 'value' };
        this.commit(true);
      }, () => {
        this.render();
      });
    });

    const bodyEl = tableEl.createTBody();
    for (const [index, row] of rows.entries()) {
      const rowRef: NodeRef = { key: index, parent: rows, path: `${path}.${String(index)}` };
      const trEl = bodyEl.insertRow();
      trEl.addClass('npp-table-row');
      const indexEl = trEl.createEl('td', { cls: 'npp-table-index', text: String(index + 1) });
      indexEl.setAttr('aria-label', 'Row actions');
      const openMenu = (evt: MouseEvent): void => {
        evt.stopPropagation();
        evt.preventDefault();
        this.showMenu(evt, rowRef);
      };
      indexEl.addEventListener('click', openMenu);
      trEl.addEventListener('contextmenu', openMenu);

      for (const column of columns) {
        const cellRef: NodeRef = { key: column, parent: row, path: `${rowRef.path}.${column}` };
        const tdEl = trEl.createEl('td', { cls: 'npp-table-cell' });
        const widget = this.getColumnWidget(rows, path, column);
        const valueEl = tdEl.createDiv({
          attr: { 'data-npp-path': cellRef.path, 'data-property-type': widget.type },
          cls: 'metadata-property-value'
        });
        widget.render(valueEl, row[column] ?? null, {
          ...this.ctx,
          key: column,
          onChange: (newValue: unknown) => {
            setValue(cellRef, newValue);
            this.commit(false);
          }
        });
      }
      trEl.createEl('td', { cls: 'npp-table-filler' });
    }

    this.addEntryButton(containerEl, 'Add row', () => {
      const row = Object.fromEntries(columns.map((column) => [column, null]));
      // An explicitly typed object list can be empty and therefore has no columns yet.
      // Give its first row one editable cell so Add row always produces a visible result.
      if (columns.length === 0) {
        row['value'] = null;
      }
      rows.push(row);
      const firstColumn = columns[0] ?? (columns.length === 0 ? 'value' : undefined);
      if (firstColumn !== undefined) {
        this.renderer.pendingFocus = { path: `${path}.${String(rows.length - 1)}.${firstColumn}`, target: 'value' };
      }
      this.commit(true);
    });
  }

  private setUpKeyRename(keyInputEl: HTMLInputElement, ref: NodeRef): void {
    const originalKey = String(ref.key);
    keyInputEl.addEventListener('keydown', (evt) => {
      evt.stopPropagation();
      if (evt.key === 'Enter') {
        evt.preventDefault();
        keyInputEl.blur();
      } else if (evt.key === 'Escape') {
        evt.preventDefault();
        keyInputEl.value = originalKey;
        keyInputEl.blur();
      }
    });
    keyInputEl.addEventListener('input', () => {
      keyInputEl.size = Math.max(1, keyInputEl.value.length);
    });
    keyInputEl.addEventListener('blur', () => {
      const newKey = keyInputEl.value.trim();
      if (!newKey || newKey === originalKey) {
        keyInputEl.value = originalKey;
        return;
      }
      const parent = ref.parent as GenericObject;
      if (Object.hasOwn(parent, newKey)) {
        new Notice(`Property "${newKey}" already exists.`);
        keyInputEl.value = originalKey;
        return;
      }
      replaceObjectContents(parent, renameKey(parent, originalKey, newKey));
      const parentPath = ref.path.slice(0, ref.path.length - originalKey.length - 1);
      const expansion = this.renderer.expansionOverrides.get(ref.path);
      if (expansion !== undefined) {
        this.renderer.expansionOverrides.set(`${parentPath}.${newKey}`, expansion);
      }
      this.commit(true);
    });
  }

  private setUpRootProperty(): void {
    const propertyEl = this.propertyEl;
    if (!propertyEl) {
      return;
    }
    // Obsidian may reuse the same element for another note's property, so state is read from the element at click time.
    propertyEl.dataset['nppPath'] = this.rootPath;
    propertyEl.addClass('npp-root', 'npp-collapsible');
    propertyEl.toggleClass('npp-collapsed', !this.renderer.isExpanded(this.rootPath, this.ctx.sourcePath));

    const keyEl = propertyEl.querySelector(':scope > .metadata-property-key');
    if (keyEl instanceof HTMLElement && !keyEl.querySelector(':scope > .npp-collapse-btn')) {
      const collapseButtonEl = createDiv({ cls: 'npp-collapse-btn' });
      setIcon(collapseButtonEl, 'right-triangle');
      keyEl.prepend(collapseButtonEl);
      collapseButtonEl.addEventListener('click', (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        toggleCollapsed(this.renderer, propertyEl);
      });
    }
  }

  private showColumnMenu(evt: MouseEvent, thEl: HTMLElement, rows: GenericObject[], path: string, column: string): void {
    if (Date.now() - this.renderer.lastMenuCloseTime < MENU_DELAY_IN_MILLISECONDS) {
      return;
    }
    const columns = getTableColumns(rows);
    const columnIndex = columns.indexOf(column);
    const cellRefs: NodeRef[] = rows.map((row, index) => ({ key: column, parent: row, path: `${path}.${String(index)}.${column}` }));
    const menu = this.createMenu();
    const fieldKey = getFieldTypeKey(`${path}.0.${column}`);
    if (fieldKey) {
      this.addTypeSubmenu(menu, 'Column type', fieldKey, cellRefs);
    }
    menu.addItem((item) =>
      item.setTitle('Rename column').setIcon('lucide-pencil').setSection('action').onClick(() => {
        this.promptInline(thEl, 'Column name', column, (newColumn) => {
          if (newColumn === column) {
            this.render();
            return;
          }
          if (columns.includes(newColumn)) {
            new Notice(`Column "${newColumn}" already exists.`);
            this.render();
            return;
          }
          for (const row of rows) {
            if (Object.hasOwn(row, column)) {
              replaceObjectContents(row, renameKey(row, column, newColumn));
            }
          }
          this.commit(true);
        }, () => {
          this.render();
        });
      })
    );
    for (const [title, icon, offset] of [['Move left', 'lucide-arrow-left', -1], ['Move right', 'lucide-arrow-right', 1]] as const) {
      menu.addItem((item) =>
        item.setTitle(title).setIcon(icon).setSection('action').setDisabled(columns[columnIndex + offset] === undefined).onClick(() => {
          const target = columns[columnIndex + offset];
          if (target === undefined) {
            return;
          }
          const order = [...columns];
          order[columnIndex] = target;
          order[columnIndex + offset] = column;
          for (const row of rows) {
            const reordered: GenericObject = {};
            for (const key of order) {
              if (Object.hasOwn(row, key)) {
                reordered[key] = row[key];
              }
            }
            replaceObjectContents(row, reordered);
          }
          this.commit(true);
        })
      );
    }
    menu.addItem((item) => {
      item.dom.addClass('is-warning');
      item.setTitle('Delete column').setIcon('lucide-trash-2').setSection('danger').onClick(() => {
        for (const row of rows) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Need to delete the key.
          delete row[column];
        }
        this.commit(true);
      });
    });
    menu.showAtMouseEvent(evt);
  }

  private showMenu(evt: MouseEvent, ref: NodeRef): void {
    if (Date.now() - this.renderer.lastMenuCloseTime < MENU_DELAY_IN_MILLISECONDS) {
      return;
    }
    const value = getValue(ref);
    const label = String(ref.key);
    const menu = this.createMenu();

    const itemKey = getItemTypeKey(ref.path);
    const fieldKey = getFieldTypeKey(ref.path);
    if (fieldKey !== null && fieldKey !== itemKey) {
      this.addTypeSubmenu(menu, 'Property type (all items)', fieldKey, [ref]);
      this.addTypeSubmenu(menu, 'Property type (this item only)', itemKey, [ref]);
    } else {
      this.addTypeSubmenu(menu, 'Property type', itemKey, [ref]);
    }

    const parent = ref.parent;
    if (Array.isArray(parent)) {
      const index = Number(ref.key);
      const parentPath = ref.path.slice(0, ref.path.lastIndexOf('.'));
      menu.addItem((item) =>
        item.setTitle('Insert above').setIcon('lucide-arrow-up-to-line').setSection('action').onClick(() => {
          parent.splice(index, 0, emptyLike(value));
          this.renderer.pendingFocus = { path: `${parentPath}.${String(index)}`, target: 'value' };
          this.commit(true);
        })
      );
      menu.addItem((item) =>
        item.setTitle('Insert below').setIcon('lucide-arrow-down-to-line').setSection('action').onClick(() => {
          parent.splice(index + 1, 0, emptyLike(value));
          this.renderer.pendingFocus = { path: `${parentPath}.${String(index + 1)}`, target: 'value' };
          this.commit(true);
        })
      );
      menu.addItem((item) =>
        item.setTitle('Duplicate').setIcon('lucide-copy-plus').setSection('action').onClick(() => {
          parent.splice(index + 1, 0, cloneValue(value));
          this.commit(true);
        })
      );
      for (const [title, icon, offset] of [['Move up', 'lucide-arrow-up', -1], ['Move down', 'lucide-arrow-down', 1]] as const) {
        menu.addItem((item) =>
          item.setTitle(title).setIcon(icon).setSection('action').setDisabled(index + offset < 0 || index + offset >= parent.length).onClick(() => {
            moveItem(parent, index, offset);
            this.commit(true);
          })
        );
      }
    } else {
      const keys = Object.keys(parent);
      const keyIndex = keys.indexOf(label);
      menu.addItem((item) =>
        item.setTitle('Rename').setIcon('lucide-pencil').setSection('action').onClick(() => {
          this.renderer.pendingFocus = { path: ref.path, target: 'key' };
          // Wait for the menu to close, or it takes the focus back.
          window.setTimeout(() => {
            this.applyPendingFocus();
          }, 0);
        })
      );
      menu.addItem((item) =>
        item.setTitle('Duplicate').setIcon('lucide-copy-plus').setSection('action').onClick(() => {
          let copyKey = `${label} copy`;
          let copyNumber = 1;
          while (Object.hasOwn(parent, copyKey)) {
            copyNumber++;
            copyKey = `${label} copy ${String(copyNumber)}`;
          }
          const entries = Object.entries(parent);
          entries.splice(keyIndex + 1, 0, [copyKey, cloneValue(value)]);
          replaceObjectContents(parent, Object.fromEntries(entries));
          this.renderer.pendingFocus = { path: `${ref.path.slice(0, ref.path.length - label.length)}${copyKey}`, target: 'key' };
          this.commit(true);
        })
      );
      for (const [title, icon, offset] of [['Move up', 'lucide-arrow-up', -1], ['Move down', 'lucide-arrow-down', 1]] as const) {
        menu.addItem((item) =>
          item.setTitle(title).setIcon(icon).setSection('action').setDisabled(keyIndex + offset < 0 || keyIndex + offset >= keys.length).onClick(() => {
            replaceObjectContents(parent, moveKey(parent, label, offset));
            this.commit(true);
          })
        );
      }
    }

    menu.addItem((item) =>
      item.setTitle('Cut').setIcon('lucide-scissors').setSection('clipboard').onClick(() => {
        invokeAsyncSafely(async () => {
          await navigator.clipboard.writeText(JSON.stringify({ [label]: value }));
          removeValue(ref);
          this.commit(true);
        });
      })
    );
    menu.addItem((item) =>
      item.setTitle('Copy').setIcon('lucide-copy').setSection('clipboard').onClick(() => {
        invokeAsyncSafely(() => navigator.clipboard.writeText(JSON.stringify({ [label]: value })));
      })
    );
    menu.addItem((item) =>
      item.setTitle('Paste').setIcon('lucide-clipboard-paste').setSection('clipboard').onClick(() => {
        invokeAsyncSafely(async () => {
          const text = await navigator.clipboard.readText();
          setValue(ref, parseClipboardValue(text));
          this.commit(true);
        });
      })
    );
    menu.addItem((item) => {
      item.dom.addClass('is-warning');
      item.setTitle('Remove').setIcon('lucide-trash-2').setSection('danger').onClick(() => {
        removeValue(ref);
        this.commit(true);
      });
    });
    menu.showAtMouseEvent(evt);
  }
}

export class NestedPropertyRenderer {
  public readonly expansionOverrides = new Map<string, boolean>();
  public lastMenuCloseTime = 0;
  public pendingFocus: null | PendingFocus = null;
  public readonly widgets: ComplexWidgets;

  public constructor(public readonly plugin: Plugin) {
    this.widgets = new ComplexWidgets(plugin, (el, value, ctx, widgetType) => this.renderRoot(el, value, ctx, widgetType));
  }

  public applyBodyClasses(): void {
    const settings = this.plugin.settings;
    document.body.style.setProperty(INDENT_CSS_VAR, `${String(settings.indentationLevel)}px`);
    document.body.toggleClass(FULL_KEY_DISPLAY_CLASS, settings.isFullKeyDisplayEnabled);
    document.body.toggleClass(NO_INDENT_GUIDES_CLASS, !settings.shouldShowIndentGuides);
  }

  /**
   * Persisted widget for a node: per-index override (`versions.0.released`) first, then the shared per-field
   * type (`versions.released`).
   */
  public getAssignedWidget(path: string): PropertyWidget | undefined {
    const metadataTypeManager = this.plugin.app.metadataTypeManager;
    const fieldKey = getFieldTypeKey(path);
    const assignedType = metadataTypeManager.getAssignedWidget(getItemTypeKey(path))
      ?? (fieldKey ? metadataTypeManager.getAssignedWidget(fieldKey) : null);
    return assignedType ? metadataTypeManager.registeredTypeWidgets[assignedType] : undefined;
  }

  public isExpanded(path: string, sourcePath: string): boolean {
    const override = this.expansionOverrides.get(path);
    if (override !== undefined) {
      return override;
    }
    return getPathDepth(path) < this.getInitialExpandLevel(sourcePath);
  }

  public register(): void {
    this.widgets.register();
    this.applyBodyClasses();
    this.plugin.register(() => {
      for (const el of document.querySelectorAll('.npp-header-actions')) {
        el.remove();
      }
      document.body.style.removeProperty(INDENT_CSS_VAR);
      document.body.removeClass(FULL_KEY_DISPLAY_CLASS, NO_INDENT_GUIDES_CLASS);
      this.reloadAllProperties();
    });
    this.reloadAllProperties();
  }

  public reloadAllProperties(): void {
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const metadataEditor = (leaf.view as { metadataEditor?: MetadataEditorLike }).metadataEditor;
      if (typeof metadataEditor?.serialize !== 'function' || typeof metadataEditor.synchronize !== 'function') {
        return;
      }
      const data = metadataEditor.serialize();
      metadataEditor.synchronize({});
      metadataEditor.synchronize(data);
    });
  }

  private getInitialExpandLevel(sourcePath: string): number {
    const frontmatter = this.plugin.app.metadataCache.getCache(sourcePath)?.frontmatter as
      | { nestedProperties?: { initialExpandLevel?: unknown } }
      | undefined;
    const noteLevel = frontmatter?.nestedProperties?.initialExpandLevel;
    if (typeof noteLevel === 'number' && Number.isSafeInteger(noteLevel) && noteLevel >= 0) {
      return noteLevel;
    }
    return this.plugin.settings.initialExpandLevel;
  }

  private renderRoot(el: HTMLElement, value: unknown, ctx: PropertyRenderContext, widgetType: string): PropertyWidgetComponentBase {
    let model: Container;
    if (widgetType === LIST_WIDGET_TYPE || widgetType === OBJECT_LIST_WIDGET_TYPE) {
      model = Array.isArray(value) ? cloneValue(value) : [];
    } else {
      model = isPlainObject(value) ? cloneValue(value) : {};
    }
    const tree = new NestedTree(this, el, model, ctx);
    tree.mount();
    return {
      focus: (): void => {
        tree.focus();
      },
      type: widgetType
    };
  }
}

function emptyLike(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [];
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).map((key) => [key, null]));
  }
  return '';
}

function getValue(ref: NodeRef): unknown {
  return Array.isArray(ref.parent) ? ref.parent[Number(ref.key)] : ref.parent[String(ref.key)];
}

function injectHeaderActions(renderer: NestedPropertyRenderer, metadataContainerEl: HTMLElement): void {
  if (metadataContainerEl.querySelector(':scope > .npp-header-actions')) {
    return;
  }
  const headingEl = metadataContainerEl.querySelector(':scope > .metadata-properties-heading');
  if (!headingEl) {
    return;
  }

  const actionsEl = createDiv({ cls: 'npp-header-actions' });
  headingEl.after(actionsEl);

  const toggleButtonEl = actionsEl.createDiv({ cls: 'clickable-icon' });
  function getCollapsibles(): HTMLElement[] {
    return Array.from(metadataContainerEl.querySelectorAll<HTMLElement>('.npp-collapsible'));
  }
  function updateToggleButton(): void {
    const isAllCollapsed = getCollapsibles().every((el) => el.hasClass('npp-collapsed'));
    toggleButtonEl.setAttr('aria-label', isAllCollapsed ? 'Expand all nested properties' : 'Collapse all nested properties');
    toggleButtonEl.empty();
    setIcon(toggleButtonEl, isAllCollapsed ? 'chevrons-up-down' : 'chevrons-down-up');
  }
  updateToggleButton();
  toggleButtonEl.addEventListener('click', (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    const collapsibles = getCollapsibles();
    const shouldExpand = collapsibles.every((el) => el.hasClass('npp-collapsed'));
    for (const el of collapsibles) {
      el.toggleClass('npp-collapsed', !shouldExpand);
      const path = el.dataset['nppPath'];
      if (path) {
        renderer.expansionOverrides.set(path, shouldExpand);
      }
    }
    updateToggleButton();
  });

  const fullKeyButtonEl = actionsEl.createDiv({ attr: { 'aria-label': 'Toggle full key display' }, cls: 'clickable-icon' });
  setIcon(fullKeyButtonEl, 'lucide-wrap-text');
  fullKeyButtonEl.addEventListener('click', (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    invokeAsyncSafely(() =>
      renderer.plugin.settingsManager.editAndSave((settings) => {
        settings.isFullKeyDisplayEnabled = !settings.isFullKeyDisplayEnabled;
      })
    );
  });
}

function parseClipboardValue(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isPlainObject(parsed)) {
      const values = Object.values(parsed);
      if (values.length === 1) {
        return values[0];
      }
    }
    return parsed;
  } catch {
    return text;
  }
}

function removeValue(ref: NodeRef): void {
  if (Array.isArray(ref.parent)) {
    ref.parent.splice(Number(ref.key), 1);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Need to delete the key.
    delete ref.parent[String(ref.key)];
  }
}

function setValue(ref: NodeRef, value: unknown): void {
  if (Array.isArray(ref.parent)) {
    ref.parent[Number(ref.key)] = value;
  } else {
    ref.parent[String(ref.key)] = value;
  }
}

function toggleCollapsed(renderer: NestedPropertyRenderer, rowEl: HTMLElement): void {
  const isCollapsed = rowEl.hasClass('npp-collapsed');
  rowEl.toggleClass('npp-collapsed', !isCollapsed);
  const path = rowEl.dataset['nppPath'];
  if (path) {
    renderer.expansionOverrides.set(path, isCollapsed);
  }
}
