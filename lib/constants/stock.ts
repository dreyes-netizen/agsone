// Single source of truth for "low stock" — used by the marketplace low-stock
// badge AND the admin overview's Stock Alerts panel, so both agree on what
// counts as running low. Rewards use -1 as a sentinel for unlimited stock;
// this threshold only applies to non-negative quantities.
export const LOW_STOCK_THRESHOLD = 3;
