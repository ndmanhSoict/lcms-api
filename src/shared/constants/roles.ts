// ============================================================
// LCMS — Shared Constants
// ============================================================

export const ROLES = {
  SYSTEM_OWNER: 'system_owner',
  BRANCH_OWNER: 'branch_owner',
  STAFF:        'staff',
  TEACHER:      'teacher',
  STUDENT:      'student',
  PARENT:       'parent',
} as const;

export type RoleType = typeof ROLES[keyof typeof ROLES];

export const GENDERS = {
  MALE:   'male',
  FEMALE: 'female',
  OTHER:  'other',
} as const;
export type GenderType = typeof GENDERS[keyof typeof GENDERS];

export const CLASS_TYPES = {
  COURSE:  'course',
  ONGOING: 'ongoing',
} as const;
export type ClassType = typeof CLASS_TYPES[keyof typeof CLASS_TYPES];

export const CLASS_STATUSES = {
  ACTIVE:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  UPCOMING:  'upcoming',
} as const;
export type ClassStatus = typeof CLASS_STATUSES[keyof typeof CLASS_STATUSES];

export const SESSION_TYPES = {
  REGULAR:   'regular',
  EXTRA:     'extra',
  MAKEUP:    'makeup',
  CANCELLED: 'cancelled',
} as const;
export type SessionType = typeof SESSION_TYPES[keyof typeof SESSION_TYPES];

export const SESSION_STATUSES = {
  SCHEDULED:  'scheduled',
  COMPLETED:  'completed',
  CANCELLED:  'cancelled',
} as const;
export type SessionStatus = typeof SESSION_STATUSES[keyof typeof SESSION_STATUSES];

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT:  'absent',
} as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  ESSAY:           'essay',
  FILL_BLANK:      'fill_blank',
  TRUE_FALSE:      'true_false',
} as const;
export type QuestionType = typeof QUESTION_TYPES[keyof typeof QUESTION_TYPES];

export const DIFFICULTY_LEVELS = {
  EASY:   'easy',
  MEDIUM: 'medium',
  HARD:   'hard',
} as const;
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[keyof typeof DIFFICULTY_LEVELS];

export const EXAM_STATUSES = {
  DRAFT:     'draft',
  PUBLISHED: 'published',
  CLOSED:    'closed',
} as const;
export type ExamStatus = typeof EXAM_STATUSES[keyof typeof EXAM_STATUSES];

export const ATTEMPT_STATUSES = {
  IN_PROGRESS:    'in_progress',
  SUBMITTED:      'submitted',
  AUTO_SUBMITTED: 'auto_submitted',
  GRADED:         'graded',
} as const;
export type AttemptStatus = typeof ATTEMPT_STATUSES[keyof typeof ATTEMPT_STATUSES];

export const INVOICE_TYPES = {
  MONTHLY: 'monthly',
  COURSE:  'course',
} as const;
export type InvoiceType = typeof INVOICE_TYPES[keyof typeof INVOICE_TYPES];

export const INVOICE_STATUSES = {
  UNPAID:    'unpaid',
  PAID:      'paid',
  OVERDUE:   'overdue',
  CANCELLED: 'cancelled',
  PARTIAL:   'partial',
} as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

export const PAYMENT_METHODS = {
  CASH:  'cash',
  VNPAY: 'vnpay',
} as const;
export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUSES = {
  PENDING:  'pending',
  SUCCESS:  'success',
  FAILED:   'failed',
  REFUNDED: 'refunded',
} as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

export const NOTIFICATION_TYPES = {
  ABSENCE:            'absence',
  INVOICE_DUE:        'invoice_due',
  SCORE_PUBLISHED:    'score_published',
  ASSIGNMENT_DUE:     'assignment_due',
  CLASS_ANNOUNCEMENT: 'class_announcement',
  SYSTEM:             'system',
} as const;
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const AUDIT_ACTIONS = {
  UPDATE_SCORE:    'UPDATE_SCORE',
  DELETE_STUDENT:  'DELETE_STUDENT',
  CHANGE_INVOICE:  'CHANGE_INVOICE',
  CREATE_ACCOUNT:  'CREATE_ACCOUNT',
  RESET_PASSWORD:  'RESET_PASSWORD',
  TRANSFER_CLASS:  'TRANSFER_CLASS',
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
  CANCEL_INVOICE:  'CANCEL_INVOICE',
  LOGIN:           'LOGIN',
  LOGOUT:          'LOGOUT',
  FAILED_LOGIN:    'FAILED_LOGIN',
  EXPORT_DATA:     'EXPORT_DATA',
} as const;
export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export const REVOKE_REASONS = {
  LOGOUT:           'logout',
  PASSWORD_CHANGED: 'password_changed',
  ADMIN_REVOKE:     'admin_revoke',
} as const;
export type RevokeReason = typeof REVOKE_REASONS[keyof typeof REVOKE_REASONS];

export const RELATIONSHIPS = {
  FATHER:   'father',
  MOTHER:   'mother',
  GUARDIAN: 'guardian',
  OTHER:    'other',
} as const;
export type RelationshipType = typeof RELATIONSHIPS[keyof typeof RELATIONSHIPS];

export const ASSIGNMENT_TYPES = {
  HOMEWORK:  'homework',
  PRACTICE:  'practice',
  PROJECT:   'project',
} as const;
export type AssignmentType = typeof ASSIGNMENT_TYPES[keyof typeof ASSIGNMENT_TYPES];

export const SUBMISSION_STATUSES = {
  DRAFT:              'draft',
  SUBMITTED:          'submitted',
  GRADED:             'graded',
  REVISION_REQUESTED: 'revision_requested',
} as const;
export type SubmissionStatus = typeof SUBMISSION_STATUSES[keyof typeof SUBMISSION_STATUSES];

export const GRADE_STATUSES = {
  DRAFT:     'draft',
  PUBLISHED: 'published',
} as const;
export type GradeStatus = typeof GRADE_STATUSES[keyof typeof GRADE_STATUSES];

export const MESSAGE_TYPES = {
  TEXT:  'text',
  FILE:  'file',
  IMAGE: 'image',
} as const;
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export const GENERATION_TYPES = {
  AUTO:   'auto',
  MANUAL: 'manual',
} as const;
export type GenerationType = typeof GENERATION_TYPES[keyof typeof GENERATION_TYPES];

export const LEFT_REASONS = {
  COMPLETED: 'completed',
  DROPPED:   'dropped',
} as const;
export type LeftReason = typeof LEFT_REASONS[keyof typeof LEFT_REASONS];

export const ATTENDANCE_SUBMISSION_STATUS = {
  PENDING:   'pending',
  SUBMITTED: 'submitted',
} as const;