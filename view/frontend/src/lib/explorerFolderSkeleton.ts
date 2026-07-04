function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Minimal INDEX.md for a generic explorer folder. */
export function explorerFolderIndexContent(name: string): string {
  const title = titleCase(name);
  return `---\nkind: section\ntitle: ${title}\nchild_order: []\nlinks: []\ncomposed_at_commit: null\n---\n\n`;
}

/** Minimal outline.md for a generic explorer folder. */
export function explorerFolderOutlineContent(name: string): string {
  const title = titleCase(name);
  return `# ${title}\n\n## Summary\n\n_Overview of this folder._\n\n## Outline\n\n`;
}
