import { Types } from 'mongoose';
import { AssignmentRepository } from './assignment.repository.js';
import { IAssignment, IAssignmentQuestion } from '../../models/assignment.model.js';
import { ISubmission, ISubmissionAnswer } from '../../models/submission.model.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import {
  getClassAudienceRecipientIds,
  getRelatedParentIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ValidationError,
} from '../../shared/errors/AllErrors.js';

type IncomingQuestion = {
  prompt?: unknown;
  question?: unknown;
  type?: unknown;
  options?: IncomingOption[];
  points?: unknown;
};

type IncomingOption = {
  id?: unknown;
  text?: unknown;
  isCorrect?: unknown;
  is_correct?: unknown;
};

type IncomingAnswer = {
  questionId?: unknown;
  question_id?: unknown;
  value?: string | string[];
};

type SubmissionConfigPayload = {
  allow_late?: unknown;
  allow_text?: unknown;
  allow_file?: unknown;
  max_file_size_mb?: unknown;
  accept_file_types?: string[];
};

export class AssignmentService {
  private repo: AssignmentRepository;

  constructor() {
    this.repo = new AssignmentRepository();
  }

  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private booleanField(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return fallback;
  }

  private numberField(value: unknown, fallback?: number) {
    if (value == null || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toSubmissionConfig(value: unknown): SubmissionConfigPayload | null {
    if (value && typeof value === 'object') return value as SubmissionConfigPayload;
    return null;
  }

  private getUploadedUrls(
    files: Express.Multer.File[] | undefined,
    folder: 'assignments' | 'submissions' | 'submission-feedback'
  ) {
    return (files ?? []).map(file => `/uploads/${folder}/${file.filename}`);
  }

  private normalizeQuestions(value: unknown): IAssignmentQuestion[] {
    const questions = this.parseJsonField<IncomingQuestion[]>(value, []);
    if (!Array.isArray(questions)) return [];

    const normalized: IAssignmentQuestion[] = [];

    questions.forEach((question, index) => {
      const prompt = String(question?.prompt ?? question?.question ?? '').trim();
      const type: IAssignmentQuestion['type'] =
        question?.type === 'multiple_choice'
          ? 'multiple_choice'
          : question?.type === 'short_text'
            ? 'short_text'
            : 'single_choice';
      const options = Array.isArray(question?.options) ? question.options : [];

      if (!prompt) return;

      normalized.push({
        prompt,
        type,
        points: this.numberField(question?.points, undefined),
        options:
          type === 'short_text'
            ? []
            : options
                .map((option, optionIndex: number) => ({
                  id: String(option?.id || `q${index + 1}_o${optionIndex + 1}`),
                  text: String(option?.text ?? '').trim(),
                  isCorrect: this.booleanField(option?.isCorrect ?? option?.is_correct, false),
                }))
                .filter(option => option.text),
      });
    });

    return normalized;
  }

  private normalizeAnswers(value: unknown): ISubmissionAnswer[] {
    const answers = this.parseJsonField<IncomingAnswer[]>(value, []);
    if (!Array.isArray(answers)) return [];

    return answers
      .map(answer => ({
        questionId: String(answer?.questionId ?? answer?.question_id ?? '').trim(),
        value: answer?.value,
      }))
      .filter((answer): answer is ISubmissionAnswer =>
        Boolean(answer.questionId && answer.value != null)
      );
  }

  private validateAutoGradeConfig(
    questions: IAssignmentQuestion[],
    dueDate: Date | undefined,
    maxScore: number | undefined
  ) {
    if (!dueDate) {
      throw new ValidationError('Bài chấm tự động phải có hạn nộp');
    }
    if (maxScore == null || maxScore <= 0) {
      throw new ValidationError('Bài chấm tự động phải có điểm tối đa lớn hơn 0');
    }
    if (questions.length === 0) {
      throw new ValidationError('Bài chấm tự động phải có ít nhất một câu hỏi');
    }

    questions.forEach((question, index) => {
      if (question.type === 'short_text') {
        throw new ValidationError(`Câu ${index + 1} là câu trả lời ngắn nên chưa thể chấm tự động`);
      }
      if (question.points == null || question.points <= 0) {
        throw new ValidationError(`Câu ${index + 1} phải có số điểm lớn hơn 0`);
      }

      const correctCount = question.options.filter(option => option.isCorrect).length;
      if (question.type === 'single_choice' && correctCount !== 1) {
        throw new ValidationError(`Câu ${index + 1} phải có đúng một đáp án đúng`);
      }
      if (question.type === 'multiple_choice' && correctCount === 0) {
        throw new ValidationError(`Câu ${index + 1} phải có ít nhất một đáp án đúng`);
      }
    });
  }

  private autoGradeAnswers(
    questions: IAssignmentQuestion[],
    submittedAnswers: ISubmissionAnswer[],
    maxScore: number
  ) {
    const totalWeight = questions.reduce((sum, question) => sum + (question.points ?? 0), 0);
    let score = 0;

    const answers = submittedAnswers.map(answer => {
      const question = questions.find(item => item._id?.toString() === answer.questionId);
      if (!question) return answer;

      const selectedValues = Array.isArray(answer.value) ? answer.value : [answer.value];
      const correctValues = question.options
        .filter(option => option.isCorrect)
        .map(option => option.id);
      const isCorrect =
        selectedValues.length === correctValues.length &&
        selectedValues.every(value => correctValues.includes(value));
      const questionScore = isCorrect ? ((question.points ?? 0) / totalWeight) * maxScore : 0;
      score += questionScore;

      return {
        ...answer,
        isCorrect,
        score: Number(questionScore.toFixed(2)),
      };
    });

    return {
      answers,
      score: Number(score.toFixed(2)),
    };
  }

  private isScoreReleased(
    assignment: Pick<IAssignment, 'autoGrade' | 'releaseScoreAfterDueDate' | 'dueDate'>
  ) {
    if (!assignment.autoGrade || !assignment.releaseScoreAfterDueDate) return true;
    return Boolean(assignment.dueDate && new Date() >= new Date(assignment.dueDate));
  }

  private questionsForRequester(
    questions: IAssignmentQuestion[],
    requester: RequestUser,
    answersReleased: boolean
  ) {
    if (requester.role !== ROLES.STUDENT && requester.role !== ROLES.PARENT) return questions;
    if (requester.role === ROLES.STUDENT && answersReleased) return questions;

    return questions.map(question => ({
      ...question,
      options: question.options.map(option => ({ id: option.id, text: option.text })),
    }));
  }

  private submissionForStudent(
    submission: {
      _id?: unknown;
      status: string;
      submittedAt?: Date;
      score?: number;
      answers?: ISubmissionAnswer[];
      contentText?: string;
      attachmentUrls?: string[];
      isLate?: boolean;
      feedback?: string;
      feedbackAttachmentUrls?: string[];
      resubmitCount?: number;
    },
    resultReleased: boolean,
    canResubmit: boolean
  ) {
    return {
      _id: submission._id,
      status: resultReleased ? submission.status : 'submitted',
      content_text: submission.contentText,
      attachment_urls: submission.attachmentUrls ?? [],
      answers: (submission.answers ?? []).map(answer =>
        resultReleased ? answer : { questionId: answer.questionId, value: answer.value }
      ),
      submitted_at: submission.submittedAt,
      is_late: submission.isLate,
      score: resultReleased ? (submission.score ?? null) : null,
      feedback: resultReleased ? (submission.feedback ?? null) : null,
      feedback_attachment_urls: resultReleased ? (submission.feedbackAttachmentUrls ?? []) : [],
      resubmit_count: submission.resubmitCount ?? 0,
      can_resubmit: canResubmit,
    };
  }

  private canResubmit(assignment: IAssignment) {
    return (
      assignment.status === 'active' &&
      !assignment.answersReleasedAt &&
      (!assignment.dueDate || new Date() <= new Date(assignment.dueDate))
    );
  }

  // Lấy class + kiểm tra GV của lớp
  private async resolveClassAsTeacher(classId: string, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    return cls;
  }

  // Kiểm tra quyền xem bài tập của lớp (TC, SD, PR, SO/BO/ST)
  private async checkClassReadAccess(classId: string, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    const role = requester.role;

    if (role === ROLES.SYSTEM_OWNER) return cls;

    if (cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }

    if (([ROLES.BRANCH_OWNER, ROLES.STAFF] as string[]).includes(role)) return cls;

    if (role === ROLES.TEACHER) {
      if (cls.teacherId?.toString() !== requester.id) {
        throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
      }
      return cls;
    }

    if (role === ROLES.STUDENT) {
      const enrollment = await this.repo.findActiveEnrollment(
        requester.id,
        classId,
        cls.branchId.toString()
      );
      if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp này');
      return cls;
    }

    if (role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (childIds.length === 0) throw new ForbiddenError('Bạn không có học sinh trong lớp này');

      const enrollment = await this.repo.findChildEnrollmentInClass(
        childIds,
        classId,
        cls.branchId.toString()
      );
      if (!enrollment) throw new ForbiddenError('Con bạn không đang học trong lớp này');
      return cls;
    }

    throw new ForbiddenError('Không có quyền xem bài tập của lớp này');
  }

  // 8.1 GV tạo bài tập
  async createAssignment(
    classId: string,
    body: AppPayload,
    requester: RequestUser,
    files?: Express.Multer.File[]
  ) {
    const cls = await this.resolveClassAsTeacher(classId, requester);
    const questions = this.normalizeQuestions(body.questions);
    const dueDate = body.due_date ? new Date(body.due_date) : undefined;
    const maxScore = this.numberField(body.max_score, undefined);
    const autoGrade = this.booleanField(body.auto_grade, false);
    const releaseScoreAfterDueDate = autoGrade
      ? this.booleanField(body.release_score_after_due_date, true)
      : false;

    if (autoGrade) this.validateAutoGradeConfig(questions, dueDate, maxScore);
    const attachmentUrls = [
      ...this.parseJsonField<string[]>(body.attachment_urls, []),
      ...this.getUploadedUrls(files, 'assignments'),
    ].filter(Boolean);

    const submissionConfigBody = this.toSubmissionConfig(
      this.parseJsonField<unknown>(body.submission_config, null)
    );
    const submissionConfig = submissionConfigBody
      ? {
          allowLate: this.booleanField(submissionConfigBody.allow_late, true),
          allowText: this.booleanField(submissionConfigBody.allow_text, true),
          allowFile: this.booleanField(submissionConfigBody.allow_file, true),
          maxFileSizeMb: this.numberField(submissionConfigBody.max_file_size_mb, 10),
          allowedFileTypes: submissionConfigBody.accept_file_types ?? [],
        }
      : {
          allowLate: this.booleanField(body.allow_late, true),
          allowText: true,
          allowFile: true,
          maxFileSizeMb: 10,
          allowedFileTypes: [],
        };

    const assignment = await this.repo.createAssignment({
      branchId: cls.branchId,
      classId: new Types.ObjectId(classId),
      teacherId: new Types.ObjectId(requester.id),
      title: body.title ?? '',
      description: body.description,
      assignmentType: body.assignment_type ?? 'homework',
      dueDate,
      maxScore,
      isGraded: this.booleanField(body.is_graded, true),
      autoGrade,
      releaseScoreAfterDueDate,
      visibleToParent: this.booleanField(body.visible_to_parent, true),
      attachmentUrls,
      questions,
      submissionConfig,
      status: 'active',
      submissionCount: 0,
      gradedCount: 0,
    });

    const recipients = await getClassAudienceRecipientIds(cls, {
      students: true,
      parents: body.visible_to_parent ?? true,
    });
    const dueText = assignment.dueDate
      ? ` Hạn nộp: ${assignment.dueDate.toLocaleDateString('vi-VN')}.`
      : '';
    await sendNotifications(recipients, {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
      title: `Bài tập mới: ${assignment.title}`,
      content: `Lớp ${cls.name} có bài tập mới "${assignment.title}".${dueText}`,
      actionUrl: `/classes/${classId}/assignments`,
      metadata: {
        classId,
        assignmentId: assignment._id.toString(),
        createdBy: requester.id,
        createdByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });

    return {
      _id: assignment._id,
      class_id: classId,
      title: assignment.title,
      description: assignment.description,
      attachment_urls: assignment.attachmentUrls,
      questions: assignment.questions,
      due_date: assignment.dueDate,
      max_score: assignment.maxScore,
      auto_grade: assignment.autoGrade,
      release_score_after_due_date: assignment.releaseScoreAfterDueDate,
      status: assignment.status,
      submission_count: 0,
    };
  }

  // 8.2 Lấy danh sách bài tập
  async getAssignments(classId: string, query: AppQuery, requester: RequestUser) {
    const cls = await this.checkClassReadAccess(classId, requester);

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IAssignment> = {};
    if (query.status) filter.status = query.status;

    const { items, total } = await this.repo.findAssignmentsByClass(
      classId,
      cls.branchId.toString(),
      filter,
      skip,
      limit
    );

    // Nếu là học sinh, gắn my_submission
    const mySubmissions: Map<string, PopulatedSubmissionSummary> = new Map();
    if (requester.role === ROLES.STUDENT) {
      const { Submission } = await import('../../models/submission.model.js');
      const assignmentIds = items.map(a => a._id);
      const subs = await Submission.find({
        studentId: new Types.ObjectId(requester.id),
        assignmentId: { $in: assignmentIds },
      })
        .select('assignmentId status submittedAt score')
        .lean();

      subs.forEach(s => {
        mySubmissions.set(s.assignmentId.toString(), s as PopulatedSubmissionSummary);
      });
    }

    const data = items.map(a => {
      const sub = mySubmissions.get(a._id.toString());
      const scoreReleased = this.isScoreReleased(a);
      return {
        _id: a._id,
        class_id: a.classId,
        title: a.title,
        description: a.description,
        attachment_urls: a.attachmentUrls ?? [],
        questions: this.questionsForRequester(
          a.questions ?? [],
          requester,
          Boolean(a.answersReleasedAt)
        ),
        due_date: a.dueDate,
        max_score: a.maxScore,
        auto_grade: a.autoGrade ?? false,
        release_score_after_due_date: a.releaseScoreAfterDueDate ?? false,
        score_released: scoreReleased,
        answers_released: Boolean(a.answersReleasedAt),
        answers_released_at: a.answersReleasedAt ?? null,
        status: a.status,
        submission_count: a.submissionCount,
        graded_count: a.gradedCount,
        my_submission: sub
          ? {
              status: scoreReleased ? sub.status : 'submitted',
              submitted_at: sub.submittedAt,
              score: scoreReleased ? (sub.score ?? null) : null,
              can_resubmit: this.canResubmit(a),
            }
          : null,
      };
    });

    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  async getAssignment(assignmentId: string, requester: RequestUser) {
    const assignment = await this.repo.findAssignmentByIdWithClass(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');

    const cls = await this.checkClassReadAccess(assignment.classId._id.toString(), requester);
    if (assignment.branchId.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Bài tập không thuộc cơ sở của lớp học');
    }
    const assignmentTeacher = assignment.teacherId as PopulatedUserSummary;
    if (
      assignmentTeacher?.branchId &&
      assignmentTeacher.branchId.toString() !== assignment.branchId.toString()
    ) {
      throw new ForbiddenError('Giáo viên của bài tập không thuộc cơ sở của lớp học');
    }
    const mySubmission =
      requester.role === ROLES.STUDENT
        ? await this.repo.findSubmissionByStudent(
            assignmentId,
            requester.id,
            assignment.branchId.toString()
          )
        : null;
    const scoreReleased = this.isScoreReleased(assignment);
    const answersReleased = Boolean(assignment.answersReleasedAt);
    const resultReleased = scoreReleased || answersReleased;

    return {
      _id: assignment._id,
      class_id: assignment.classId._id,
      class: assignment.classId,
      teacher: assignment.teacherId,
      title: assignment.title,
      description: assignment.description,
      attachment_urls: assignment.attachmentUrls ?? [],
      questions: this.questionsForRequester(assignment.questions ?? [], requester, answersReleased),
      due_date: assignment.dueDate,
      max_score: assignment.maxScore,
      is_graded: assignment.isGraded,
      auto_grade: assignment.autoGrade ?? false,
      release_score_after_due_date: assignment.releaseScoreAfterDueDate ?? false,
      score_released: scoreReleased,
      answers_released: answersReleased,
      answers_released_at: assignment.answersReleasedAt ?? null,
      visible_to_parent: assignment.visibleToParent,
      submission_config: assignment.submissionConfig,
      status: assignment.status,
      submission_count: assignment.submissionCount,
      graded_count: assignment.gradedCount,
      my_submission: mySubmission
        ? this.submissionForStudent(mySubmission, resultReleased, this.canResubmit(assignment))
        : null,
    };
  }

  // 8.3 HS nộp bài
  async submitAssignment(
    assignmentId: string,
    body: AppPayload,
    requester: RequestUser,
    files?: Express.Multer.File[]
  ) {
    const assignment = await this.repo.findAssignmentById(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');
    if (assignment.status !== 'active') throw new BadRequestError('Bài tập không còn mở để nộp');
    if (assignment.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Bài tập không thuộc cơ sở của bạn');
    }

    // Kiểm tra HS đang học trong lớp
    const enrollment = await this.repo.findActiveEnrollment(
      requester.id,
      assignment.classId.toString(),
      assignment.branchId.toString()
    );
    if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp này');

    const existing = await this.repo.findSubmissionByStudentDoc(assignmentId, requester.id);

    // Kiểm tra hạn nộp
    const now = new Date();
    const isLate = assignment.dueDate ? now > assignment.dueDate : false;

    if (existing && assignment.answersReleasedAt) {
      throw new ValidationError('Giáo viên đã mở đáp án nên bài tập không thể làm lại');
    }

    if (isLate) {
      throw new ValidationError('Đã quá hạn nộp bài nên không thể làm hoặc nộp bài nữa');
    }

    const requestedAttachmentUrls = this.parseJsonField<string[]>(body.attachment_urls, []);
    const retainedAttachmentUrls = requestedAttachmentUrls.filter(
      url => /^https?:\/\//i.test(url) || existing?.attachmentUrls.includes(url)
    );
    const attachmentUrls = [
      ...retainedAttachmentUrls,
      ...this.getUploadedUrls(files, 'submissions'),
    ].filter(Boolean);
    let answers = this.normalizeAnswers(body.answers);
    const contentText = typeof body.content_text === 'string' ? body.content_text.trim() : '';

    if (!contentText && attachmentUrls.length === 0 && answers.length === 0) {
      throw new ValidationError('Phải có nội dung, câu trả lời hoặc tệp đính kèm');
    }

    if (attachmentUrls.length > 0 && assignment.submissionConfig?.allowFile === false) {
      throw new ValidationError('Bài tập này không cho phép nộp tệp đính kèm');
    }

    const autoGradeResult = assignment.autoGrade
      ? this.autoGradeAnswers(assignment.questions, answers, assignment.maxScore ?? 0)
      : null;
    if (autoGradeResult) answers = autoGradeResult.answers;

    const submissionStatus: ISubmission['status'] = autoGradeResult ? 'graded' : 'submitted';
    const submissionData = {
      branchId: assignment.branchId,
      assignmentId: new Types.ObjectId(assignmentId),
      studentId: new Types.ObjectId(requester.id),
      classId: assignment.classId,
      contentText: contentText || undefined,
      attachmentUrls,
      answers,
      submittedAt: now,
      isLate,
      status: submissionStatus,
      score: autoGradeResult?.score,
      feedback: autoGradeResult ? 'Bài được chấm tự động theo đáp án của giáo viên.' : undefined,
      gradedAt: autoGradeResult ? now : undefined,
      gradedBy: autoGradeResult ? assignment.teacherId : undefined,
      maxScore: assignment.maxScore ?? undefined,
    };

    const wasGraded = existing?.status === 'graded';
    const submission = existing
      ? await this.repo.resubmitSubmission(existing, submissionData)
      : await this.repo.createSubmission(submissionData);

    if (!existing) await this.repo.incrementSubmissionCount(assignmentId);
    if (!wasGraded && autoGradeResult) await this.repo.incrementGradedCount(assignmentId);
    if (wasGraded && !autoGradeResult) await this.repo.decrementGradedCount(assignmentId);

    const scoreReleased = this.isScoreReleased(assignment);

    return {
      _id: submission._id,
      assignment_id: assignmentId,
      student_id: requester.id,
      status: scoreReleased ? submission.status : 'submitted',
      submitted_at: submission.submittedAt,
      is_late: submission.isLate,
      attachment_urls: submission.attachmentUrls,
      answers: scoreReleased
        ? submission.answers
        : submission.answers.map((answer: ISubmissionAnswer) => ({
            questionId: answer.questionId,
            value: answer.value,
          })),
      score: scoreReleased ? (submission.score ?? null) : null,
      resubmit_count: submission.resubmitCount,
      can_resubmit: this.canResubmit(assignment),
    };
  }

  // 8.4 GV chấm điểm
  async gradeSubmission(
    submissionId: string,
    body: AppPayload,
    requester: RequestUser,
    files?: Express.Multer.File[]
  ) {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp');

    if (!['submitted', 'revision_requested'].includes(submission.status)) {
      throw new BadRequestError('Bài nộp không ở trạng thái có thể chấm điểm');
    }

    // Lấy assignment → kiểm tra GV của lớp
    const assignment = await this.repo.findAssignmentById(submission.assignmentId.toString());
    if (!assignment) throw new NotFoundError('Bài tập');

    const cls = await this.repo.findClassById(assignment.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (
      submission.branchId.toString() !== cls.branchId.toString() ||
      assignment.branchId.toString() !== cls.branchId.toString()
    ) {
      throw new ForbiddenError('Bài nộp không thuộc cơ sở của lớp học');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const score = this.numberField(body.score);
    if (score == null) throw new BadRequestError('Điểm không hợp lệ');

    if (assignment.maxScore != null && score > assignment.maxScore) {
      throw new BadRequestError(`Điểm không được vượt quá điểm tối đa (${assignment.maxScore})`);
    }

    const before = { status: submission.status, score: submission.score };

    const updated = await this.repo.updateSubmissionGrade(submission, {
      score,
      feedback: body.feedback,
      feedbackAttachmentUrls: this.getUploadedUrls(files, 'submission-feedback'),
      gradedBy: new Types.ObjectId(requester.id),
    });

    await this.repo.incrementGradedCount(submission.assignmentId.toString());

    // Audit log UPDATE_SCORE (ảnh hưởng học phí / học bạ)
    await this.repo.createAuditLog({
      action: 'UPDATE_SCORE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: cls.branchId,
      targetId: submission._id as Types.ObjectId,
      before,
      after: { status: 'graded', score, feedback: body.feedback },
    });

    const studentId = submission.studentId.toString();
    const parentIds = await getRelatedParentIds([studentId]);
    await sendNotifications([studentId, ...parentIds], {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.SCORE_PUBLISHED,
      title: `Bài tập đã được chấm: ${assignment.title}`,
      content: `Giáo viên đã chấm ${score}${assignment.maxScore ? `/${assignment.maxScore}` : ''} điểm cho bài tập "${assignment.title}".`,
      actionUrl: '/student/assignments',
      metadata: {
        classId: assignment.classId.toString(),
        assignmentId: assignment._id.toString(),
        submissionId: submission._id.toString(),
      },
      excludeUserIds: [requester.id],
    });

    return updated;
  }

  async releaseAnswers(assignmentId: string, requester: RequestUser) {
    const assignment = await this.repo.findAssignmentById(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');
    if (assignment.answersReleasedAt) return assignment;

    const cls = await this.repo.findClassById(assignment.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (assignment.branchId.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Bài tập không thuộc cơ sở của lớp học');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const updated = await this.repo.releaseAnswers(assignmentId, new Types.ObjectId(requester.id));
    if (!updated) return await this.repo.findAssignmentById(assignmentId);

    const recipients = await getClassAudienceRecipientIds(cls, { students: true, parents: false });
    await sendNotifications(recipients, {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.SCORE_PUBLISHED,
      title: `Đã mở đáp án: ${assignment.title}`,
      content: `Giáo viên đã mở đáp án bài tập "${assignment.title}". Bạn có thể xem đáp án và bài làm đã nộp.`,
      actionUrl: '/student/assignments',
      metadata: {
        classId: assignment.classId.toString(),
        assignmentId: assignment._id.toString(),
      },
      excludeUserIds: [requester.id],
    });

    return updated;
  }

  // 8.5 GV xem danh sách bài nộp
  async getSubmissions(assignmentId: string, query: AppQuery, requester: RequestUser) {
    const assignment = await this.repo.findAssignmentById(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');

    const cls = await this.repo.findClassById(assignment.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (assignment.branchId.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Bài tập không thuộc cơ sở của lớp học');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const submissions = await this.repo.findSubmissionsByAssignment(
      assignmentId,
      cls.branchId.toString(),
      query.status
    );
    const counts = await this.repo.countSubmissionsByAssignment(
      assignmentId,
      cls.branchId.toString()
    );

    const data = submissions.map(s => ({
      _id: s._id,
      student: {
        _id: (s.studentId as PopulatedUserSummary)._id ?? s.studentId,
        full_name: (s.studentId as PopulatedUserSummary).fullName ?? null,
        user_code: (s.studentId as PopulatedUserSummary).userCode ?? null,
      },
      status: s.status,
      content_text: s.contentText ?? null,
      attachment_urls: s.attachmentUrls ?? [],
      answers: s.answers ?? [],
      submitted_at: s.submittedAt,
      is_late: s.isLate,
      score: s.score ?? null,
      max_score: s.maxScore ?? assignment.maxScore ?? null,
      feedback: s.feedback ?? null,
      feedback_attachment_urls: s.feedbackAttachmentUrls ?? [],
      resubmit_count: s.resubmitCount ?? 0,
      graded_at: s.gradedAt ?? null,
    }));

    return {
      data,
      meta: counts,
    };
  }
}
