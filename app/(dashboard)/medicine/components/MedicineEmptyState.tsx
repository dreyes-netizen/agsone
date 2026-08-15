import type { LucideIcon } from "lucide-react";

interface MedicineEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function MedicineEmptyState({ icon: Icon, title, description, action }: MedicineEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center bg-white rounded-card border border-table-border px-4">
      <Icon className="w-10 h-10 text-gray-200 mb-4" aria-hidden="true" />
      <p className="text-gray-700 font-semibold">{title}</p>
      <p className="text-gray-500 text-sm mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
