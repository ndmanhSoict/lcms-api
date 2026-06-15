export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Xử lý query params để lấy các thông số phân trang
 */
export const getPagination = (queryPage?: unknown, queryLimit?: unknown): PaginationParams => {
  const page = Math.max(1, parseInt(String(queryPage ?? ''), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(queryLimit ?? ''), 10) || 50));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Tạo object metadata trả về cho Client
 */
export const getPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number
): PaginationResult => {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    totalPages,
    currentPage: page,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
