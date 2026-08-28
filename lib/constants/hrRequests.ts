/**
 * The HR request catalog — the single source of truth behind the Email HR page.
 *
 * One structure drives four things that previously shared no vocabulary at all:
 * the request picker, the per-type fields the employee fills in, the composed
 * email, and the server-side validation in POST /api/hr-requests. Adding a
 * request type means adding an entry here and nothing else.
 *
 * Before this, `COMMON_HR_REQUESTS` was six strings that only set a subject
 * line, so HR received "Payslip Concern" with no cutoff, no amount, and no
 * indication of which deduction was being questioned — every request cost a
 * round-trip before it could be actioned.
 *
 * IMPORTANT — these ids are persisted on `HrRequest` (as `typeId`, `categoryId`
 * and the keys of the `fields` JSON), and select `value`s are persisted inside
 * that JSON. Renaming any of them orphans rows that are already stored. Add and
 * deprecate; never rename. `label` text, by contrast, is free to change: it is
 * only ever rendered, and stored rows keep the email body they were sent with.
 */

export type HrFieldKind = "text" | "textarea" | "date" | "select" | "number";

/**
 * Split so the stored value stays stable while the wording shown to employees
 * can be revised. `value` goes in the database; `label` goes in the email.
 */
export type HrFieldOption = { readonly value: string; readonly label: string };

export type HrField = {
  /** Stable key — becomes a key in the stored `fields` JSON. */
  readonly id: string;
  readonly label: string;
  readonly kind: HrFieldKind;
  readonly required: boolean;
  readonly placeholder?: string;
  /** Helper text under the input; also wired to `aria-describedby`. */
  readonly hint?: string;
  /** `select` only. */
  readonly options?: readonly HrFieldOption[];
  /** `text` / `textarea` only — doubles as the Gmail-URL length budget. */
  readonly maxLength?: number;
  /** `number` only. */
  readonly min?: number;
  readonly max?: number;
  /** `textarea` only. */
  readonly rows?: number;
};

export type HrRequestType = {
  /** Stable slug, unique across every category — it is the wire value. */
  readonly id: string;
  readonly label: string;
  /**
   * Subject-line prefix, e.g. "COE" renders as "[COE] …". Lets HR build Gmail
   * filters and labels without needing a separate mailbox per request type.
   */
  readonly tag: string;
  /**
   * Field whose value headlines the subject line. Falls back to `label` when
   * absent, or when the employee left that field blank.
   */
  readonly summaryFieldId?: string;
  /** Plain-language SLA, shown on the form and appended to the email. */
  readonly turnaround?: string;
  /**
   * Gmail's compose URL cannot carry attachments, so these are reminders for
   * the employee to attach files themselves before sending.
   */
  readonly attachments?: readonly string[];
  readonly fields: readonly HrField[];
};

export type HrRequestCategory = {
  readonly id: string;
  readonly label: string;
  readonly types: readonly HrRequestType[];
};

/**
 * Bumped only when a change would make an already-stored row misread — not for
 * ordinary additions. Persisted per row so such a change stays detectable.
 */
export const HR_CATALOG_VERSION = 1;

/** Worst-case composed body length, asserted by the catalog test. */
export const HR_BODY_MAX_CHARS = 4000;

const COPY_TYPE_OPTIONS: readonly HrFieldOption[] = [
  { value: "soft", label: "Soft copy (PDF via email)" },
  { value: "hard", label: "Hard copy (signed, for pickup)" },
  { value: "both", label: "Both" },
];

const PATIENT_OPTIONS: readonly HrFieldOption[] = [
  { value: "self", label: "Myself" },
  { value: "dependent", label: "A dependent" },
];

