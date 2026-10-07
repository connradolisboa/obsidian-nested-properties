export interface PluginSettings {
  /**
   * Pixel offset of nested rows from their parent.
   */
  indentationLevel: number;
  /**
   * How many levels arrive expanded when a note opens. `0` collapses everything, `1` expands the top-level
   * property but not its children, and so on. A note can override it with `nestedProperties.initialExpandLevel`.
   */
  initialExpandLevel: number;
  isFullKeyDisplayEnabled: boolean;
  shouldShowIndentGuides: boolean;
  shouldShowTables: boolean;
}

export const DEFAULT_INDENTATION_LEVEL = 16;
export const DEFAULT_INITIAL_EXPAND_LEVEL = 1;
