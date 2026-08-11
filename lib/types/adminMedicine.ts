export type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  caption: string;
  stockQuantity: number;
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

export type AddMedicineForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageFile: File | null;
  imagePreview: string;
};

export type EditMedicineForm = {
  name: string;
  caption: string;
  stockQuantity: string;
  imageUrl: string;
  imageFile: File | null;
  imagePreview: string;
  isActive: boolean;
};
