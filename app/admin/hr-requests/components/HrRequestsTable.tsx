"use client";

import { findHrRequestType } from "@/lib/constants/hrRequests";
import {
  HR_REQUEST_STATUS_BADGE,
  HR_REQUEST_STATUS_LABEL,
} from "@/lib/constants/hrRequestStatus";
import type { AdminHrRequest } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: AdminHrRequest["status"] }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
        HR_REQUEST_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {HR_REQUEST_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function HrRequestsTable({
  requests,
  onOpen,
}: {
  requests: AdminHrRequest[];
  onOpen: (request: AdminHrRequest) => void;
}) {
  if (requests.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No requests match these filters.</p>;
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-table-border">
              <th className="py-2 pr-3 font-semibold">Employee</th>
              <th className="py-2 pr-3 font-semibold">Request</th>
              <th className="py-2 pr-3 font-semibold">Filed</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 font-semibold">Handled by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-table-border">
            {requests.map((request) => (
              <tr
                key={request.id}
                onClick={() => onOpen(request)}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <td className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(request);
                    }}
                    className="text-left font-medium text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
                  >
                    {request.user.displayName}
                  </button>
                  <p className="text-xs text-gray-500">
                    {request.user.department?.name ?? "—"}
                  </p>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                    {request.tag}
                  </span>{" "}
                  <span className="text-gray-900">
                    {findHrRequestType(request.typeId)?.label ?? request.typeId}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">
                  {formatDate(request.createdAt)}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={request.status} />
                </td>
                <td className="py-2.5 text-gray-500">{request.handledBy?.displayName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="md:hidden divide-y divide-table-border">
        {requests.map((request) => (
          <li key={request.id}>
            <button
              type="button"
              onClick={() => onOpen(request)}
              className="w-full text-left py-3 flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {findHrRequestType(request.typeId)?.label ?? request.typeId}
                </p>
                <p className="text-xs text-gray-500 truncate">{request.user.displayName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(request.createdAt)}</p>
              </div>
              <StatusBadge status={request.status} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
