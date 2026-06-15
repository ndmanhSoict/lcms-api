import type { Request } from 'express';
import type { FilterQuery, Types, UpdateQuery } from 'mongoose';
import type {
  AssignmentType,
  ClassType,
  GenderType,
  GenerationType,
  InvoiceType,
  MessageType,
  PaymentMethod,
  RelationshipType,
  RoleType,
  SessionStatus,
  SessionType,
} from '../shared/constants/roles.js';

declare global {
  type RequestUser = NonNullable<Request['user']>;

  type ObjectIdLike = string | Types.ObjectId;

  type JsonPrimitive = string | number | boolean | null;
  type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
  interface JsonObject {
    [key: string]: JsonValue;
  }

  type StoredMetadata = Record<string, unknown>;
  type AuditSnapshot = StoredMetadata;
  type VnpayStoredData = Record<string, unknown>;

  type QuestionAnswerValue =
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | boolean[]
    | Record<string, unknown>
    | Record<string, unknown>[];

  type MongoFilter<T> = FilterQuery<T>;
  type MongoUpdate<T> = UpdateQuery<T>;
  type EntityPatch = Record<string, unknown>;

  interface AppQuery {
    page?: string | number;
    limit?: string | number;
    search?: string;
    status?: string;
    role?: RoleType;
    type?: string;
    isActive?: string | boolean;
    is_active?: string | boolean;
    branchId?: string;
    branch_id?: string;
    classId?: string;
    class_id?: string;
    studentId?: string;
    student_id?: string;
    teacherId?: string;
    teacher_id?: string;
    subject?: string;
    subjectCode?: string;
    relationship?: RelationshipType;
    grade?: string | number;
    from?: string;
    to?: string;
    from_date?: string;
    to_date?: string;
    due_date_before?: string;
    billing_period?: string;
    academic_period?: string;
    include_unpublished?: string | boolean;
    consecutive_absences?: string | number;
    year?: string | number;
    from_month?: string | number;
    to_month?: string | number;
    bonus_amount?: string | number;
    deduction_amount?: string | number;
    rate_per_session?: string | number;
    note?: string;
    vnp_TxnRef?: string;
    vnp_SecureHash?: string;
    vnp_ResponseCode?: string;
    vnp_TransactionStatus?: string;
    [key: string]: unknown;
  }

  interface AppPayload {
    [key: string]: unknown;
    email?: string;
    phone?: string;
    password?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    role?: RoleType;
    branchId?: string;
    studentIds?: string[];
    student_ids?: string[];
    classCode?: string;
    code?: string;
    roomId?: string;
    capacity?: string | number;
    detail?: string;
    subject?: {
      name: string;
      code?: string;
      color?: string;
      icon?: string;
    };
    classType?: ClassType;
    maxStudents?: number;
    weeklySchedule?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomCode?: string;
    }>;
    userCode?: string;
    fullName?: string;
    dateOfBirth?: string | Date;
    gender?: GenderType;
    avatarUrl?: string;
    isActive?: boolean;
    studentInfo?: {
      activeClassIds?: ObjectIdLike[];
      parentIds?: ObjectIdLike[];
      enrollmentDate?: string | Date;
      schoolName?: string;
      grade?: number;
    };
    parentInfo?: {
      studentIds?: ObjectIdLike[];
      relationship?: RelationshipType;
    };
    relationship?: RelationshipType;
    parent?: AppPayload;
    teacherInfo?: {
      subjects?: string[];
      joinDate?: string | Date;
      activeClassIds?: ObjectIdLike[];
    };
    schoolName?: string;
    grade?: number;
    student_id?: string;
    class_id?: string;
    teacher_id?: string;
    branch_id?: string;
    invoice_type?: InvoiceType;
    billing_period?: string;
    sessions_attended?: number;
    sessions_total?: number;
    fee_per_session?: number;
    course_fee?: number;
    discount_amount?: number;
    discount_note?: string;
    due_date?: string;
    amount?: number;
    bank_code?: string;
    return_url?: string;
    ip_addr?: string;
    vnp_TxnRef?: string;
    vnp_SecureHash?: string;
    vnp_ResponseCode?: string;
    vnp_TransactionStatus?: string;
    note?: string;
    reason?: string;
    title?: string;
    description?: string;
    content?: string;
    content_text?: string;
    attachment_url?: string;
    attachment_urls?: string[];
    message_type?: MessageType;
    receiver_id?: string;
    questions?: unknown;
    answers?: unknown;
    assignment_type?: AssignmentType;
    max_score?: number;
    score?: number;
    feedback?: string;
    is_graded?: boolean;
    auto_grade?: boolean;
    release_score_after_due_date?: boolean;
    visible_to_parent?: boolean;
    submission_config?: unknown;
    allow_late?: boolean;
    allow_text?: boolean;
    allow_file?: boolean;
    max_file_size_mb?: number;
    accept_file_types?: string[];
    academic_period?: string;
    attendance_summary?: unknown;
    homework_scores?: unknown[];
    assignment_avg?: number;
    test_scores?: unknown[];
    exam_scores?: unknown[];
    regular_comment?: string;
    teacher_comment?: string;
    course_comment?: string;
    session_comments?: unknown[];
    monthly_comments?: unknown[];
    target_audience?: string[];
    is_pinned?: boolean;
    records?: Array<{
      student_id: string;
      status: string;
      note?: string;
    }>;
    sessionDate?: string | Date;
    teacherId?: string;
    sessionType?: SessionType;
    status?: SessionStatus | string;
    startTime?: string;
    endTime?: string;
    roomCode?: string;
    onlineMeetingUrl?: string;
    material?: {
      name?: string;
      url?: string;
      mimeType?: string;
      size?: number;
    };
    name?: string;
    branchCode?: string;
    rooms?: Array<string | { code?: string; name?: string; capacity?: number }>;
    defaultFeePerSession?: number;
    paymentMethod?: PaymentMethod;
    generationType?: GenerationType;
  }

  interface JwtUserPayload {
    id: string;
    email?: string;
    role: RoleType;
    branchId?: string;
  }

  interface PopulatedUserSummary {
    _id: Types.ObjectId;
    fullName?: string;
    userCode?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    role?: RoleType;
    branchId?: Types.ObjectId;
    isActive?: boolean;
    studentInfo?: {
      activeClassIds?: Array<Types.ObjectId | PopulatedClassSummary>;
      parentIds?: Types.ObjectId[];
      schoolName?: string;
      grade?: number;
    };
    parentInfo?: {
      studentIds?: Array<Types.ObjectId | PopulatedUserSummary>;
      relationship?: RelationshipType;
    };
  }

  interface PopulatedClassSummary {
    _id: Types.ObjectId;
    name?: string;
    classCode?: string;
    branchId?: Types.ObjectId;
    teacherId?: Types.ObjectId;
    classType?: ClassType;
    subject?: {
      name?: string;
      code?: string;
    };
    ongoingInfo?: {
      feePerSession?: number;
    };
    courseInfo?: {
      feePerCourse?: number;
    };
  }

  interface PopulatedSubmissionSummary {
    _id: Types.ObjectId;
    status?: string;
    submittedAt?: Date;
    score?: number;
    maxScore?: number;
    feedback?: string;
    assignmentId?: {
      title?: string;
      maxScore?: number;
      dueDate?: Date;
    };
  }
}

export {};
