import { resolveChildPath } from "./paths.js";
import { orderedChildren, readIndexData } from "./ordering.js";
import {
  classifyManuscriptNode,
  type ManuscriptLeafKind,
  type ManuscriptNodeKind,
} from "./kinds.js";

export type ManuscriptWalkContext = {
  modelRoot: string;
  relPath: string;
  name: string;
  depth: number;
  kind: ManuscriptNodeKind;
  indexData: Record<string, unknown>;
};

export type ManuscriptWalkOptions = {
  /** Skip notes/ subtree (default true). */
  skipNotes?: boolean;
};

export type ManuscriptWalkVisitor = {
  enter?: (ctx: ManuscriptWalkContext) => Promise<void | "skip">;
  leave?: (ctx: ManuscriptWalkContext) => Promise<void>;
};

function shouldSkipNotesPath(relPath: string): boolean {
  return relPath.includes("/notes/") || relPath.endsWith("/notes");
}

/** Depth-first walk: section_order → child_order → leaves. */
export async function walkManuscript(
  modelRoot: string,
  rootRel: string,
  visitor: ManuscriptWalkVisitor,
  options: ManuscriptWalkOptions = {},
): Promise<void> {
  const skipNotes = options.skipNotes ?? true;

  async function visit(dirRel: string, depth: number): Promise<void> {
    if (skipNotes && shouldSkipNotesPath(dirRel)) return;

    const name = dirRel.includes("/") ? dirRel.slice(dirRel.lastIndexOf("/") + 1) : dirRel;
    const kind = await classifyManuscriptNode(modelRoot, dirRel);
    const indexData = await readIndexData(modelRoot, dirRel);

    const ctx: ManuscriptWalkContext = { modelRoot, relPath: dirRel, name, depth, kind, indexData };
    const enterResult = await visitor.enter?.(ctx);
    if (enterResult === "skip") return;

    if (kind === "container") {
      for (const childName of await orderedChildren(modelRoot, dirRel)) {
        const childRel = resolveChildPath(modelRoot, dirRel, childName);
        if (!childRel) continue;
        await visit(childRel, depth + 1);
      }
    }

    await visitor.leave?.(ctx);
  }

  await visit(rootRel, 0);
}

/** Visit only leaf nodes (units, figures, tables, equations) in editorial order. */
export async function walkManuscriptLeaves(
  modelRoot: string,
  rootRel: string,
  visitor: (ctx: ManuscriptWalkContext & { kind: ManuscriptLeafKind }) => Promise<void>,
  options: ManuscriptWalkOptions = {},
): Promise<void> {
  await walkManuscript(
    modelRoot,
    rootRel,
    {
      enter: async (ctx) => {
        if (ctx.kind === "container") return;
        await visitor(ctx as ManuscriptWalkContext & { kind: ManuscriptLeafKind });
        return "skip";
      },
    },
    options,
  );
}
