import { ListTree } from "lucide-react";

import { DocumentOutlinePanel } from "@/components/nav/DocumentOutlinePanel";

export function ReadingFocusOutlineRail() {
  return (
    <aside className="reading-focus-outline-gutter" aria-label="Document outline">
      <div className="reading-focus-outline-trigger" aria-hidden="true">
        <ListTree className="reading-focus-outline-trigger__icon h-3.5 w-3.5" />
      </div>
      <div className="reading-focus-outline-panel">
        <DocumentOutlinePanel className="h-full" />
      </div>
    </aside>
  );
}
