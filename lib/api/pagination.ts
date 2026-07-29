export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {}
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? String(defaults.page ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? String(defaults.limit ?? 25))));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}
