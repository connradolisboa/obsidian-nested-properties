import type {
  MetadataTypeManager,
  PropertyRenderContext,
  PropertyWidget,
  PropertyWidgetComponentBase
} from 'obsidian-typings';

import { setIcon } from 'obsidian';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';

import type { Plugin } from './Plugin.ts';

import {
  isComplexValue,
  isPlainObject,
  isSimpleArray
} from './ValueUtils.ts';

export const LIST_WIDGET_TYPE = 'list';
export const OBJECT_WIDGET_TYPE = 'object';

// A key no note uses, so `getTypeInfo` skips assigned types and infers purely from the value.
const INFERENCE_KEY = '\u0000nested-properties-plus';

type ComplexRenderFn = (el: HTMLElement, value: unknown, ctx: PropertyRenderContext, widgetType: string) => PropertyWidgetComponentBase;

export class ComplexWidgets {
  public readonly listWidget: PropertyWidget;
  public readonly mixedListWidget: PropertyWidget;
  public readonly objectWidget: PropertyWidget;
  private readonly metadataTypeManager: MetadataTypeManager;

  public constructor(private readonly plugin: Plugin, render: ComplexRenderFn) {
    this.metadataTypeManager = plugin.app.metadataTypeManager;
    this.listWidget = this.metadataTypeManager.registeredTypeWidgets.multitext;

    this.mixedListWidget = {
      icon: 'lucide-list-tree',
      name: (): string => 'Mixed list',
      render: (el, value, ctx): PropertyWidgetComponentBase => render(el, value, ctx, LIST_WIDGET_TYPE),
      type: LIST_WIDGET_TYPE,
      validate: (value): boolean => Array.isArray(value)
    };

    this.objectWidget = {
      icon: 'lucide-braces',
      name: (): string => 'Object',
      render: (el, value, ctx): PropertyWidgetComponentBase => render(el, value, ctx, OBJECT_WIDGET_TYPE),
      type: OBJECT_WIDGET_TYPE,
      validate: (value): boolean => isPlainObject(value)
    };
  }

  /**
   * The widget a value would get with no assigned type, including the complex types this plugin adds.
   */
  public inferWidget(value: unknown): PropertyWidget {
    return this.metadataTypeManager.getTypeInfo(INFERENCE_KEY, value).inferred;
  }

  public isComplexWidget(widget: PropertyWidget | undefined): boolean {
    return widget?.type === LIST_WIDGET_TYPE || widget?.type === OBJECT_WIDGET_TYPE;
  }

  public register(): void {
    const registeredTypeWidgets = this.metadataTypeManager.registeredTypeWidgets;
    registeredTypeWidgets[LIST_WIDGET_TYPE] = this.mixedListWidget;
    registeredTypeWidgets[OBJECT_WIDGET_TYPE] = this.objectWidget;
    this.plugin.register(() => {
      if (registeredTypeWidgets[LIST_WIDGET_TYPE] === this.mixedListWidget) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Unregister widget on unload.
        delete registeredTypeWidgets[LIST_WIDGET_TYPE];
      }
      if (registeredTypeWidgets[OBJECT_WIDGET_TYPE] === this.objectWidget) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Unregister widget on unload.
        delete registeredTypeWidgets[OBJECT_WIDGET_TYPE];
      }
    });

    const listWidget = this.listWidget;
    registerPatch(this.plugin, listWidget, {
      // Lists of numbers/booleans are still plain lists.
      validate: (next: (value: unknown) => boolean) => (value: unknown): boolean => next.call(listWidget, value) || isSimpleArray(value)
    });

    const metadataTypeManager = this.metadataTypeManager;
    registerPatch(this.plugin, metadataTypeManager, {
      getTypeInfo: (next: MetadataTypeManager['getTypeInfo']) => (key: string, value: unknown): ReturnType<MetadataTypeManager['getTypeInfo']> => {
        const result = next.call(metadataTypeManager, key, value);
        if (result.inferred.type !== 'unknown' || !isComplexValue(value)) {
          return result;
        }
        const inferred = this.getComplexWidget(value);
        if (result.expected === result.inferred) {
          result.expected = inferred;
        }
        result.inferred = inferred;
        return result;
      }
    });

    const unknownWidget = metadataTypeManager.getWidget('unknown');
    registerPatch(this.plugin, unknownWidget, {
      render: (next: PropertyWidget['render']) => (el: HTMLElement, value: unknown, ctx: PropertyRenderContext): PropertyWidgetComponentBase => {
        if (!isComplexValue(value)) {
          return next.call(unknownWidget, el, value, ctx);
        }
        const widget = this.getComplexWidget(value);
        const iconEl = el.closest('.metadata-property')?.querySelector(':scope > .metadata-property-key > .metadata-property-icon');
        if (iconEl instanceof HTMLElement) {
          setIcon(iconEl, widget.icon);
        }
        return widget.render(el, value, ctx);
      }
    });
  }

  private getComplexWidget(value: object | unknown[]): PropertyWidget {
    if (isSimpleArray(value)) {
      return this.listWidget;
    }
    return Array.isArray(value) ? this.mixedListWidget : this.objectWidget;
  }
}
