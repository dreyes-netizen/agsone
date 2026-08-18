"use client";

import type { ReactNode } from "react";
import { Tree, TreeNode } from "react-organizational-chart";
import { OrgChartNodeCard } from "./OrgChartNodeCard";
import type { OrgChartTreeEntry, OrgChartUser } from "@/lib/orgChart/buildTree";

function Label({ node, linkToProfile, renderExtra }: { node: OrgChartUser; linkToProfile: boolean; renderExtra?: (node: OrgChartUser) => ReactNode }) {
  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <OrgChartNodeCard node={node} linkToProfile={linkToProfile} />
      {renderExtra?.(node)}
    </div>
  );
}

function renderEntry(entry: OrgChartTreeEntry, linkToProfile: boolean, renderExtra?: (node: OrgChartUser) => ReactNode) {
  return (
    <TreeNode key={entry.node.id} label={<Label node={entry.node} linkToProfile={linkToProfile} renderExtra={renderExtra} />}>
      {entry.children.map((child) => renderEntry(child, linkToProfile, renderExtra))}
    </TreeNode>
  );
}

export function OrgChartTree({
  roots,
  linkToProfile = true,
  renderExtra,
}: {
  roots: OrgChartTreeEntry[];
  linkToProfile?: boolean;
  renderExtra?: (node: OrgChartUser) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-12 overflow-x-auto py-6">
      {roots.map((root) => (
        <Tree
          key={root.node.id}
          label={<Label node={root.node} linkToProfile={linkToProfile} renderExtra={renderExtra} />}
          lineWidth="2px"
          lineColor="#CBD5E0"
          lineBorderRadius="8px"
        >
          {root.children.map((child) => renderEntry(child, linkToProfile, renderExtra))}
        </Tree>
      ))}
    </div>
  );
}
