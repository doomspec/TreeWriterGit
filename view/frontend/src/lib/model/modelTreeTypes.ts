export type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  /** From INDEX.md frontmatter when present. */
  kind?: string;
  /** INDEX.md child_order for directories (empty when unset). */
  childOrder?: string[];
  children?: ModelNode[];
  /** Present when children were not loaded (depth-limited subtree). */
  hasChildren?: boolean;
};

export type OutlineItem = {
  id: string;
  name: string;
  path: string;
  kind: "index" | "directory" | "file";
  subtitle: string;
};