const LEAVE_ATTENDANCE: HrRequestCategory = {
  id: "leave",
  label: "Leave & Attendance",
  types: [
    {
      id: "leave_application",
      label: "Leave Application",
      tag: "LEAVE",
      summaryFieldId: "leave_type",
      turnaround: "File planned leave at least 3 working days ahead.",
      fields: [
        {
          id: "leave_type",
          label: "Type of leave",
          kind: "select",
          required: true,
          options: [
            { value: "vacation", label: "Vacation Leave" },
            { value: "sick", label: "Sick Leave" },
            { value: "emergency", label: "Emergency Leave" },
            { value: "bereavement", label: "Bereavement Leave" },
            { value: "maternity", label: "Maternity Leave" },
            { value: "paternity", label: "Paternity Leave" },
            { value: "solo_parent", label: "Solo Parent Leave" },
            { value: "sil", label: "Service Incentive Leave" },
            { value: "unpaid", label: "Unpaid Leave" },
          ],
        },
        { id: "start_date", label: "First day of leave", kind: "date", required: true },
        { id: "end_date", label: "Last day of leave", kind: "date", required: true },
        { id: "days", label: "Number of days", kind: "number", required: false, min: 0, max: 365 },
        { id: "reliever", label: "Who will cover your work?", kind: "text", required: false, maxLength: 150 },
        { id: "reason", label: "Reason", kind: "textarea", required: false, rows: 3, maxLength: 500 },
      ],
    },
    {
      id: "leave_balance",
      label: "Leave Balance Inquiry",
      tag: "LEAVE",
      summaryFieldId: "leave_type",
      fields: [
        {
          id: "leave_type",
          label: "Which balance?",
          kind: "select",
          required: true,
          options: [
            { value: "all", label: "All leave credits" },
            { value: "vacation", label: "Vacation Leave" },
            { value: "sick", label: "Sick Leave" },
            { value: "sil", label: "Service Incentive Leave" },
          ],
        },
        { id: "as_of", label: "As of date", kind: "date", required: false },
      ],
    },
    {
      id: "attendance_correction",
      label: "Attendance Correction",
      tag: "ATTENDANCE",
      summaryFieldId: "issue",
      turnaround: "Corrections are applied within the current payroll cutoff.",
      fields: [
        { id: "date", label: "Date affected", kind: "date", required: true },
        {
          id: "issue",
          label: "What went wrong?",
          kind: "select",
          required: true,
          options: [
            { value: "missed_in", label: "Missed time-in" },
            { value: "missed_out", label: "Missed time-out" },
            { value: "wrong_shift", label: "Wrong shift recorded" },
            { value: "not_reflected", label: "Not reflected at all" },
            { value: "ot_not_credited", label: "Overtime not credited" },
            { value: "wrongly_absent", label: "Marked absent but present" },
          ],
        },
        { id: "actual_time_in", label: "Actual time in", kind: "text", required: false, maxLength: 30, placeholder: "e.g. 8:02 AM" },
        { id: "actual_time_out", label: "Actual time out", kind: "text", required: false, maxLength: 30, placeholder: "e.g. 5:15 PM" },
      ],
    },
    {
      id: "overtime_undertime",
      label: "Overtime / Undertime Concern",
      tag: "ATTENDANCE",
      summaryFieldId: "concern",
      fields: [
        { id: "date", label: "Date affected", kind: "date", required: true },
        {
          id: "concern",
          label: "What's the concern?",
          kind: "select",
          required: true,
          options: [
            { value: "ot_unpaid", label: "Overtime not paid" },
            { value: "ot_unapproved", label: "Overtime not approved" },
            { value: "undertime", label: "Undertime deduction" },
            { value: "restday", label: "Rest day / holiday work not credited" },
          ],
        },
        { id: "hours", label: "Number of hours", kind: "number", required: false, min: 0, max: 300 },
      ],
    },
    {
      id: "schedule_change",
      label: "Schedule Change / Shift Swap",
      tag: "ATTENDANCE",
      fields: [
        { id: "effective_date", label: "Effective date", kind: "date", required: true },
        { id: "current_schedule", label: "Current schedule", kind: "text", required: false, maxLength: 100, placeholder: "e.g. 9:00 AM – 6:00 PM" },
        { id: "requested_schedule", label: "Requested schedule", kind: "text", required: true, maxLength: 100 },
        { id: "swap_with", label: "Swapping with (if applicable)", kind: "text", required: false, maxLength: 100 },
        { id: "reason", label: "Reason", kind: "textarea", required: false, rows: 3, maxLength: 500 },
      ],
    },
    {
      id: "wfh_request",
      label: "Work-From-Home Request",
      tag: "ATTENDANCE",
      fields: [
        { id: "start_date", label: "From", kind: "date", required: true },
        { id: "end_date", label: "Until", kind: "date", required: false },
        { id: "reason", label: "Reason", kind: "textarea", required: true, rows: 3, maxLength: 500 },
      ],
    },
  ],
};

