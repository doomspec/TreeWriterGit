import { cn } from "@/lib/utils";

export type WorkspaceModeTab = "explorer" | "papers";

const TABS: { id: WorkspaceModeTab; label: string }[] = [
  { id: "explorer", label: "Explorer" },
  { id: "papers", label: "Papers" },
];

export function WorkspaceModeTabs({
  activeTab,
  onTabChange,
  className,
}: {
  activeTab: WorkspaceModeTab;
  onTabChange: (tab: WorkspaceModeTab) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5", className)}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "ui-tab px-3 py-1",
            activeTab === tab.id ? "ui-tab-active" : "ui-tab-inactive",
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
