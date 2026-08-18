import Link from "next/link";
import { Avatar } from "@/components/feed/Avatar";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

const HIGHLIGHT_CLASS: Record<string, string> = {
  gold: "border-amber-400 bg-amber-50",
  teal: "border-teal-400 bg-teal-50",
};

export function OrgChartNodeCard({ node, linkToProfile = true }: { node: OrgChartUser; linkToProfile?: boolean }) {
  const highlightClass = (node.orgChartHighlight && HIGHLIGHT_CLASS[node.orgChartHighlight]) || "border-gray-200 bg-white";
  const content = (
    <div
      className={`inline-flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 ${node.orgChartDashed ? "border-dashed" : ""} ${highlightClass} shadow-sm hover:shadow-md transition-shadow w-[168px]`}
    >
      <Avatar name={node.displayName} url={node.avatarUrl} size="md" />
      <p className="text-sm font-semibold text-gray-900 text-center leading-tight">{node.displayName}</p>
      <p className="text-xs text-gray-500 text-center leading-tight">{node.position}</p>
    </div>
  );

  if (!linkToProfile) return content;
  return (
    <Link
      href={`/employees/${node.id}`}
      className="inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
    >
      {content}
    </Link>
  );
}
