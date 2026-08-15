import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";

export function getStockState(stockQuantity: number) {
  const outOfStock = stockQuantity === 0;
  const unlimited = stockQuantity === -1;
  const lowStock = !outOfStock && !unlimited && stockQuantity <= LOW_STOCK_THRESHOLD;
  const label = outOfStock ? "Out of stock" : unlimited ? "Unlimited" : `${stockQuantity} left`;
  return { outOfStock, unlimited, lowStock, label };
}