const PAYROLL_PAYSLIP: HrRequestCategory = {
  id: "payroll",
  label: "Payroll & Payslip",
  types: [
    {
      id: "payslip_concern",
      label: "Payslip Concern",
      tag: "PAYROLL",
      summaryFieldId: "issue",
      turnaround: "Reviewed within the current cutoff; corrections appear on the next payout.",
      attachments: [
        "Screenshot or PDF of the payslip in question",
        "Your attendance record for the same period, if you have it",
      ],
      fields: [
        { id: "pay_period", label: "Pay period / cutoff", kind: "text", required: true, maxLength: 60, placeholder: "e.g. Aug 1–15, 2026" },
        {
          id: "issue",
          label: "What's the concern?",
          kind: "select",
          required: true,
          options: [
            { value: "deduction", label: "Deduction I don't recognise" },
            { value: "night_diff", label: "Night differential" },
            { value: "overtime", label: "Overtime pay" },
            { value: "holiday", label: "Holiday pay" },
            { value: "hours", label: "Missing or incorrect hours" },
            { value: "late_absence", label: "Late / absence deduction" },
            { value: "adjustment", label: "Salary adjustment not reflected" },
            { value: "allowance", label: "Allowance not received" },
            { value: "other", label: "Other" },
          ],
        },
        { id: "expected", label: "Expected amount (PHP)", kind: "number", required: false, min: 0, max: 10000000 },
        { id: "actual", label: "Amount on payslip (PHP)", kind: "number", required: false, min: 0, max: 10000000 },
      ],
    },
    {
      id: "payslip_copy",
      label: "Payslip Copy Request",
      tag: "PAYROLL",
      fields: [
        { id: "pay_period", label: "Pay period(s) needed", kind: "text", required: true, maxLength: 100 },
        { id: "copy_type", label: "Copy needed", kind: "select", required: false, options: COPY_TYPE_OPTIONS },
        { id: "purpose", label: "Purpose", kind: "text", required: false, maxLength: 150 },
      ],
    },
    {
      id: "thirteenth_month",
      label: "13th Month Pay",
      tag: "PAYROLL",
      summaryFieldId: "concern",
      fields: [
        { id: "year", label: "Year", kind: "text", required: false, maxLength: 10, placeholder: "e.g. 2026" },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "computation", label: "Computation breakdown" },
            { value: "release_date", label: "Release date" },
            { value: "not_received", label: "Not yet received" },
            { value: "incorrect", label: "Amount looks incorrect" },
          ],
        },
      ],
    },
    {
      id: "final_pay",
      label: "Final Pay / Back Pay",
      tag: "PAYROLL",
      summaryFieldId: "concern",
      turnaround: "Final pay is released within 30 days of clearance, per DOLE guidelines.",
      fields: [
        { id: "last_day", label: "Last day of employment", kind: "date", required: false },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "status", label: "Status of release" },
            { value: "computation", label: "Computation breakdown" },
            { value: "not_received", label: "Not yet received" },
            { value: "clearance", label: "Outstanding clearance requirement" },
          ],
        },
      ],
    },
    {
      id: "payroll_bank_change",
      label: "Payroll Bank Account Change",
      tag: "PAYROLL",
      attachments: ["A bank certificate, or a photo of your passbook or card showing the account name and number"],
      fields: [
        { id: "bank_name", label: "Bank", kind: "text", required: true, maxLength: 80 },
        { id: "account_number", label: "Account number", kind: "text", required: true, maxLength: 40 },
        { id: "account_name", label: "Account name", kind: "text", required: false, maxLength: 100 },
        { id: "effective_date", label: "Effective from cutoff", kind: "date", required: false },
      ],
    },
    {
      id: "salary_adjustment",
      label: "Salary Adjustment Inquiry",
      tag: "PAYROLL",
      fields: [
        { id: "effective_period", label: "Expected effective period", kind: "text", required: false, maxLength: 60 },
        { id: "concern", label: "What are you querying?", kind: "textarea", required: true, rows: 4, maxLength: 800 },
      ],
    },
  ],
};

