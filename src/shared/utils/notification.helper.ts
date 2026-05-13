import { Types } from 'mongoose';
import { Enrollment } from '../../models/enrollment.model.js';
import { Notification } from '../../models/notification.model.js';
import { User } from '../../models/user.model.js';
import { NOTIFICATION_TYPES, NotificationType, ROLES } from '../constants/roles.js';

type RecipientId = string | Types.ObjectId | null | undefined;

type NotificationPayload = {
  branchId?: string | Types.ObjectId | null;
  type: NotificationType;
  title: string;
  content?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  excludeUserIds?: RecipientId[];
};

type ClassAudienceOptions = {
  teacher?: boolean;
  students?: boolean;
  parents?: boolean;
  branchUsers?: boolean;
};

const NOTIFICATION_TTL_DAYS = 180;

function normalizeId(value: RecipientId) {
  if (!value) return null;
  const text = value instanceof Types.ObjectId ? value.toString() : String(value);
  return Types.ObjectId.isValid(text) ? text : null;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function sendNotifications(recipientIds: RecipientId[], payload: NotificationPayload) {
  const exclude = new Set((payload.excludeUserIds ?? []).map(normalizeId).filter(Boolean));
  const recipients = [
    ...new Set(
      recipientIds
        .map(normalizeId)
        .filter((id): id is string => Boolean(id) && !exclude.has(id))
    ),
  ];

  if (recipients.length === 0) return 0;

  const createdAt = new Date();
  const branchId = normalizeId(payload.branchId);

  await Notification.insertMany(
    recipients.map(recipientId => ({
      branchId: branchId ? new Types.ObjectId(branchId) : null,
      recipientId: new Types.ObjectId(recipientId),
      type: payload.type,
      title: payload.title,
      content: payload.content ?? null,
      actionUrl: payload.actionUrl ?? null,
      channels: ['in_app'],
      metadata: payload.metadata ?? null,
      isRead: false,
      emailSent: false,
      createdAt,
      expiresAt: addDays(createdAt, NOTIFICATION_TTL_DAYS),
    }))
  );

  return recipients.length;
}

export async function getActiveClassStudentIds(classId: string | Types.ObjectId) {
  const enrollments = await Enrollment.find({
    classId: new Types.ObjectId(classId.toString()),
    leftAt: null,
  })
    .select('studentId')
    .lean();

  return [...new Set(enrollments.map(enrollment => enrollment.studentId.toString()))];
}

export async function getRelatedParentIds(studentIds: RecipientId[]) {
  const normalizedStudentIds = [
    ...new Set(studentIds.map(normalizeId).filter((id): id is string => Boolean(id))),
  ];

  if (normalizedStudentIds.length === 0) return [];

  const studentObjectIds = normalizedStudentIds.map(id => new Types.ObjectId(id));
  const students = await User.find({
    _id: { $in: studentObjectIds },
    role: ROLES.STUDENT,
    isActive: true,
    deletedAt: null,
  })
    .select('studentInfo.parentIds')
    .lean();

  const parentIdSet = new Set<string>();
  for (const student of students) {
    for (const parentId of student.studentInfo?.parentIds ?? []) {
      parentIdSet.add(parentId.toString());
    }
  }

  const parents = await User.find({
    role: ROLES.PARENT,
    isActive: true,
    deletedAt: null,
    'parentInfo.studentIds': { $in: studentObjectIds },
  })
    .select('_id')
    .lean();

  for (const parent of parents) {
    parentIdSet.add(parent._id.toString());
  }

  return [...parentIdSet];
}

export async function getBranchOwnerAndStaffIds(branchId: string | Types.ObjectId) {
  const users = await User.find({
    branchId: new Types.ObjectId(branchId.toString()),
    role: { $in: [ROLES.BRANCH_OWNER, ROLES.STAFF] },
    isActive: true,
    deletedAt: null,
  })
    .select('_id')
    .lean();

  return users.map(user => user._id.toString());
}

export async function getClassAudienceRecipientIds(cls: any, options: ClassAudienceOptions) {
  const recipientIds: string[] = [];
  let studentIds: string[] = [];

  if (options.teacher && cls.teacherId) {
    recipientIds.push(cls.teacherId.toString());
  }

  if (options.students || options.parents) {
    studentIds = await getActiveClassStudentIds(cls._id);
    if (options.students) recipientIds.push(...studentIds);
  }

  if (options.parents) {
    recipientIds.push(...await getRelatedParentIds(studentIds));
  }

  if (options.branchUsers) {
    recipientIds.push(...await getBranchOwnerAndStaffIds(cls.branchId));
  }

  return [...new Set(recipientIds)];
}

export { NOTIFICATION_TYPES };
