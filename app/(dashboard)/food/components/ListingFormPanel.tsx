"use client";

import type { AddOn } from "../types";
import { X, ImagePlus, Plus, Loader2 } from "lucide-react";

interface ListingFormPanelProps {
  editingId: string | null;
  newTitle: string;
  onTitleChange: (value: string) => void;
  newDesc: string;
  onDescChange: (value: string) => void;
  newPrice: string;
  onPriceChange: (value: string) => void;
  newCutoff: string;
  onCutoffChange: (value: string) => void;
  newDeliveryDate: string;
  onDeliveryDateChange: (value: string) => void;
  existingImageUrls: string[];
  imagePreviews: string[];
  totalImages: number;
  onImagePick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveExistingImage: (idx: number) => void;
  onRemoveNewImage: (idx: number) => void;
  newAddOns: AddOn[];
  addOnName: string;
  onAddOnNameChange: (value: string) => void;
  addOnPrice: string;
  onAddOnPriceChange: (value: string) => void;
  onAddAddOn: () => void;
  onRemoveAddOn: (idx: number) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function ListingFormPanel(props: ListingFormPanelProps) {
  const {
    editingId, newTitle, onTitleChange, newDesc, onDescChange, newPrice, onPriceChange,
    newCutoff, onCutoffChange, newDeliveryDate, onDeliveryDateChange,
    existingImageUrls, imagePreviews, totalImages, onImagePick, onRemoveExistingImage, onRemoveNewImage,
    newAddOns, addOnName, onAddOnNameChange, addOnPrice, onAddOnPriceChange, onAddAddOn, onRemoveAddOn,
    creating, onSubmit, onCancel,
  } = props;

  // Calculate minimum cutoff time (1 minute from now)
  // eslint-disable-next-line react-hooks/purity
  const minCutoffTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="bg-white rounded-card border border-table-border p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">{editingId ? "Edit Listing" : "New Listing"}</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              required value={newTitle} onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Homemade Lumpia"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex justify-between items-baseline mb-1">
              <label className="block text-xs font-medium text-gray-600">Description <span className="text-gray-500 font-normal">(optional)</span></label>
              <span className={`text-xs ${newDesc.length > 1800 ? "text-red-500" : "text-gray-500"}`}>{newDesc.length}/2000</span>
            </div>
            <textarea
              value={newDesc} onChange={(e) => onDescChange(e.target.value)} rows={3}
              maxLength={2000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Price (₱)</label>
            <input
              required type="number" min="1" step="0.01" value={newPrice} onChange={(e) => onPriceChange(e.target.value)}
              placeholder="120.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Order cutoff</label>
            <input
              required type="datetime-local" value={newCutoff} onChange={(e) => onCutoffChange(e.target.value)}
              min={minCutoffTime}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Delivery date & time <span className="text-gray-500 font-normal">(optional)</span></label>
            <input
              type="datetime-local" value={newDeliveryDate} onChange={(e) => onDeliveryDateChange(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
        </div>

        {/* Image picker */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Photos <span className="text-gray-500 font-normal">(up to 3, optional)</span></label>
          <div className="flex items-center gap-2 flex-wrap">
            {existingImageUrls.map((src, i) => (
              <div key={src} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" aria-label="Remove image" onClick={() => onRemoveExistingImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 rounded-full p-0.5 text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" aria-label="Remove image" onClick={() => onRemoveNewImage(i)} className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 rounded-full p-0.5 text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {totalImages < 3 && (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-navy-400 transition-colors">
                <ImagePlus className="w-5 h-5 text-gray-500" />
                <span className="text-[10px] text-gray-500 mt-0.5">Add</span>
                <input type="file" accept="image/*" className="hidden" onChange={onImagePick} multiple />
              </label>
            )}
          </div>
        </div>

        {/* Add-ons */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Add-ons / Options <span className="text-gray-500 font-normal">(optional — e.g. Extra Rice ₱15, Spicy ₱0)</span>
          </label>
          {newAddOns.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {newAddOns.map((a, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                  {a.name}{a.price > 0 ? ` — ₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : " — Free"}
                  <button type="button" onClick={() => onRemoveAddOn(i)} aria-label="Remove add-on" className="text-gray-500 hover:text-gray-700">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {newAddOns.length < 10 && (
            <div className="flex gap-2">
              <input
                value={addOnName} onChange={(e) => onAddOnNameChange(e.target.value)}
                placeholder="Name (e.g. Extra Rice)"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddAddOn())}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <input
                value={addOnPrice} onChange={(e) => onAddOnPriceChange(e.target.value)}
                type="number" min="0" step="0.01" placeholder="₱ (0 = free)"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddAddOn())}
                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <button
                type="button" onClick={onAddAddOn}
                className="flex items-center gap-1 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Add
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit" disabled={creating}
             className="flex items-center gap-2 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {creating ? (editingId ? "Saving…" : "Creating…") : editingId ? "Save Changes" : "Post Listing"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