const GOVERNMENT_BENEFITS: HrRequestCategory = {
  id: "gov_benefits",
  label: "Government Benefits & Loans",
  types: [
    {
      id: "sss_salary_loan",
      label: "SSS — Salary Loan",
      tag: "SSS",
      summaryFieldId: "concern",
      turnaround: "HR endorses to SSS within 2 working days; SSS releases on its own schedule.",
      attachments: ["A photo or scan of your SSS ID or UMID showing your SSS number"],
      fields: [
        { id: "sss_number", label: "SSS number", kind: "text", required: true, maxLength: 20, placeholder: "03-1234567-8", hint: "10 digits. Dashes optional." },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "new_application", label: "New loan application" },
            { value: "status", label: "Application status" },
            { value: "balance", label: "Outstanding loan balance" },
            { value: "amortization", label: "Amortization / payroll deduction" },
            { value: "cert_payments", label: "Certificate of loan payments" },
            { value: "reloan", label: "Re-loan eligibility" },
            { value: "other", label: "Other" },
          ],
        },
        { id: "date_applied", label: "Date applied", kind: "date", required: false },
        { id: "amount", label: "Loan amount (PHP)", kind: "number", required: false, min: 0, max: 1000000 },
      ],
    },
    {
      id: "sss_calamity_loan",
      label: "SSS — Calamity Loan",
      tag: "SSS",
      summaryFieldId: "concern",
      fields: [
        { id: "sss_number", label: "SSS number", kind: "text", required: true, maxLength: 20 },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "eligibility", label: "Eligibility / how to apply" },
            { value: "status", label: "Application status" },
            { value: "balance", label: "Outstanding balance" },
            { value: "amortization", label: "Amortization schedule" },
          ],
        },
        { id: "date_applied", label: "Date applied", kind: "date", required: false },
        { id: "amount", label: "Loan amount (PHP)", kind: "number", required: false, min: 0, max: 1000000 },
      ],
    },
    {
      id: "sss_benefit_claim",
      label: "SSS — Benefit Claim",
      tag: "SSS",
      summaryFieldId: "benefit_type",
      fields: [
        { id: "sss_number", label: "SSS number", kind: "text", required: true, maxLength: 20 },
        {
          id: "benefit_type",
          label: "Which benefit?",
          kind: "select",
          required: true,
          options: [
            { value: "sickness", label: "Sickness" },
            { value: "maternity", label: "Maternity" },
            { value: "disability", label: "Disability" },
            { value: "funeral", label: "Funeral" },
            { value: "retirement", label: "Retirement" },
            { value: "unemployment", label: "Unemployment" },
          ],
        },
        { id: "date_filed", label: "Date filed", kind: "date", required: false },
      ],
    },
    {
      id: "sss_contributions",
      label: "SSS — Contribution Inquiry",
      tag: "SSS",
      summaryFieldId: "concern",
      fields: [
        { id: "sss_number", label: "SSS number", kind: "text", required: true, maxLength: 20 },
        { id: "period", label: "Period in question", kind: "text", required: false, maxLength: 60, placeholder: "e.g. Jan–Jun 2026" },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "not_posted", label: "Contributions not posted" },
            { value: "certificate", label: "Certificate of contributions" },
            { value: "incorrect", label: "Contribution amount is incorrect" },
            { value: "remittance", label: "Employer remittance proof" },
          ],
        },
      ],
    },
    {
      id: "sss_member_records",
      label: "SSS — Number / Member Records",
      tag: "SSS",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "new_number", label: "New SSS number registration" },
            { value: "correction", label: "Correction of member details" },
            { value: "forms", label: "E-1 / E-4 form assistance" },
            { value: "posting", label: "Employer posting / R-3 concern" },
            { value: "beneficiaries", label: "Update of beneficiaries" },
          ],
        },
        { id: "sss_number", label: "SSS number (if you have one)", kind: "text", required: false, maxLength: 20 },
      ],
    },
    {
      id: "pagibig_mpl",
      label: "Pag-IBIG — Multi-Purpose Loan (MPL)",
      tag: "PAG-IBIG",
      summaryFieldId: "concern",
      turnaround: "HR endorses to Pag-IBIG within 2 working days.",
      fields: [
        { id: "pagibig_number", label: "Pag-IBIG MID number", kind: "text", required: true, maxLength: 20, placeholder: "1234-5678-9012" },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "new_application", label: "New loan application" },
            { value: "status", label: "Application status" },
            { value: "balance", label: "Outstanding loan balance" },
            { value: "amortization", label: "Amortization / payroll deduction" },
            { value: "eligibility", label: "Eligibility / how to apply" },
            { value: "reloan", label: "Re-loan eligibility" },
            { value: "other", label: "Other" },
          ],
        },
        { id: "date_applied", label: "Date applied", kind: "date", required: false },
        { id: "amount", label: "Loan amount (PHP)", kind: "number", required: false, min: 0, max: 1000000 },
      ],
    },
    {
      id: "pagibig_calamity_loan",
      label: "Pag-IBIG — Calamity Loan",
      tag: "PAG-IBIG",
      summaryFieldId: "concern",
      attachments: ["Proof of residence in the declared calamity area"],
      fields: [
        { id: "pagibig_number", label: "Pag-IBIG MID number", kind: "text", required: true, maxLength: 20 },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "eligibility", label: "Eligibility / how to apply" },
            { value: "status", label: "Application status" },
            { value: "balance", label: "Outstanding balance" },
            { value: "amortization", label: "Amortization schedule" },
          ],
        },
        { id: "date_applied", label: "Date applied", kind: "date", required: false },
        { id: "amount", label: "Loan amount (PHP)", kind: "number", required: false, min: 0, max: 1000000 },
      ],
    },
    {
      id: "pagibig_housing_loan",
      label: "Pag-IBIG — Housing Loan",
      tag: "PAG-IBIG",
      summaryFieldId: "concern",
      fields: [
        { id: "pagibig_number", label: "Pag-IBIG MID number", kind: "text", required: true, maxLength: 20 },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "eligibility", label: "Eligibility / how to apply" },
            { value: "status", label: "Application status" },
            { value: "coe_for_loan", label: "Certificate of employment for the loan" },
            { value: "amortization", label: "Amortization / payroll deduction" },
            { value: "balance", label: "Outstanding balance" },
          ],
        },
        { id: "date_applied", label: "Date applied", kind: "date", required: false },
      ],
    },
    {
      id: "pagibig_contributions",
      label: "Pag-IBIG — Contribution Inquiry",
      tag: "PAG-IBIG",
      summaryFieldId: "concern",
      fields: [
        { id: "pagibig_number", label: "Pag-IBIG MID number", kind: "text", required: false, maxLength: 20 },
        { id: "period", label: "Period in question", kind: "text", required: false, maxLength: 60 },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "not_posted", label: "Contributions not posted" },
            { value: "certificate", label: "Certificate of contributions" },
            { value: "incorrect", label: "Contribution amount is incorrect" },
            { value: "upgrade", label: "Upgrade my contribution rate" },
            { value: "mid_number", label: "MID number / registration" },
          ],
        },
      ],
    },
    {
      id: "philhealth_contributions",
      label: "PhilHealth — Contribution Inquiry",
      tag: "PHILHEALTH",
      summaryFieldId: "concern",
      fields: [
        { id: "philhealth_number", label: "PhilHealth number (PIN)", kind: "text", required: false, maxLength: 20 },
        { id: "period", label: "Period in question", kind: "text", required: false, maxLength: 60 },
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "not_posted", label: "Contributions not posted" },
            { value: "certificate", label: "Certificate of contributions" },
            { value: "incorrect", label: "Contribution amount is incorrect" },
            { value: "remittance", label: "Employer remittance proof" },
          ],
        },
      ],
    },
    {
      id: "philhealth_member_data",
      label: "PhilHealth — Member Records (MDR)",
      tag: "PHILHEALTH",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "mdr_copy", label: "Copy of my MDR" },
            { value: "dependents", label: "Add or update dependents" },
            { value: "correction", label: "Correct my member details" },
            { value: "new_pin", label: "New PhilHealth number (PIN)" },
          ],
        },
        { id: "philhealth_number", label: "PhilHealth number (if you have one)", kind: "text", required: false, maxLength: 20 },
      ],
    },
    {
      id: "philhealth_benefit",
      label: "PhilHealth — Benefit / Hospital Claim",
      tag: "PHILHEALTH",
      attachments: ["PhilHealth Claim Form 1", "The hospital's statement of account"],
      fields: [
        { id: "philhealth_number", label: "PhilHealth number (PIN)", kind: "text", required: true, maxLength: 20 },
        { id: "patient", label: "Who was admitted?", kind: "select", required: true, options: PATIENT_OPTIONS },
        { id: "hospital", label: "Hospital / facility", kind: "text", required: false, maxLength: 120 },
        { id: "admission_date", label: "Date of admission", kind: "date", required: false },
      ],
    },
    {
      id: "bir_2316",
      label: "BIR — Form 2316",
      tag: "BIR",
      turnaround: "BIR 2316 copies are released within 5 working days.",
      fields: [
        { id: "year", label: "Taxable year", kind: "text", required: true, maxLength: 10, placeholder: "e.g. 2025" },
        { id: "copy_type", label: "Copy needed", kind: "select", required: false, options: COPY_TYPE_OPTIONS },
        { id: "purpose", label: "Purpose", kind: "text", required: false, maxLength: 150 },
      ],
    },
    {
      id: "bir_tax_status",
      label: "BIR — TIN / Tax Status",
      tag: "BIR",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "tin_registration", label: "TIN registration" },
            { value: "tax_status", label: "Update my tax status" },
            { value: "dependents", label: "Add or remove dependents" },
            { value: "refund", label: "Tax refund inquiry" },
            { value: "annualization", label: "Annualization / year-end adjustment" },
            { value: "rdo_transfer", label: "Transfer of RDO" },
          ],
        },
        { id: "tin", label: "TIN (if you have one)", kind: "text", required: false, maxLength: 20 },
      ],
    },
  ],
};

