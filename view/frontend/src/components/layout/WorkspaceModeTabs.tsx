import { cn } from "@/lib/utils";

export type WorkspaceModeTab = "explorer" | "papers";

const TABS: { id: WorkspaceModeTab; label: string; shortLabel: string }[] = [
  { id: "explorer", label: "Explorer", shortLabel: "Exp" },
  { id: "papers", label: "Manuscripts", shortLabel: "Docs" },
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
    <div className={cn("flex min-w-0 shrink items-center gap-0.5 rounded-md border border-border p-0.5", className)}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "ui-tab min-w-0 px-2 py-1 sm:px-3",
            activeTab === tab.id ? "ui-tab-active" : "ui-tab-inactive",
          )}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="truncate sm:hidden">{tab.shortLabel}</span>
          <span className="hidden truncate sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
