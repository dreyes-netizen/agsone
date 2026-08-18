import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

/**
 * Code of Conduct content lives as a single JSON value in `AppSetting`,
 * following the same key/value pattern as lib/settings/appSettings.ts. It's
 * structured (tiers of steps/examples) rather than freeform text so the admin
 * editor can add/remove individual steps and example offenses without an
 * employee ever seeing inconsistent formatting.
 */

const CODE_OF_CONDUCT_KEY = "code_of_conduct";

export const codeOfConductSchema = z.object({
  tiers: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      cleansingPeriodMonths: z.number().int().min(1),
      steps: z.array(
        z.object({
          order: z.number().int().min(1),
          description: z.string().min(1),
        })
      ),
      examples: z.array(z.string().min(1)),
    })
  ),
  promotionEffects: z.array(
    z.object({
      warningType: z.string().min(1),
      deferralMonths: z.string().min(1),
    })
  ),
});

export type CodeOfConduct = z.infer<typeof codeOfConductSchema>;

// Seeded from the original ags-employee-portal content so the page has real
// content on day one instead of an empty state.
export const DEFAULT_CODE_OF_CONDUCT: CodeOfConduct = {
  tiers: [
    {
      key: "A",
      label: "Minor Offenses",
      cleansingPeriodMonths: 1,
      steps: [
        { order: 1, description: "1st Offense: Verbal Warning" },
        { order: 2, description: "2nd Offense: Final Verbal Warning (-25% commission)" },
        { order: 3, description: "3rd Offense: Written Warning (-50% commission)" },
        { order: 4, description: "4th Offense: Final Written Warning (-75% commission)" },
        { order: 5, description: "5th Offense: Dismissal" },
      ],
      examples: [
        "Break-time non-observance",
        "Tardiness (6x/month or 60+ minutes accumulated)",
        "AWOL (1-2 days)",
        "Late filing of leave",
        "Inefficiency / repeated mistakes",
        "Loitering or sleeping on duty",
        "Unauthorized workstation transfer",
        "Indecent clothing",
      ],
    },
    {
      key: "B",
      label: "Serious Offenses",
      cleansingPeriodMonths: 3,
      steps: [
        { order: 1, description: "1st Offense: Written Warning (-50% commission)" },
        { order: 2, description: "2nd Offense: Final Written Warning (-75% commission)" },
        { order: 3, description: "3rd Offense: Dismissal" },
      ],
      examples: [
        "NCNS (No Call No Show)",
        "Discourtesy or insolence to colleagues or clients",
        "Misuse of company property",
        "Personal use of company internet",
        "Abandonment of work (3+ consecutive days AWOL)",
        "Failure to liquidate funds on time",
        "Unauthorized disposal of company property",
      ],
    },
    {
      key: "C",
      label: "Grave Offenses",
      cleansingPeriodMonths: 6,
      steps: [
        { order: 1, description: "Immediate Dismissal (or, if exceptionally retained, 6-month incentive ineligibility)" },
      ],
      examples: [
        "Falsification of records or timesheets",
        "Theft, fraud, embezzlement, or bribery",
        "Sexual harassment or intimidation",
        "Insubordination",
        "Disclosure of trade secrets",
        "Positive drug test",
        "Abuse of authority over subordinates",
        "Hacking company accounts",
      ],
    },
  ],
  promotionEffects: [
    { warningType: "Verbal Warning", deferralMonths: "6-month deferral" },
    { warningType: "Written Warning", deferralMonths: "9-month deferral" },
    { warningType: "Final Written Warning", deferralMonths: "12-month deferral" },
    { warningType: "Active NTE", deferralMonths: "On hold" },
  ],
};

export async function getCodeOfConduct(): Promise<CodeOfConduct> {
  const row = await prisma.appSetting.findUnique({ where: { key: CODE_OF_CONDUCT_KEY } });
  if (!row) return DEFAULT_CODE_OF_CONDUCT;
  const parsed = codeOfConductSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_CODE_OF_CONDUCT;
}

export async function setCodeOfConduct(value: CodeOfConduct, userId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: CODE_OF_CONDUCT_KEY },
    create: { key: CODE_OF_CONDUCT_KEY, value, updatedById: userId },
    update: { value, updatedById: userId },
  });
}