const RECORDS_CERTIFICATES: HrRequestCategory = {
  id: "documents",
  label: "Certificates & Documents",
  types: [
    {
      id: "coe",
      label: "Certificate of Employment (COE)",
      tag: "COE",
      summaryFieldId: "purpose",
      turnaround: "COEs are typically released within 3 working days.",
      fields: [
        {
          id: "purpose",
          label: "Purpose of request",
          kind: "select",
          required: true,
          options: [
            { value: "loan_bank", label: "Bank / loan application" },
            { value: "visa", label: "Visa, travel or embassy" },
            { value: "new_employment", label: "New employment" },
            { value: "credit_card", label: "Credit card application" },
            { value: "school", label: "Scholarship or school requirement" },
            { value: "government", label: "Government transaction (SSS / Pag-IBIG / PhilHealth)" },
            { value: "personal", label: "Personal records" },
            { value: "other", label: "Other" },
          ],
        },
        {
          id: "include_salary",
          label: "Include compensation?",
          kind: "select",
          required: true,
          options: [
            { value: "no", label: "No — employment dates only" },
            { value: "yes", label: "Yes — include salary" },
          ],
          hint: "Banks and embassies usually require salary details; schools usually do not.",
        },
        {
          id: "addressed_to",
          label: "Addressed to",
          kind: "text",
          required: false,
          maxLength: 150,
          placeholder: "e.g. BDO Unibank",
          hint: 'Leave blank for "To Whom It May Concern".',
        },
        { id: "needed_by", label: "Needed by", kind: "date", required: false },
        { id: "copy_type", label: "Copy needed", kind: "select", required: false, options: COPY_TYPE_OPTIONS },
      ],
    },
    {
      id: "cert_contributions",
      label: "Certificate of Contributions",
      tag: "DOC",
      summaryFieldId: "agency",
      fields: [
        {
          id: "agency",
          label: "Which agency?",
          kind: "select",
          required: true,
          options: [
            { value: "sss", label: "SSS" },
            { value: "pagibig", label: "Pag-IBIG" },
            { value: "philhealth", label: "PhilHealth" },
            { value: "all", label: "All three" },
          ],
        },
        { id: "period", label: "Period covered", kind: "text", required: false, maxLength: 60 },
        { id: "copy_type", label: "Copy needed", kind: "select", required: false, options: COPY_TYPE_OPTIONS },
      ],
    },
    {
      id: "employment_verification",
      label: "Employment Verification (Third Party)",
      tag: "DOC",
      fields: [
        { id: "requestor", label: "Who is verifying?", kind: "text", required: true, maxLength: 150, placeholder: "e.g. HSBC background check team" },
        { id: "contact_details", label: "Their contact details", kind: "textarea", required: false, rows: 3, maxLength: 400 },
        { id: "needed_by", label: "Needed by", kind: "date", required: false },
      ],
    },
    {
      id: "service_record",
      label: "Service Record",
      tag: "DOC",
      fields: [
        { id: "purpose", label: "Purpose", kind: "text", required: false, maxLength: 150 },
        { id: "copy_type", label: "Copy needed", kind: "select", required: false, options: COPY_TYPE_OPTIONS },
      ],
    },
    {
      id: "clearance",
      label: "Clearance / Turnover Document",
      tag: "DOC",
      summaryFieldId: "purpose",
      fields: [
        { id: "last_day", label: "Last day of employment", kind: "date", required: false },
        {
          id: "purpose",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "form", label: "Clearance form" },
            { value: "status", label: "Status of my clearance" },
            { value: "turnover", label: "Turnover checklist" },
            { value: "quitclaim", label: "Quitclaim document" },
          ],
        },
      ],
    },
  ],
};

