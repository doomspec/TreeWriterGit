export type AppCommand = {
  id: string;
  label: string;
  category?: string;
  aliases?: string[];
  /** When false, command is hidden and cannot run. */
  when?: () => boolean;
  run: () => void | Promise<void>;
};

export function scoreCommand(query: string, command: AppCommand): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystacks = [
    command.label,
    command.category ?? "",
    ...(command.aliases ?? []),
    command.id.replace(/\./g, " "),
  ].map((value) => value.toLowerCase());

  let best = 0;
  for (const hay of haystacks) {
    if (hay === q) best = Math.max(best, 100);
    else if (hay.startsWith(q)) best = Math.max(best, 80);
    else if (hay.includes(q)) best = Math.max(best, 50);
    else {
      const words = q.split(/\s+/).filter(Boolean);
      if (words.every((word) => hay.includes(word))) best = Math.max(best, 30);
    }
  }
  return best;
}
