"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download, Upload, UserPlus } from "lucide-react";

interface EmployeeToolbarProps {
  employeeCount: number;
  totalEmployees: number;
  syncing: boolean;
  exporting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAddClick: () => void;
  onUploadClick: () => void;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportClick: () => void;
}

export function EmployeeToolbar(props: EmployeeToolbarProps) {
  const { employeeCount, totalEmployees, syncing, exporting, fileInputRef, onAddClick, onUploadClick, onFileSelected, onExportClick } = props;
  const [showUploadGuide, setShowUploadGuide] = useState(false);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onFileSelected}
      />

      <button
        onClick={() => setShowUploadGuide((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>Upload Instructions</span>
        {showUploadGuide ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {showUploadGuide && (
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 text-sm space-y-3">
          <p className="text-gray-600">Upload an <strong>.xlsx</strong> file exported from Sprout HR. Column names must match exactly.</p>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Required Columns</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-700">
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Employee ID</code> — matches existing employees</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Last Name</code> — display name</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Middle Name</code> — display name</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">First Name</code> — display name</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Birthday</code> — used for birthday rewards</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Department</code> — auto-created if new</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Immediate Supervisor</code></li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Hire Date</code> — used for anniversary rewards</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Separation Date</code> — date = inactive, text like &quot;N/A&quot; = active</li>
              <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Email</code> — employee login account</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500">Points, level, role, and profile info are never changed by an upload.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-semibold text-gray-700">
            {employeeCount} of {totalEmployees} employees
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Add Employee
          </button>
          <button
            onClick={onUploadClick}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-command-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {syncing ? "Syncing…" : "Upload Employee List"}
          </button>
          <button
            onClick={onExportClick}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>
    </>
  );
}
