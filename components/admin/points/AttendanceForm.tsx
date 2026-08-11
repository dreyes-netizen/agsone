"use client";

import { Upload, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { inputClass } from "@/components/admin/points/shared";
import type { AttendanceResult } from "@/lib/hooks/useAdminPointsActions";

export function AttendanceForm({
  attendanceMonth,
  setAttendanceMonth,
  attendanceUploading,
  attendanceResult,
  attendanceError,
  attendanceFileRef,
  onFileChange,
}: {
  attendanceMonth: string;
  setAttendanceMonth: (value: string) => void;
  attendanceUploading: boolean;
  attendanceResult: AttendanceResult;
  attendanceError: string;
  attendanceFileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Attendance Month</label>
        <input
          type="month"
          value={attendanceMonth}
          onChange={(e) => setAttendanceMonth(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-gray-500">Select the month this attendance data covers — not today&apos;s date.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-0.5">
        <p className="text-sm font-semibold text-blue-800">Perfect Attendance = 50 pts</p>
        <p className="text-xs text-blue-600">Days Present &gt; 20, Days Absent = 0, Undertime = 0</p>
      </div>

      <div>
        <input
          ref={attendanceFileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => attendanceFileRef.current?.click()}
          disabled={attendanceUploading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-command-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          {attendanceUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
          {attendanceUploading ? "Processing…" : "Upload Attendance File (.xlsx)"}
        </button>
      </div>

      {attendanceError && <p className="text-red-500 text-sm">{attendanceError}</p>}

      {attendanceResult && (
        <div className="space-y-3">
          {attendanceResult.awarded > 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                {attendanceResult.awarded} employee{attendanceResult.awarded !== 1 ? "s" : ""} awarded 50 pts for perfect attendance
              </p>
              {attendanceResult.awardedNames && attendanceResult.awardedNames.length > 0 && (
                <p className="text-xs text-emerald-700">{attendanceResult.awardedNames.join(", ")}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No employees with perfect attendance found in this file.</p>
          )}
          {attendanceResult.skipped.alreadyAwarded.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                Already awarded this month ({attendanceResult.skipped.alreadyAwarded.length})
              </p>
              <p className="text-xs text-amber-700">{attendanceResult.skipped.alreadyAwarded.join(", ")}</p>
            </div>
          )}
          {attendanceResult.skipped.notFound.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-gray-500" aria-hidden="true" />
                Employee IDs not found in system ({attendanceResult.skipped.notFound.length})
              </p>
              <p className="text-xs text-gray-500 font-mono">{attendanceResult.skipped.notFound.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