const PERSONAL_INFO: HrRequestCategory = {
  id: "personal_info",
  label: "Personal Information",
  types: [
    {
      id: "update_personal_info",
      label: "Update Personal Information",
      tag: "INFO",
      summaryFieldId: "field",
      attachments: ["A supporting document for the change — marriage certificate, valid ID, or bank certificate as applicable"],
      fields: [
        {
          id: "field",
          label: "What needs updating?",
          kind: "select",
          required: true,
          options: [
            { value: "name", label: "Name (marriage or legal change)" },
            { value: "civil_status", label: "Civil status" },
            { value: "address", label: "Home address" },
            { value: "contact", label: "Contact number" },
            { value: "email", label: "Personal email address" },
            { value: "emergency_contact", label: "Emergency contact" },
            { value: "dependents", label: "Dependents / beneficiaries" },
            { value: "bank", label: "Bank account" },
            { value: "other", label: "Other" },
          ],
        },
        { id: "old_value", label: "Current details", kind: "text", required: false, maxLength: 200 },
        { id: "new_value", label: "New details", kind: "text", required: true, maxLength: 200 },
        { id: "effective_date", label: "Effective from", kind: "date", required: false },
      ],
    },
  ],
};

const HMO_MEDICAL: HrRequestCategory = {
  id: "hmo",
  label: "HMO & Medical Benefits",
  types: [
    {
      id: "hmo_card",
      label: "HMO Card Request / Replacement",
      tag: "HMO",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "new", label: "New card (newly enrolled)" },
            { value: "lost", label: "Lost card" },
            { value: "damaged", label: "Damaged card" },
            { value: "not_received", label: "Not yet received" },
            { value: "incorrect", label: "Card details are incorrect" },
          ],
        },
        { id: "hmo_number", label: "HMO card number (if known)", kind: "text", required: false, maxLength: 40 },
      ],
    },
    {
      id: "hmo_dependent",
      label: "HMO Dependent Enrollment",
      tag: "HMO",
      attachments: ["The dependent's birth certificate, or your marriage certificate for a spouse"],
      fields: [
        { id: "dependent_name", label: "Dependent's full name", kind: "text", required: true, maxLength: 120 },
        {
          id: "relationship",
          label: "Relationship",
          kind: "select",
          required: true,
          options: [
            { value: "spouse", label: "Spouse" },
            { value: "child", label: "Child" },
            { value: "parent", label: "Parent" },
            { value: "sibling", label: "Sibling" },
          ],
        },
        { id: "birthday", label: "Date of birth", kind: "date", required: false },
      ],
    },
    {
      id: "hmo_loa",
      label: "HMO LOA / Hospital Admission",
      tag: "HMO",
      turnaround: "For emergencies call the HMO hotline directly first — this form is for follow-up.",
      fields: [
        { id: "patient", label: "Who is the patient?", kind: "select", required: true, options: PATIENT_OPTIONS },
        { id: "provider", label: "Hospital / clinic", kind: "text", required: true, maxLength: 120 },
        { id: "procedure", label: "Procedure or consultation", kind: "text", required: false, maxLength: 150 },
        { id: "schedule_date", label: "Scheduled date", kind: "date", required: false },
      ],
    },
    {
      id: "hmo_reimbursement",
      label: "HMO Reimbursement Claim",
      tag: "HMO",
      attachments: ["The official receipt", "A medical certificate", "Any lab results or prescriptions"],
      fields: [
        { id: "provider", label: "Hospital / clinic", kind: "text", required: true, maxLength: 120 },
        { id: "service_date", label: "Date of service", kind: "date", required: true },
        { id: "amount", label: "Amount paid (PHP)", kind: "number", required: false, min: 0, max: 10000000 },
        { id: "patient", label: "Who is the patient?", kind: "select", required: false, options: PATIENT_OPTIONS },
      ],
    },
    {
      id: "hmo_coverage",
      label: "HMO Coverage Inquiry",
      tag: "HMO",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you want to know?",
          kind: "select",
          required: true,
          options: [
            { value: "limit", label: "Maximum benefit limit" },
            { value: "providers", label: "Accredited hospitals and clinics" },
            { value: "exclusions", label: "Exclusions / what isn't covered" },
            { value: "effectivity", label: "Effectivity date of my coverage" },
            { value: "ape", label: "Annual physical exam schedule" },
            { value: "dental", label: "Dental coverage" },
          ],
        },
      ],
    },
  ],
};

