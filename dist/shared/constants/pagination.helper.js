/**
 * Xử lý query params để lấy các thông số phân trang
 */
export const getPagination = (queryPage, queryLimit) => {
    const page = Math.max(1, parseInt(queryPage) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryLimit) || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};
/**
 * Tạo object metadata trả về cho Client
 */
export const getPaginationMeta = (totalItems, page, limit) => {
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
//# sourceMappingURL=pagination.helper.js.map