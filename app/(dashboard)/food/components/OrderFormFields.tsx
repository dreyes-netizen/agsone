import type { AddOn } from "../types";

interface OrderFormFieldsProps {
  addOns: AddOn[];
  qty: number;
  onQtyChange: (qty: number) => void;
  selectedAddOns: AddOn[];
  onSelectedAddOnsChange: (addOns: AddOn[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  total: number;
}

export function OrderFormFields(props: OrderFormFieldsProps) {
  const { addOns, qty, onQtyChange, selectedAddOns, onSelectedAddOnsChange, note, onNoteChange, total } = props;

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16 shrink-0">Quantity</label>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Decrease quantity" onClick={() => onQtyChange(Math.max(1, qty - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">−</button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
          <button type="button" aria-label="Increase quantity" onClick={() => onQtyChange(Math.min(99, qty + 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-500">+</button>
        </div>
      </div>
      {(addOns?.length ?? 0) > 0 && (
        <div className="space-y-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Add-ons</p>
          {(addOns ?? []).map((a, i) => {
            const checked = selectedAddOns.some((s) => s.name === a.name);
            return (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={checked}
                  onChange={(e) => onSelectedAddOnsChange(e.target.checked ? [...selectedAddOns, a] : selectedAddOns.filter((s) => s.name !== a.name))}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-gray-700 flex-1">{a.name}</span>
                <span className="text-xs font-semibold text-amber-700">{a.price > 0 ? `+₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : "Free"}</span>
              </label>
            );
          })}
        </div>
      )}
      <input
        value={note} onChange={(e) => onNoteChange(e.target.value)}
        placeholder="e.g. no onions (optional)"
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-gray-500">Total</span>
        <span className="font-bold text-emerald-700 text-sm">₱{total.toFixed(2)}</span>
      </div>
    </>
  );
}
