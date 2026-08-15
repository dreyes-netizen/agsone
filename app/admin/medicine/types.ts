import type { MedicineCategory } from "@/lib/constants/medicineCategories";

export type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
  category: MedicineCategory;
  isActive: boolean;
};

export type MedicineRequest = {
  id: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string;
  createdAt: string;
  approvedAt?: string | null;
  user: { id: string; displayName: string; avatarUrl?: string | null };
  medicine: { id: string; name: string; imageUrl?: string | null };
  approvedBy?: { id: string; displayName: string } | null;
};

export type AddForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  category: MedicineCategory;
  imageFile: File | null;
  imagePreview: string;
};

export type EditForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  category: MedicineCategory;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isActive: boolean;
};