const EMPLOYMENT_CAREER: HrRequestCategory = {
  id: "employment",
  label: "Employment & Career",
  types: [
    {
      id: "regularization",
      label: "Regularization / Contract Inquiry",
      tag: "EMPLOYMENT",
      summaryFieldId: "concern",
      fields: [
        {
          id: "concern",
          label: "What do you need?",
          kind: "select",
          required: true,
          options: [
            { value: "date", label: "Regularization date" },
            { value: "evaluation", label: "Status of my evaluation" },
            { value: "contract_copy", label: "Copy of my contract" },
            { value: "renewal", label: "Contract renewal" },
          ],
        },
        { id: "hire_date", label: "Date hired", kind: "date", required: false },
      ],
    },
    {
      id: "promotion_review",
      label: "Promotion / Salary Review",
      tag: "EMPLOYMENT",
      fields: [
        { id: "current_position", label: "Current position", kind: "text", required: false, maxLength: 100 },
        { id: "concern", label: "What are you requesting?", kind: "textarea", required: true, rows: 4, maxLength: 800 },
      ],
    },
    {
      id: "transfer_request",
      label: "Transfer Request",
      tag: "EMPLOYMENT",
      fields: [
        { id: "current_dept", label: "Current department / account", kind: "text", required: false, maxLength: 100 },
        { id: "requested_dept", label: "Requested department / account", kind: "text", required: true, maxLength: 100 },
        { id: "effective_date", label: "Preferred effective date", kind: "date", required: false },
        { id: "reason", label: "Reason", kind: "textarea", required: false, rows: 3, maxLength: 500 },
      ],
    },
    {
      id: "resignation",
      label: "Resignation / Turnover",
      tag: "EMPLOYMENT",
      turnaround: "Standard notice is 30 days unless your contract states otherwise.",
      fields: [
        { id: "last_day", label: "Intended last day", kind: "date", required: true },
        { id: "notice_date", label: "Date of notice", kind: "date", required: false },
        { id: "reason", label: "Reason", kind: "textarea", required: false, rows: 3, maxLength: 500 },
      ],
    },
    {
      id: "return_to_work",
      label: "Return to Work",
      tag: "EMPLOYMENT",
      attachments: ["A fit-to-work certificate, if you were on medical leave"],
      fields: [
        { id: "return_date", label: "Date returning", kind: "date", required: true },
        {
          id: "absence_reason",
          label: "Reason for absence",
          kind: "select",
          required: false,
          options: [
            { value: "medical", label: "Medical leave" },
            { value: "parental", label: "Maternity / paternity leave" },
            { value: "extended", label: "Extended leave" },
            { value: "suspension", label: "Suspension" },
            { value: "other", label: "Other" },
          ],
        },
      ],
    },
  ],
};

