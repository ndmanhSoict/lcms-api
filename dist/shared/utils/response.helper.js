import { HttpStatus } from '../constants/httpStatus.js';
/**
 * Hàm gửi phản hồi thành công chuẩn hóa
 * @param res Đối tượng Response của Express
 * @param data Dữ liệu trả về (có thể là object, array hoặc null)
 * @param message Thông báo đi kèm
 * @param statusCode Mã trạng thái HTTP (mặc định 200)
 * @param meta Thông tin bổ sung (như phân trang)
 */
export function sendSuccess(res, data, message = 'Thành công', statusCode = HttpStatus.OK, meta) {
    const body = {
        success: true,
        message,
        data,
        ...(meta && { meta }),
        // Lấy requestId từ middleware requestId đã gán vào req
        requestId: res.req.requestId,
        timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(body);
}
/**
 * Helper cho phản hồi tạo mới thành công (201)
 */
export function sendCreated(res, data, message = 'Tạo mới thành công') {
    sendSuccess(res, data, message, HttpStatus.CREATED);
}
/**
 * Helper cho phản hồi không có nội dung (204)
 */
export function sendNoContent(res) {
    res.status(HttpStatus.NO_CONTENT).send();
}
/**
 * Helper chuyên biệt cho dữ liệu phân trang
 * @param res
 * @param data Mảng dữ liệu
 * @param paginationMeta Object chứa total, page, limit...
 */
export function sendPaginated(res, data, paginationMeta, message = 'Lấy danh sách thành công') {
    sendSuccess(res, data, message, HttpStatus.OK, paginationMeta);
}
//# sourceMappingURL=response.helper.js.map