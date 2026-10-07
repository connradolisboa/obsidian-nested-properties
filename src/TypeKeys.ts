// Nested paths look like `folder/note.md:root.child.0.leaf`: the note path, a `:`, then the dotted key path
// Inside the frontmatter.

/**
 * Collapsed per-field key: array indices are removed so a field's type applies to every item
 * (`versions.0.released` and `versions.1.released` share `versions.released`). Returns null when the last
 * segment is itself an index, since collapsing it would collide with the parent array's own key.
 */
export function getFieldTypeKey(path: string): null | string {
  const itemKey = getItemTypeKey(path);
  const lastSegment = itemKey.slice(itemKey.lastIndexOf('.') + 1);
  return isIndexSegment(lastSegment) ? null : itemKey.split('.').filter((segment) => !isIndexSegment(segment)).join('.');
}

/**
 * Type key for an exact node, vault-global like Obsidian's flat `types.json`.
 */
export function getItemTypeKey(path: string): string {
  return path.slice(path.indexOf(':') + 1);
}

/**
 * Depth of a node below the top-level property: the property itself is 0, its own entries are 1, and so on.
 */
export function getPathDepth(path: string): number {
  return getItemTypeKey(path).split('.').length - 1;
}

export function getRootPath(sourcePath: string, key: string): string {
  return `${sourcePath}:${key}`;
}

function isIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}
