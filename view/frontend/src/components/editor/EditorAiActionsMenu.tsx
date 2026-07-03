import { Bot, ChevronDown } from "lucide-react";

import { PopoverMenu, PopoverMenuItem, PopoverMenuSection } from "@/components/ui/PopoverMenu";
import { dispatchHotActionLabel, type AgentDispatchAction } from "@/lib/agentDispatchClient";
import { useAgentDispatchPanelOptional } from "@/lib/agentDispatchPanel";

type MenuAction = {
  action: AgentDispatchAction;
  label?: string;
  /** Skip auto-building a preview (e.g. "Apply skill" needs a custom prompt first). */
  skipAutoPreview?: boolean;
};

/**
 * Per-pane AI actions dropdown for the unit editor (Draft/Outline/Notes),
 * mirroring the single-action `DispatchAiButton` used by SectionWorkspace
 * but offering several actions. Reuses the existing dispatch-intent flow
 * (`openDispatch`) — clicking an item opens the AI dispatch section with
 * that action selected and (usually) already previewed, same as any other
 * dispatch entry point.
 */
export function EditorAiActionsMenu({
  pane,
  actions,
  disabled = false,
}: {
  pane: "draft" | "outline" | "notes";
  actions: MenuAction[];
  disabled?: boolean;
}) {
  const agentDispatchPanel = useAgentDispatchPanelOptional();
  if (!agentDispatchPanel || actions.length === 0) return null;

  return (
    <PopoverMenu
      align="end"
      disabled={disabled}
      title="AI actions for this pane"
      aria-label="AI actions"
      triggerClassName="h-6 gap-1 px-2 text-[10px]"
      trigger={
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3" aria-hidden="true" />
          AI
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </span>
      }
    >
      <PopoverMenuSection>
        {actions.map(({ action, label, skipAutoPreview }) => (
          <PopoverMenuItem
            key={action}
            onClick={() =>
              agentDispatchPanel.openDispatch({
                action,
                pane,
                autoPreview: !skipAutoPreview,
              })
            }
          >
            {label ?? dispatchHotActionLabel(action)}
          </PopoverMenuItem>
        ))}
      </PopoverMenuSection>
    </PopoverMenu>
  );
}
