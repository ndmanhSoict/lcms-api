import { NextFunction, Request, Response } from 'express';
import { Assignment } from '../models/assignment.model.js';
import { Class } from '../models/class.model.js';
import { ClassSession } from '../models/classSession.model.js';
import { Enrollment } from '../models/enrollment.model.js';
import { Submission } from '../models/submission.model.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../shared/constants/roles.js';
import { ForbiddenError, NotFoundError } from '../shared/errors/AllErrors.js';

async function hasEnrollment(studentIds: string[], classId: string) {
  if (studentIds.length === 0) return false;
  return Boolean(
    await Enrollment.exists({
      studentId: { $in: studentIds },
      classId,
      leftAt: null,
    })
  );
}

async function getParentStudentIds(parentId: string) {
  const parent = await User.findOne({
    _id: parentId,
    role: ROLES.PARENT,
    isActive: true,
    deletedAt: null,
  })
    .select('parentInfo.studentIds')
    .lean();
  return parent?.parentInfo?.studentIds?.map(String) ?? [];
}

function assertBranchScope(branchId: string, requester: RequestUser) {
  if (requester.role === ROLES.SYSTEM_OWNER) return;
  if (!requester.branchId || branchId !== requester.branchId) {
    throw new ForbiddenError('Tệp không thuộc cơ sở của bạn');
  }
}

async function canReadClass(classId: string, requester: RequestUser, sessionTeacherId?: string) {
  if (requester.role === ROLES.SYSTEM_OWNER) return true;
  if (([ROLES.BRANCH_OWNER, ROLES.STAFF] as string[]).includes(requester.role)) return true;

  const cls = await Class.findOne({ _id: classId, deletedAt: null }).select('teacherId').lean();
  if (!cls) return false;

  if (requester.role === ROLES.TEACHER) {
    return cls.teacherId?.toString() === requester.id || sessionTeacherId === requester.id;
  }
  if (requester.role === ROLES.STUDENT) {
    return hasEnrollment([requester.id], classId);
  }
  if (requester.role === ROLES.PARENT) {
    return hasEnrollment(await getParentStudentIds(requester.id), classId);
  }
  return false;
}

export const authorizeUpload = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const parts = req.path.split('/').filter(Boolean);
    if (parts.length !== 2 || parts.some(part => part === '.' || part === '..')) {
      throw new NotFoundError('Tệp');
    }

    const [folder, filename] = parts;
    const fileUrl = `/uploads/${folder}/${filename}`;
    const requester = req.user;

    if (folder === 'assignments') {
      const assignment = await Assignment.findOne({
        attachmentUrls: fileUrl,
        deletedAt: null,
      })
        .select('branchId classId teacherId visibleToParent')
        .lean();
      if (!assignment) throw new NotFoundError('Tệp');

      assertBranchScope(assignment.branchId.toString(), requester);
      if (requester.role === ROLES.PARENT && !assignment.visibleToParent) {
        throw new ForbiddenError('Bạn không có quyền xem tệp này');
      }
      if (!(await canReadClass(assignment.classId.toString(), requester))) {
        throw new ForbiddenError('Bạn không có quyền xem tệp này');
      }
      return next();
    }

    if (folder === 'submissions' || folder === 'submission-feedback') {
      const submission = await Submission.findOne(
        folder === 'submissions' ? { attachmentUrls: fileUrl } : { feedbackAttachmentUrls: fileUrl }
      )
        .select('branchId classId studentId')
        .lean();
      if (!submission) throw new NotFoundError('Tệp');

      assertBranchScope(submission.branchId.toString(), requester);
      if (requester.role === ROLES.STUDENT) {
        if (submission.studentId.toString() !== requester.id) {
          throw new ForbiddenError('Bạn không có quyền xem tệp bài nộp này');
        }
        return next();
      }
      if (requester.role === ROLES.PARENT) {
        throw new ForbiddenError('Bạn không có quyền xem tệp bài nộp này');
      }
      if (!(await canReadClass(submission.classId.toString(), requester))) {
        throw new ForbiddenError('Bạn không có quyền xem tệp bài nộp này');
      }
      return next();
    }

    if (folder === 'session-materials') {
      const session = await ClassSession.findOne({
        'materials.url': fileUrl,
        deletedAt: null,
      })
        .select('branchId classId teacherId')
        .lean();
      if (!session) throw new NotFoundError('Tệp');

      assertBranchScope(session.branchId.toString(), requester);
      if (
        !(await canReadClass(session.classId.toString(), requester, session.teacherId?.toString()))
      ) {
        throw new ForbiddenError('Bạn không có quyền xem tài liệu buổi học này');
      }
      return next();
    }

    throw new NotFoundError('Tệp');
  } catch (error) {
    next(error);
  }
};
