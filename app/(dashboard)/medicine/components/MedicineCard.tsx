import type { Medicine } from "../types";
import { getStockState } from "../lib/medicineAvailability";
import { MedicineImage } from "./MedicineImage";

interface MedicineCardProps {
  medicine: Medicine;
  requesting: boolean;
  pending: boolean;
  onOpen: (medicine: Medicine) => void;
  onRequest: (medicine: Medicine) => void;
}

export function MedicineCard({ medicine, requesting, pending, onOpen, onRequest }: MedicineCardProps) {
  const stock = getStockState(medicine.stockQuantity);
  const disabled = stock.outOfStock || requesting || pending;

  const stockLine = stock.outOfStock
    ? { text: "Out of stock", className: "text-gray-500" }
    : stock.lowStock
    ? { text: `${medicine.stockQuantity} left`, className: "text-amber-600 font-medium" }
    : { text: `${medicine.stockQuantity} available`, className: "text-emerald-600 font-medium" };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(medicine)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(medicine);
        }
      }}
      aria-label={`View ${medicine.name}`}
      className={`group bg-white rounded-card border overflow-hidden cursor-pointer transition-shadow sm:hover:shadow-md sm:hover:-translate-y-0.5 sm:motion-safe:transition-transform sm:[transition-timing-function:cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black
        flex flex-row items-center w-full min-w-0
        sm:flex-col sm:items-stretch
        ${stock.outOfStock ? "border-gray-200" : "border-table-border"}`}
    >
      <div className="relative shrink-0 w-[88px] h-[88px] sm:w-full sm:h-auto">
        <MedicineImage
          src={medicine.imageUrl}
          alt={medicine.name}
          sizes="(min-width: 1280px) 19vw, (min-width: 1024px) 24vw, (min-width: 768px) 32vw, (min-width: 640px) 48vw, 88px"
          className="w-full h-full sm:aspect-[4/3]"
        />
        {stock.outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="text-[10px] sm:text-xs font-bold text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
              Out of stock
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-3.5 gap-1 sm:gap-1.5">
        <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 text-sm min-w-0 break-words">{medicine.name}</h3>
        {medicine.caption && (
          <p className="text-gray-500 leading-snug line-clamp-1 sm:line-clamp-2 text-xs min-w-0 break-words">{medicine.caption}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 mt-auto pt-1.5 sm:pt-2">
          <p className={`text-xs min-w-0 truncate ${stockLine.className}`}>{stockLine.text}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequest(medicine);
            }}
            disabled={disabled}
            aria-label={
              stock.outOfStock
                ? `${medicine.name} — out of stock`
                : pending
                ? `${medicine.name} — request pending`
                : `Request ${medicine.name}`
            }
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-command-black ${
              disabled
                ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                : "bg-command-black text-white hover:bg-gray-800"
            }`}
          >
            {pending ? "Pending" : "Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
