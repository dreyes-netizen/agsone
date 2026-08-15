// Single source of truth for medicine category labels — shared by the
// employee medicine board and the admin medicine catalog. Text-only (no
// icons/colors): medicine's category chips are deliberately more restrained
// than the marketplace's icon-per-category badges.
export const MEDICINE_CATEGORIES = [
  "PAIN_RELIEF",
  "COUGH_COLD",
  "ALLERGY",
  "STOMACH",
  "VITAMINS",
  "OTHER",
] as const;

export type MedicineCategory = (typeof MEDICINE_CATEGORIES)[number];

export const MEDICINE_CATEGORY_LABEL: Record<MedicineCategory, string> = {
  PAIN_RELIEF: "Pain Relief",
  COUGH_COLD: "Cough & Cold",
  ALLERGY: "Allergy",
  STOMACH: "Stomach",
  VITAMINS: "Vitamins",
  OTHER: "Other",
};
