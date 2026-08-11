"use client";

import { useAdminPointsActions } from "@/lib/hooks/useAdminPointsActions";
import { BudgetBar } from "@/components/admin/points/BudgetBar";
import { SingleAwardForm } from "@/components/admin/points/SingleAwardForm";
import { BulkAwardForm } from "@/components/admin/points/BulkAwardForm";
import { DeductForm } from "@/components/admin/points/DeductForm";
import { AttendanceForm } from "@/components/admin/points/AttendanceForm";
import { TransactionsTable } from "@/components/admin/points/TransactionsTable";

export default function AwardPointsPage() {
  const {
    employees,
    transactions,
    txLoading,
    txError,
    tab, setTab,
    budget,

    toUserId, setToUserId,
    amount, setAmount,
    note, setNote,
    activity,
    submitting,
    success,
    error,

    bulkDeptFilter, setBulkDeptFilter,
    bulkSelected,
    bulkAmount, setBulkAmount,
    bulkNote, setBulkNote,
    bulkActivity,
    bulkSubmitting,
    bulkSuccess,
    bulkError,

    attendanceMonth, setAttendanceMonth,
    attendanceUploading,
    attendanceResult,
    attendanceError,
    attendanceFileRef,

    deductUserId, setDeductUserId,
    deductViolation, setDeductViolation,
    deductCustomAmount, setDeductCustomAmount,
    deductReason, setDeductReason,
    deductSubmitting,
    deductSuccess,
    deductError,

    txPage, setTxPage,
    txPages,

    departments,
    selectableEmployees,
    filteredForBulk,
    allFilteredSelected,

    loadHistory,
    handleAttendanceFile,
    handleSingleSubmit,
    handleDeductSubmit,
    handleBulkSubmit,
    toggleEmployee,
    toggleSelectAll,
    handleActivityChange,
    handleBulkActivityChange,
  } = useAdminPointsActions();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Award Points</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manually award points to employees.
        </p>
      </div>

      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        {/* Tabs */}
        <div role="tablist" aria-label="Award type" className="flex border-b border-gray-100 overflow-x-auto">
          {(["single", "bulk", "deduct", "attendance"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-6 py-3.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${
                tab === t
                  ? t === "deduct"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-900 border-b-2 border-command-black"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "single" ? "Single Award" : t === "bulk" ? "Bulk Award" : t === "deduct" ? "Deduct Points" : "Attendance"}
            </button>
          ))}
        </div>

        <div className="px-6 py-5">
          {tab !== "deduct" && tab !== "attendance" && <BudgetBar budget={budget} />}
          {tab === "attendance" ? (
            <AttendanceForm
              attendanceMonth={attendanceMonth}
              setAttendanceMonth={setAttendanceMonth}
              attendanceUploading={attendanceUploading}
              attendanceResult={attendanceResult}
              attendanceError={attendanceError}
              attendanceFileRef={attendanceFileRef}
              onFileChange={handleAttendanceFile}
            />
          ) : tab === "deduct" ? (
            <DeductForm
              employees={employees}
              deductUserId={deductUserId}
              setDeductUserId={setDeductUserId}
              deductViolation={deductViolation}
              setDeductViolation={setDeductViolation}
              deductCustomAmount={deductCustomAmount}
              setDeductCustomAmount={setDeductCustomAmount}
              deductReason={deductReason}
              setDeductReason={setDeductReason}
              deductSuccess={deductSuccess}
              deductError={deductError}
              deductSubmitting={deductSubmitting}
              onSubmit={handleDeductSubmit}
            />
          ) : tab === "single" ? (
            <SingleAwardForm
              employees={selectableEmployees}
              toUserId={toUserId}
              setToUserId={setToUserId}
              activity={activity}
              onActivityChange={handleActivityChange}
              amount={amount}
              setAmount={setAmount}
              note={note}
              setNote={setNote}
              success={success}
              error={error}
              budget={budget}
              submitting={submitting}
              onSubmit={handleSingleSubmit}
            />
          ) : (
            <BulkAwardForm
              departments={departments}
              bulkDeptFilter={bulkDeptFilter}
              setBulkDeptFilter={setBulkDeptFilter}
              filteredForBulk={filteredForBulk}
              bulkSelected={bulkSelected}
              toggleEmployee={toggleEmployee}
              allFilteredSelected={allFilteredSelected}
              toggleSelectAll={toggleSelectAll}
              bulkActivity={bulkActivity}
              onBulkActivityChange={handleBulkActivityChange}
              bulkAmount={bulkAmount}
              setBulkAmount={setBulkAmount}
              bulkNote={bulkNote}
              setBulkNote={setBulkNote}
              bulkSuccess={bulkSuccess}
              bulkError={bulkError}
              bulkSubmitting={bulkSubmitting}
              budget={budget}
              onSubmit={handleBulkSubmit}
            />
          )}
        </div>
      </div>

      <TransactionsTable
        transactions={transactions}
        txLoading={txLoading}
        txError={txError}
        txPage={txPage}
        txPages={txPages}
        setTxPage={setTxPage}
        onRetry={() => loadHistory(txPage)}
      />
    </div>
  );
}
