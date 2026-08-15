import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";

export function getStockState(stockQuantity: number) {
  const outOfStock = stockQuantity === 0;
  const lowStock = !outOfStock && stockQuantity <= LOW_STOCK_THRESHOLD;
  const label = outOfStock ? "Out of stock" : `${stockQuantity} available`;
  return { outOfStock, lowStock, label };
}
