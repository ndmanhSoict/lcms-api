// ============================================================
// LCMS — Shared Constants
// ============================================================
export const ROLES = {
    SYSTEM_OWNER: 'system_owner',
    BRANCH_OWNER: 'branch_owner',
    STAFF: 'staff',
    TEACHER: 'teacher',
    STUDENT: 'student',
    PARENT: 'parent',
};
export const GENDERS = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
};
export const CLASS_TYPES = {
    COURSE: 'course',
    ONGOING: 'ongoing',
};
export const CLASS_STATUSES = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    UPCOMING: 'upcoming',
};
export const SESSION_TYPES = {
    REGULAR: 'regular',
    EXTRA: 'extra',
    MAKEUP: 'makeup',
    CANCELLED: 'cancelled',
};
export const SESSION_STATUSES = {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
export const ATTENDANCE_STATUS = {
    PRESENT: 'present',
    ABSENT: 'absent',
};
export const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple_choice',
    ESSAY: 'essay',
    FILL_BLANK: 'fill_blank',
    SHORT_ANSWER: 'short_answer',
    TRUE_FALSE: 'true_false',
};
export const DIFFICULTY_LEVELS = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard',
};
export const EXAM_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    CLOSED: 'closed',
};
export const ATTEMPT_STATUSES = {
    IN_PROGRESS: 'in_progress',
    SUBMITTED: 'submitted',
    AUTO_SUBMITTED: 'auto_submitted',
    GRADED: 'graded',
};
export const INVOICE_TYPES = {
    MONTHLY: 'monthly',
    COURSE: 'course',
};
export const INVOICE_STATUSES = {
    UNPAID: 'unpaid',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    PARTIAL: 'partial',
};
export const PAYMENT_METHODS = {
    CASH: 'cash',
    VNPAY: 'vnpay',
};
export const PAYMENT_STATUSES = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    REFUNDED: 'refunded',
};
export const NOTIFICATION_TYPES = {
    ABSENCE: 'absence',
    INVOICE_DUE: 'invoice_due',
    SCORE_PUBLISHED: 'score_published',
    ASSIGNMENT_DUE: 'assignment_due',
    ASSIGNMENT_CREATED: 'assignment_created',
    CLASS_CREATED: 'class_created',
    CLASS_UPDATED: 'class_updated',
    CLASS_ANNOUNCEMENT: 'class_announcement',
    CLASS_SESSION: 'class_session',
    CLASS_SESSION_UPDATED: 'class_session_updated',
    CLASS_SESSION_MATERIAL: 'class_session_material',
    ENROLLMENT_ADDED: 'enrollment_added',
    ENROLLMENT_LEFT: 'enrollment_left',
    ATTENDANCE_MARKED: 'attendance_marked',
    STUDENT_EVALUATION: 'student_evaluation',
    SYSTEM: 'system',
};
export const AUDIT_ACTIONS = {
    UPDATE_SCORE: 'UPDATE_SCORE',
    DELETE_STUDENT: 'DELETE_STUDENT',
    CHANGE_INVOICE: 'CHANGE_INVOICE',
    CREATE_ACCOUNT: 'CREATE_ACCOUNT',
    RESET_PASSWORD: 'RESET_PASSWORD',
    TRANSFER_CLASS: 'TRANSFER_CLASS',
    CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
    CANCEL_INVOICE: 'CANCEL_INVOICE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    CHANGE_PASSWORD: 'CHANGE_PASSWORD',
    FAILED_LOGIN: 'FAILED_LOGIN',
    EXPORT_DATA: 'EXPORT_DATA',
};
export const REVOKE_REASONS = {
    LOGOUT: 'logout',
    PASSWORD_CHANGED: 'password_changed',
    ADMIN_REVOKE: 'admin_revoke',
    ROTATED: 'rotated',
};
export const RELATIONSHIPS = {
    FATHER: 'father',
    MOTHER: 'mother',
    GUARDIAN: 'guardian',
    OTHER: 'other',
};
export const ASSIGNMENT_TYPES = {
    HOMEWORK: 'homework',
    PRACTICE: 'practice',
    PROJECT: 'project',
};
export const SUBMISSION_STATUSES = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    GRADED: 'graded',
    REVISION_REQUESTED: 'revision_requested',
};
export const GRADE_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
};
export const EVALUATION_PERIOD_TYPES = {
    SESSION: 'session',
    MONTHLY: 'monthly',
    COURSE: 'course',
};
export const EVALUATION_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
};
export const MESSAGE_TYPES = {
    TEXT: 'text',
    FILE: 'file',
    IMAGE: 'image',
};
export const GENERATION_TYPES = {
    AUTO: 'auto',
    MANUAL: 'manual',
};
export const LEFT_REASONS = {
    COMPLETED: 'completed',
    DROPPED: 'dropped',
};
export const ATTENDANCE_SUBMISSION_STATUS = {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
};
//# sourceMappingURL=roles.js.map