// Award activities and point values from the AGS Rewards Hub Program Manual (§2).
// Single source of truth — used for API validation AND the award form dropdowns.

export const AWARD_CATEGORIES = {
  PERFORMANCE: "Performance & Work Excellence",
  TEAMWORK: "Teamwork & Culture",
  INNOVATION: "Innovation & Initiative",
  LEADERSHIP: "Leadership & Responsibility",
} as const;

export type AwardCategory = keyof typeof AWARD_CATEGORIES;

export type AwardActivity = {
  key: string;
  label: string;
  category: AwardCategory;
  points: number;
};

export const AWARD_ACTIVITIES: readonly AwardActivity[] = [
  // Performance & Work Excellence (manual §2.1)
  { key: "PERFECT_ATTENDANCE",      label: "Perfect attendance (monthly)",              category: "PERFORMANCE", points: 50 },
  { key: "KPI_4_OR_5",              label: "Hitting 4 or 5 in KPI (monthly)",           category: "PERFORMANCE", points: 50 },
  { key: "TOP_PERFORMER_WEEK",      label: "Top performer of the week",                 category: "PERFORMANCE", points: 30 },
  { key: "TOP_PERFORMER_MONTH",     label: "Top performer of the month",                category: "PERFORMANCE", points: 30 },
  { key: "PRODUCTIVITY_STANDARDS",  label: "Maintaining productivity standards",        category: "PERFORMANCE", points: 20 },
  { key: "CLIENT_COMMENDATION",     label: "Commendation from Client / Top Management", category: "PERFORMANCE", points: 30 },
  // Teamwork & Culture (§2.2)
  { key: "HELPING_TEAMMATES",       label: "Helping teammates voluntarily",             category: "TEAMWORK", points: 15 },
  { key: "PEER_RECOGNITION",        label: "Positive peer recognition",                 category: "TEAMWORK", points: 10 },
  { key: "CROSS_TEAM_COLLAB",       label: "Cross-team collaboration (cross-trained)",  category: "TEAMWORK", points: 25 },
  { key: "MENTORING",               label: "Mentoring new employees",                   category: "TEAMWORK", points: 30 },
  // Innovation & Initiative (§2.3)
  { key: "PROCESS_IMPROVEMENT",     label: "Suggesting process improvements",           category: "INNOVATION", points: 25 },
  { key: "APPROVED_IMPLEMENTATION", label: "Approved improvement implementation",       category: "INNOVATION", points: 75 },
  { key: "DOCUMENTATION",           label: "Creating useful documentation or training", category: "INNOVATION", points: 50 },
  { key: "RISK_IDENTIFICATION",     label: "Identifying operational risks or issues",   category: "INNOVATION", points: 30 },
  { key: "AUTOMATION_IDEAS",        label: "Automation or workflow optimization ideas", category: "INNOVATION", points: 50 },
  // Leadership & Responsibility (§2.5)
  { key: "MGMT_INITIATIVES",        label: "Assisting management initiatives",          category: "LEADERSHIP", points: 25 },
  { key: "TEMP_TEAM_LEAD",          label: "Acting as temporary team lead for a day",   category: "LEADERSHIP", points: 30 },
] as const;

export function findActivity(key: string): AwardActivity | undefined {
  return AWARD_ACTIVITIES.find((a) => a.key === key);
}

// Violation deductions from the manual (§4). HR_ADMIN only.
export const VIOLATION_TYPES = [
  { key: "UNPROFESSIONAL_BEHAVIOR",      label: "Unprofessional behavior",          points: 20 },
  { key: "INAPPROPRIATE_COMMENTS",       label: "Inappropriate comments or posts",  points: 50 },
  { key: "PROFANITY_OFFENSIVE_LANGUAGE", label: "Profanity or offensive language",  points: 75 },
  { key: "SPAM_POSTING",                 label: "Spam posting",                     points: 20 },
] as const;

export const MANAGER_MONTHLY_BUDGET = 500;