const GENERAL: HrRequestCategory = {
  id: "general",
  label: "General",
  types: [
    {
      id: "general_hr_question",
      label: "General HR Question",
      tag: "HR",
      summaryFieldId: "topic",
      // The catch-all that preserves today's free-form behaviour. Anything the
      // catalog doesn't cover still has a home rather than being forced into a
      // badly-fitting type.
      fields: [
        { id: "topic", label: "What's this about?", kind: "text", required: true, maxLength: 120 },
      ],
    },
  ],
};

export const HR_REQUEST_CATEGORIES: readonly HrRequestCategory[] = [
  LEAVE_ATTENDANCE,
  PAYROLL_PAYSLIP,
  GOVERNMENT_BENEFITS,
  RECORDS_CERTIFICATES,
  PERSONAL_INFO,
  HMO_MEDICAL,
  EMPLOYMENT_CAREER,
  GENERAL,
];

/**
 * Flat lookup, built once at module load so neither the form nor the API route
 * re-walks the category tree on every field render or every request.
 */
const TYPE_INDEX: ReadonlyMap<string, { type: HrRequestType; category: HrRequestCategory }> = new Map(
  HR_REQUEST_CATEGORIES.flatMap((category) =>
    category.types.map((type) => [type.id, { type, category }] as const),
  ),
);

export function findHrRequestType(id: string): HrRequestType | null {
  return TYPE_INDEX.get(id)?.type ?? null;
}

export function findHrCategoryForType(id: string): HrRequestCategory | null {
  return TYPE_INDEX.get(id)?.category ?? null;
}

export function findHrCategory(id: string): HrRequestCategory | null {
  return HR_REQUEST_CATEGORIES.find((c) => c.id === id) ?? null;
}

/**
 * The one-tap shortcuts above the dropdowns — the requests HR reports receiving
 * most. Deliberately short: a long chip row would defeat the point of having a
 * structured catalog underneath it.
 */
export const HR_QUICK_PICK_IDS = [
  "leave_application",
  "coe",
  "payslip_concern",
  "sss_salary_loan",
  "update_personal_info",
  "general_hr_question",
] as const;

export const HR_QUICK_PICKS: readonly { type: HrRequestType; category: HrRequestCategory }[] =
  HR_QUICK_PICK_IDS.flatMap((id) => {
    const entry = TYPE_INDEX.get(id);
    return entry ? [entry] : [];
  });

// ─── Shared validation ──────────────────────────────────────────────────────
//
// The form and POST /api/hr-requests run this same function, so a value the UI
// accepts is a value the server accepts, and neither can drift from the other.

export type HrFieldErrors = Record<string, string>;

export type HrValidateResult =
  | { ok: true; cleaned: Record<string, string> }
  | { ok: false; errors: HrFieldErrors };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects real-looking-but-impossible dates like 2026-02-30. */
function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export function validateHrRequestFields(
  type: HrRequestType,
  values: Record<string, string>,
): HrValidateResult {
  const errors: HrFieldErrors = {};
  const cleaned: Record<string, string> = {};

  for (const field of type.fields) {
    const raw = values[field.id];
    const value = typeof raw === "string" ? raw.trim() : "";

    if (!value) {
      if (field.required) errors[field.id] = `${field.label} is required`;
      // Optional and empty: omitted from `cleaned` entirely, never stored blank.
      continue;
    }

    switch (field.kind) {
      case "select": {
        if (!field.options?.some((o) => o.value === value)) {
          errors[field.id] = `Choose a valid option for ${field.label}`;
          continue;
        }
        break;
      }
      case "number": {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          errors[field.id] = `${field.label} must be a number`;
          continue;
        }
        if (field.min !== undefined && n < field.min) {
          errors[field.id] = `${field.label} cannot be less than ${field.min}`;
          continue;
        }
        if (field.max !== undefined && n > field.max) {
          errors[field.id] = `${field.label} cannot be more than ${field.max}`;
          continue;
        }
        break;
      }
      case "date": {
        if (!isRealDate(value)) {
          errors[field.id] = `${field.label} must be a valid date`;
          continue;
        }
        break;
      }
      case "text":
      case "textarea": {
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors[field.id] = `${field.label} must be ${field.maxLength} characters or fewer`;
          continue;
        }
        break;
      }
    }

    cleaned[field.id] = value;
  }

  // Unknown field ids are dropped rather than rejected: a tab left open across
  // a deploy that removed a field must not 400 forever.
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, cleaned };
}
