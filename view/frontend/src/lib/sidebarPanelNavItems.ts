import {
  BookOpen,
  BookUser,
  Download,
  FileStack,
  GitCompare,
  Layers,
  Network,
  Trash2,
} from "lucide-react";

import type { SidebarPanel } from "@/lib/workspacePreferences";

export const SIDEBAR_PANEL_NAV_ITEMS: {
  id: SidebarPanel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "paperInfo", label: "Paper", icon: BookUser },
  { id: "papers", label: "Sections", icon: FileStack },
  { id: "assets", label: "Assets", icon: Layers },
  { id: "references", label: "References (BibTeX library)", icon: BookOpen },
  { id: "graph", label: "Graph", icon: Network },
  { id: "review", label: "Review changes", icon: GitCompare },
  { id: "export", label: "Export & Overleaf", icon: Download },
  { id: "removed", label: "Removed", icon: Trash2 },
];
