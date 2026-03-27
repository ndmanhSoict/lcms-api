/**
 * Cấu trúc phản hồi thành công chuẩn hóa
 */
export interface ApiResponse<T = null> {
  success: true
  message: string
  data: T
  meta?: Record<string, unknown>
  requestId?: string
  timestamp: string
}

/**
 * Cấu trúc phản hồi lỗi chuẩn hóa
 */
export interface ApiErrorResponse {
  success: false
  message: string
  code: string
  details?: unknown
  requestId?: string
  timestamp: string
}