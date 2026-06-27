export function UnapprovedIndicator({
  pending,
  unapproved,
}: {
  pending?: boolean;
  unapproved?: boolean;
}) {
  if (!pending && !unapproved) return null;

  const title = pending
    ? "Draft changes pending approval in this section"
    : "Contains units with unapproved text";

  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40"
      title={title}
      aria-label={title}
    />
  );
}
