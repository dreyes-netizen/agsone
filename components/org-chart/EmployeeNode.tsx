"use client";

import Link from "next/link";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ChevronDown, Plus, MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/feed/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

const HIGHLIGHT_CLASS: Record<string, string> = {
  gold: "border-amber-400 bg-amber-50",
  teal: "border-teal-400 bg-teal-50",
};

export type EmployeeNodeAdminActions = {
  onAddReport: (id: string) => void;
  onEditEntry: (id: string) => void;
  onChangeManager: (id: string) => void;
  onReorderSiblings: (id: string) => void;
  onReplace: (id: string) => void;
  onRemove: (id: string) => void;
};

export type EmployeeNodeData = {
  user: OrgChartUser;
  descendantCount: number;
  hasChildren: boolean;
  collapsed: boolean;
  hasParent: boolean;
  onToggleCollapse: (id: string) => void;
  /** False in the admin edit chart: the card becomes a static label instead of a profile link, so clicking it doesn't navigate away mid-edit. */
  linkToProfile: boolean;
  /** Only set (and only rendered) while the admin chart is in Edit Organization mode — keeps the read-only chart free of admin chrome. */
  adminActions?: EmployeeNodeAdminActions;
};

export type EmployeeFlowNode = Node<EmployeeNodeData, "employee">;

export function EmployeeNode({ id, data }: NodeProps<EmployeeFlowNode>) {
  const { user, descendantCount, hasChildren, collapsed, hasParent, linkToProfile, adminActions } = data;
  const highlightClass = (user.orgChartHighlight && HIGHLIGHT_CLASS[user.orgChartHighlight]) || "border-gray-200 bg-white";
  const reportsLabel = `${descendantCount} report${descendantCount === 1 ? "" : "s"}`;

  const cardClassName = `flex flex-col items-center gap-1 px-3 py-2.5 w-full h-full rounded-xl border-2 ${highlightClass} shadow-sm hover:shadow-md transition-shadow`;
  const cardContent = (
    <>
      <Avatar name={user.displayName} url={user.avatarUrl} size="md" />
      <p className="text-sm font-semibold text-gray-900 text-center leading-tight line-clamp-1 w-full" title={user.displayName}>
        {user.displayName}
      </p>
      {user.position && (
        <p className="text-xs text-gray-500 text-center leading-tight line-clamp-1 w-full" title={user.position}>
          {user.position}
        </p>
      )}
      {user.departmentName && (
        <p className="hidden sm:block text-[11px] text-gray-400 text-center leading-tight line-clamp-1 w-full" title={user.departmentName}>
          {user.departmentName}
        </p>
      )}
    </>
  );

  return (
    <div
      role="group"
      aria-label={`${user.displayName}, ${user.position ?? "No title"}, ${reportsLabel}`}
      // React Flow sets `pointer-events: none` on `.react-flow__node` itself
      // whenever nodesDraggable/nodesConnectable/elementsSelectable are all
      // false (our case outside edit mode) — it expects nodes' own
      // interactive content to opt back in. Without this, the profile link
      // and the collapse button are both inert: clicks fall through to the
      // pane underneath instead of reaching them.
      className="relative w-full h-full pointer-events-auto"
    >
      {hasParent && <Handle type="target" position={Position.Top} isConnectable={false} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent" />}

      {linkToProfile ? (
        <Link href={`/employees/${user.id}`} className={`${cardClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400`}>
          {cardContent}
        </Link>
      ) : (
        <div className={cardClassName}>{cardContent}</div>
      )}

      {(hasChildren || adminActions) && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {hasChildren && (
            <button
              type="button"
              onClick={() => data.onToggleCollapse(id)}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${user.displayName}'s team (${reportsLabel})`}
              // `nodrag`: React Flow treats any pointerdown inside a
              // draggable node as a potential drag-start unless the target
              // is inside a `.nodrag` element — without it, edit mode (where
              // nodesDraggable is true) would swallow this click as a drag
              // gesture instead of toggling collapse.
              className="nodrag flex items-center gap-0.5 min-w-[44px] min-h-[26px] px-2 py-1 rounded-full border border-table-border bg-white text-[11px] font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden="true" />
              {descendantCount}
            </button>
          )}

          {adminActions && (
            <>
              <button
                type="button"
                onClick={() => adminActions.onAddReport(id)}
                aria-label={`Add direct report to ${user.displayName}`}
                className="nodrag flex items-center justify-center w-[26px] h-[26px] rounded-full border border-table-border bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More actions for ${user.displayName}`}
                  className="nodrag flex items-center justify-center w-[26px] h-[26px] rounded-full border border-table-border bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => adminActions.onEditEntry(id)}>Edit chart entry</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => adminActions.onChangeManager(id)}>Change Manager</DropdownMenuItem>
                  {hasChildren && (
                    <DropdownMenuItem onClick={() => adminActions.onReorderSiblings(id)}>Reorder Direct Reports</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => adminActions.onReplace(id)}>Replace</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => adminActions.onRemove(id)}>
                    Remove from chart
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      )}

      {hasChildren && !collapsed && (
        <Handle type="source" position={Position.Bottom} isConnectable={false} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent" />
      )}
    </div>
  );
}
