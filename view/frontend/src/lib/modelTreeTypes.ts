export type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  /** From INDEX.md frontmatter when present. */
  kind?: string;
  children?: ModelNode[];
};

export type OutlineItem = {
  id: string;
  name: string;
  path: string;
  kind: "index" | "directory" | "file";
  subtitle: string;
};
