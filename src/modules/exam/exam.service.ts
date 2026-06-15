import { Types } from 'mongoose';
import { ExamRepository } from './exam.repository.js';
import { IExam, IExamQuestion } from '../../models/exam.model.js';
import { IExamAnswer, IExamAttempt, IAnswerResult } from '../../models/examAttempt.model.js';
import { IQuestionBank } from '../../models/questionBank.model.js';
import { ATTEMPT_STATUSES, EXAM_STATUSES, QUESTION_TYPES, ROLES } from '../../shared/constants/roles.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/AllErrors.js';

type IncomingExamQuestion = {
  question_type?: unknown;
  content?: unknown;
  image_url?: unknown;
  options?: Array<{ key?: unknown; content?: unknown }>;
  statements?: Array<{ key?: unknown; content?: unknown; answer?: unknown }>;
  correct_answer?: unknown;
  score?: unknown;
};

type IncomingExamAnswer = {
  question_id?: unknown;
  questionId?: unknown;
  answer?: QuestionAnswerValue;
  is_flagged?: unknown;
  isFlagged?: unknown;
};

type ExamQuestionForStudent = Omit<IExamQuestion, 'correctAnswer'> & {
  correctAnswer?: never;
};

const VALID_EXAM_QUESTION_TYPES = [
  QUESTION_TYPES.MULTIPLE_CHOICE,
  QUESTION_TYPES.TRUE_FALSE,
  QUESTION_TYPES.SHORT_ANSWER,
] as const;

export class ExamService {
  private repo: ExamRepository;

  constructor() {
    this.repo = new ExamRepository();
  }

  private isTeacherOfClass(cls: { teacherId?: Types.ObjectId }, requester: RequestUser) {
    return cls.teacherId?.toString() === requester.id;
  }

  private assertBranchScope(branchId: Types.ObjectId | string, requester: RequestUser) {
    if (requester.role === ROLES.SYSTEM_OWNER) return;
    if (branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Dữ liệu không thuộc cơ sở của bạn');
    }
  }

  private async resolveClassAsTeacher(classId: string, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');
    this.assertBranchScope(cls.branchId, requester);
    if (!this.isTeacherOfClass(cls, requester)) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    return cls;
  }

  private async resolveExamForTeacher(examId: string, requester: RequestUser) {
    const exam = await this.repo.findExamById(examId);
    if (!exam) throw new NotFoundError('Đề thi');
    this.assertBranchScope(exam.branchId, requester);
    if (exam.teacherId.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không phải giáo viên tạo đề thi này');
    }
    return exam;
  }

  private async assertStudentCanAccessExam(exam: IExam, requester: RequestUser) {
    if (requester.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Chỉ học sinh mới được vào làm bài thi');
    }
    this.assertBranchScope(exam.branchId, requester);
    const enrollment = await this.repo.findActiveEnrollment(
      requester.id,
      exam.classId.toString(),
      exam.branchId.toString()
    );
    if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp của đề thi này');
  }

  private parseBoolean(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return fallback;
  }

  private parseNumber(value: unknown, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseDate(value: unknown) {
    if (!value || typeof value !== 'string') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeShortAnswer(value: unknown) {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('vi-VN')
      .replace(/\s+/g, ' ');
  }

  private normalizeQuestionType(value: unknown): (typeof VALID_EXAM_QUESTION_TYPES)[number] {
    const text = this.normalizeText(value);
    if (text === QUESTION_TYPES.FILL_BLANK) return QUESTION_TYPES.SHORT_ANSWER;
    if (text === QUESTION_TYPES.MULTIPLE_CHOICE) return QUESTION_TYPES.MULTIPLE_CHOICE;
    if (text === QUESTION_TYPES.TRUE_FALSE) return QUESTION_TYPES.TRUE_FALSE;
    if (text === QUESTION_TYPES.SHORT_ANSWER) return QUESTION_TYPES.SHORT_ANSWER;
    throw new ValidationError('Đề thi chỉ hỗ trợ 3 dạng: trắc nghiệm, đúng/sai, trả lời ngắn');
  }

  private buildQuestionData(rawQuestions: unknown, requester: RequestUser, cls: { subject?: { name?: string; code?: string } }) {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new ValidationError('Đề thi cần tối thiểu 1 câu hỏi');
    }

    const questionBankItems: Partial<IQuestionBank>[] = [];
    const snapshots: Array<Omit<IExamQuestion, 'questionId'>> = [];

    rawQuestions.forEach((item: IncomingExamQuestion, index) => {
      const questionType = this.normalizeQuestionType(item.question_type);
      const content = this.normalizeText(item.content);
      const score = this.parseNumber(item.score, 1);
      const imageUrl = this.normalizeText(item.image_url);

      if (!content) throw new ValidationError(`Câu ${index + 1} thiếu nội dung`);
      if (score <= 0) throw new ValidationError(`Câu ${index + 1} phải có điểm lớn hơn 0`);

      let options: Array<{ key: string; content: string }> | undefined;
      let correctAnswer = item.correct_answer as QuestionAnswerValue | undefined;

      if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
        options = (item.options ?? [])
          .map(option => ({
            key: this.normalizeText(option.key).toUpperCase(),
            content: this.normalizeText(option.content),
          }))
          .filter(option => option.key && option.content);

        if (options.length !== 4) {
          throw new ValidationError(`Câu ${index + 1} dạng trắc nghiệm cần đúng 4 lựa chọn`);
        }
        correctAnswer = this.normalizeText(correctAnswer).toUpperCase();
        if (!options.some(option => option.key === correctAnswer)) {
          throw new ValidationError(`Câu ${index + 1} chưa chọn đáp án đúng hợp lệ`);
        }
      }

      if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        const statements = (item.statements ?? [])
          .map(statement => ({
            key: this.normalizeText(statement.key).toUpperCase(),
            content: this.normalizeText(statement.content),
            answer: this.parseBoolean(statement.answer),
          }))
          .filter(statement => statement.key && statement.content);

        if (statements.length !== 4) {
          throw new ValidationError(`Câu ${index + 1} dạng đúng/sai cần đúng 4 ý`);
        }

        options = statements.map(statement => ({
          key: statement.key,
          content: statement.content,
        }));
        correctAnswer = statements.reduce<Record<string, boolean>>((acc, statement) => {
          acc[statement.key] = statement.answer;
          return acc;
        }, {});
      }

      if (questionType === QUESTION_TYPES.SHORT_ANSWER) {
        const answers = Array.isArray(correctAnswer)
          ? correctAnswer.map(answer => this.normalizeText(answer)).filter(Boolean)
          : [this.normalizeText(correctAnswer)].filter(Boolean);
        if (answers.length === 0) {
          throw new ValidationError(`Câu ${index + 1} dạng trả lời ngắn cần đáp án mẫu`);
        }
        options = undefined;
        correctAnswer = answers;
      }

      questionBankItems.push({
        createdBy: new Types.ObjectId(requester.id),
        subjectName: cls.subject?.name ?? 'Môn học',
        subjectCode: cls.subject?.code ?? undefined,
        questionType,
        content,
        imageUrl: imageUrl || undefined,
        difficulty: 'medium',
        tags: ['exam', 'thpt'],
        options,
        correctAnswer,
        isActive: true,
        usageCount: 1,
      });

      snapshots.push({
        questionType,
        content,
        imageUrl: imageUrl || undefined,
        options,
        correctAnswer,
        score,
        order: index + 1,
      });
    });

    return { questionBankItems, snapshots };
  }

  private sanitizeQuestionForStudent(question: IExamQuestion): ExamQuestionForStudent {
    const clone = { ...question } as IExamQuestion & { correctAnswer?: unknown };
    delete clone.correctAnswer;
    return clone as ExamQuestionForStudent;
  }

  private isResultPublished(exam: Pick<IExam, 'resultPublishedAt'>) {
    return Boolean(exam.resultPublishedAt);
  }

  private isExamOpen(exam: IExam) {
    const now = new Date();
    if (exam.status !== EXAM_STATUSES.PUBLISHED) return false;
    if (exam.availableFrom && now < new Date(exam.availableFrom)) return false;
    if (exam.availableTo && now > new Date(exam.availableTo)) return false;
    return true;
  }

  private getDraftExpiry(exam: IExam, startedAt = new Date()) {
    const duration = exam.durationMinutes ?? 45;
    return new Date(startedAt.getTime() + duration * 60 * 1000);
  }

  private getRemainingSeconds(attempt: Pick<IExamAttempt, 'draftExpiresAt' | 'status'>) {
    if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS || !attempt.draftExpiresAt) return 0;
    return Math.max(0, Math.floor((new Date(attempt.draftExpiresAt).getTime() - Date.now()) / 1000));
  }

  private async clearExpiredDraft(attempt: IExamAttempt) {
    attempt.status = ATTEMPT_STATUSES.AUTO_SUBMITTED;
    attempt.submittedAt = new Date();
    attempt.timeRemainingSeconds = 0;
    attempt.answers = [];
    attempt.answerResults = [];
    attempt.score = undefined;
    attempt.totalScore = undefined;
    attempt.autoScore = undefined;
    attempt.manualScore = undefined;
    attempt.lastSavedAt = new Date();
    return await attempt.save();
  }

  private isAttemptExpired(attempt: Pick<IExamAttempt, 'draftExpiresAt' | 'status'>) {
    return (
      attempt.status === ATTEMPT_STATUSES.IN_PROGRESS &&
      Boolean(attempt.draftExpiresAt) &&
      new Date(attempt.draftExpiresAt as Date).getTime() <= Date.now()
    );
  }

  private normalizeAnswers(rawAnswers: unknown, exam: IExam): IExamAnswer[] {
    const answers = Array.isArray(rawAnswers) ? (rawAnswers as IncomingExamAnswer[]) : [];
    const questionMap = new Map(exam.questions.map(question => [question.questionId.toString(), question]));

    return answers.reduce<IExamAnswer[]>((normalized, answer) => {
      const questionId = this.normalizeText(answer.question_id ?? answer.questionId);
      const question = questionMap.get(questionId);
      if (!question) return normalized;
      normalized.push({
        questionId: new Types.ObjectId(questionId),
        questionOrder: question.order,
        answer: answer.answer,
        isFlagged: this.parseBoolean(answer.is_flagged ?? answer.isFlagged),
        answeredAt: answer.answer == null || answer.answer === '' ? undefined : new Date(),
      });
      return normalized;
    }, []);
  }

  private gradeAttempt(exam: IExam, answers: IExamAnswer[]) {
    const answerMap = new Map(answers.map(answer => [answer.questionId.toString(), answer]));
    let autoScore = 0;
    const answerResults: IAnswerResult[] = exam.questions.map(question => {
      const submitted = answerMap.get(question.questionId.toString());
      let isCorrect = false;
      let scoreEarned = 0;

      if (question.questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const studentAnswer = this.normalizeText(submitted?.answer).toUpperCase();
        isCorrect = studentAnswer === this.normalizeText(question.correctAnswer).toUpperCase();
        scoreEarned = isCorrect ? question.score : 0;
      }

      if (question.questionType === QUESTION_TYPES.TRUE_FALSE) {
        const correct = (question.correctAnswer ?? {}) as Record<string, boolean>;
        const student = (submitted?.answer ?? {}) as Record<string, boolean>;
        const keys = Object.keys(correct);
        const correctCount = keys.filter(key => student[key] === correct[key]).length;
        scoreEarned = keys.length ? (question.score * correctCount) / keys.length : 0;
        isCorrect = keys.length > 0 && correctCount === keys.length;
      }

      if (question.questionType === QUESTION_TYPES.SHORT_ANSWER) {
        const accepted = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
          : [question.correctAnswer];
        const normalizedStudent = this.normalizeShortAnswer(submitted?.answer);
        isCorrect = accepted.some(answer => this.normalizeShortAnswer(answer) === normalizedStudent);
        scoreEarned = isCorrect ? question.score : 0;
      }

      autoScore += scoreEarned;

      return {
        questionId: question.questionId,
        questionType: question.questionType,
        studentAnswer: submitted?.answer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        scoreEarned: Number(scoreEarned.toFixed(2)),
      };
    });

    const totalScore = exam.questions.reduce((sum, question) => sum + question.score, 0);

    return {
      autoScore: Number(autoScore.toFixed(2)),
      totalScore,
      answerResults,
    };
  }

  private serializeClass(cls: unknown) {
    const record = cls as PopulatedClassSummary | Types.ObjectId | undefined;
    if (!record || record instanceof Types.ObjectId) return null;
    return {
      _id: record._id,
      name: record.name ?? 'Lớp học',
      class_code: record.classCode ?? null,
      class_type: record.classType ?? null,
      subject_name: record.subject?.name ?? null,
      subject_code: record.subject?.code ?? null,
    };
  }

  private serializeExam(exam: IExam, options: { includeAnswers?: boolean; includeQuestions?: boolean } = {}) {
    const questions = options.includeQuestions
      ? exam.questions.map(question =>
          options.includeAnswers ? question : this.sanitizeQuestionForStudent(question)
        )
      : undefined;

    return {
      _id: exam._id,
      branch_id: exam.branchId,
      class_id: (exam.classId as Types.ObjectId | PopulatedClassSummary)?._id ?? exam.classId,
      class: this.serializeClass(exam.classId),
      target_type: exam.targetType,
      teacher_id: exam.teacherId,
      title: exam.title,
      description: exam.description ?? null,
      duration_minutes: exam.durationMinutes ?? 45,
      total_score: exam.totalScore ?? exam.questions.reduce((sum, question) => sum + question.score, 0),
      passing_score: exam.passingScore ?? null,
      available_from: exam.availableFrom ?? null,
      available_to: exam.availableTo ?? null,
      status: exam.status,
      result_published: this.isResultPublished(exam),
      result_published_at: exam.resultPublishedAt ?? null,
      attempt_count: exam.attemptCount ?? 0,
      question_count: exam.questions.length,
      questions,
      created_at: exam.createdAt,
      updated_at: exam.updatedAt ?? null,
    };
  }

  private serializeAttempt(attempt: IExamAttempt, exam: IExam, includeResult: boolean) {
    return {
      _id: attempt._id,
      exam_id: attempt.examId,
      student_id: attempt.studentId,
      class_id: attempt.classId,
      status: attempt.status,
      started_at: attempt.startedAt,
      submitted_at: attempt.submittedAt ?? null,
      draft_expires_at: attempt.draftExpiresAt ?? null,
      time_remaining_seconds: this.getRemainingSeconds(attempt),
      answers: attempt.status === ATTEMPT_STATUSES.IN_PROGRESS ? attempt.answers : [],
      last_saved_at: attempt.lastSavedAt ?? null,
      result_visible: includeResult,
      score: includeResult ? attempt.score ?? null : null,
      total_score: includeResult ? attempt.totalScore ?? null : null,
      auto_score: includeResult ? attempt.autoScore ?? null : null,
      answer_results: includeResult ? attempt.answerResults ?? [] : [],
      exam: this.serializeExam(exam, { includeQuestions: true, includeAnswers: includeResult }),
    };
  }

  async createExam(classId: string, body: AppPayload, requester: RequestUser) {
    const cls = await this.resolveClassAsTeacher(classId, requester);
    const targetType = body.target_type === 'course' ? 'course' : 'class';
    if (targetType === 'course' && cls.classType !== 'course') {
      throw new ValidationError('Chỉ lớp kiểu khóa học mới được tạo đề thi cho khóa học');
    }

    const { questionBankItems, snapshots } = this.buildQuestionData(body.questions, requester, cls);
    const questionDocs = await this.repo.createQuestionBankItems(questionBankItems);
    const questions: IExamQuestion[] = snapshots.map((snapshot, index) => ({
      ...snapshot,
      questionId: questionDocs[index]._id as Types.ObjectId,
    }));
    const totalScore = questions.reduce((sum, question) => sum + question.score, 0);

    const exam = await this.repo.createExam({
      branchId: cls.branchId,
      classId: new Types.ObjectId(classId),
      targetType,
      teacherId: new Types.ObjectId(requester.id),
      title: String(body.title ?? '').trim(),
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      durationMinutes: this.parseNumber(body.duration_minutes, 45),
      totalScore,
      passingScore: body.passing_score == null ? undefined : this.parseNumber(body.passing_score),
      config: {
        shuffleQuestions: this.parseBoolean(body.shuffle_questions),
        shuffleOptions: this.parseBoolean(body.shuffle_options),
        showResultAfter: 'teacher_release',
        allowedAttempts: 1,
      },
      availableFrom: this.parseDate(body.available_from),
      availableTo: this.parseDate(body.available_to),
      questions,
      status: EXAM_STATUSES.DRAFT,
      attemptCount: 0,
    });

    return this.serializeExam(exam, { includeQuestions: true, includeAnswers: true });
  }

  async updateExam(examId: string, body: AppPayload, requester: RequestUser) {
    const exam = await this.resolveExamForTeacher(examId, requester);
    if (exam.status !== EXAM_STATUSES.DRAFT) {
      throw new BadRequestError('Chỉ được sửa đề thi đang ở trạng thái nháp');
    }
    const cls = await this.resolveClassAsTeacher(exam.classId.toString(), requester);
    const { questionBankItems, snapshots } = this.buildQuestionData(body.questions, requester, cls);
    const questionDocs = await this.repo.createQuestionBankItems(questionBankItems);
    const questions: IExamQuestion[] = snapshots.map((snapshot, index) => ({
      ...snapshot,
      questionId: questionDocs[index]._id as Types.ObjectId,
    }));
    const totalScore = questions.reduce((sum, question) => sum + question.score, 0);

    const updated = await this.repo.updateExam(examId, {
      $set: {
        title: String(body.title ?? '').trim(),
        description: typeof body.description === 'string' ? body.description.trim() : null,
        targetType: body.target_type === 'course' ? 'course' : 'class',
        durationMinutes: this.parseNumber(body.duration_minutes, 45),
        totalScore,
        passingScore: body.passing_score == null ? null : this.parseNumber(body.passing_score),
        availableFrom: this.parseDate(body.available_from) ?? null,
        availableTo: this.parseDate(body.available_to) ?? null,
        questions,
      },
    });
    if (!updated) throw new NotFoundError('Đề thi');
    return this.serializeExam(updated, { includeQuestions: true, includeAnswers: true });
  }

  async publishExam(examId: string, requester: RequestUser) {
    const exam = await this.resolveExamForTeacher(examId, requester);
    if (exam.questions.length === 0) throw new BadRequestError('Đề thi chưa có câu hỏi');
    const updated = await this.repo.updateExam(examId, {
      $set: { status: EXAM_STATUSES.PUBLISHED },
    });
    if (!updated) throw new NotFoundError('Đề thi');
    return this.serializeExam(updated, { includeQuestions: true, includeAnswers: true });
  }

  async publishResults(examId: string, requester: RequestUser) {
    await this.resolveExamForTeacher(examId, requester);
    const updated = await this.repo.updateExam(examId, {
      $set: {
        resultPublishedAt: new Date(),
        resultPublishedBy: new Types.ObjectId(requester.id),
      },
    });
    if (!updated) throw new NotFoundError('Đề thi');
    return this.serializeExam(updated, { includeQuestions: true, includeAnswers: true });
  }

  async getTeacherExams(requester: RequestUser) {
    if (requester.role !== ROLES.TEACHER) {
      throw new ForbiddenError('Chỉ giáo viên mới xem danh sách đề thi của mình');
    }
    const exams = await this.repo.findTeacherExams(requester.id, requester.branchId);
    return exams.map(exam => this.serializeExam(exam));
  }

  async getClassExams(classId: string, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');
    this.assertBranchScope(cls.branchId, requester);
    if (requester.role === ROLES.TEACHER && !this.isTeacherOfClass(cls, requester)) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    if (requester.role === ROLES.STUDENT) {
      const enrollment = await this.repo.findActiveEnrollment(requester.id, classId, cls.branchId.toString());
      if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp này');
    }
    const exams = await this.repo.findExamsByClass(classId, cls.branchId.toString());
    return exams.map(exam =>
      this.serializeExam(exam, {
        includeQuestions: requester.role === ROLES.TEACHER,
        includeAnswers: requester.role === ROLES.TEACHER,
      })
    );
  }

  async getStudentExams(requester: RequestUser) {
    if (requester.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Chỉ học sinh mới xem danh sách bài thi của mình');
    }
    const enrollments = await this.repo.findStudentActiveEnrollments(requester.id, requester.branchId);
    const classIds = enrollments.map(enrollment => enrollment.classId as Types.ObjectId);
    if (classIds.length === 0) return [];

    const exams = await this.repo.findClassExams(classIds, requester.branchId ?? '');
    const attempts = await this.repo.findAttemptsByStudentForExams(
      requester.id,
      exams.map(exam => exam._id as Types.ObjectId)
    );
    const attemptMap = new Map(attempts.map(attempt => [attempt.examId.toString(), attempt]));

    return exams.map(exam => {
      const attempt = attemptMap.get(exam._id.toString());
      return {
        ...this.serializeExam(exam),
        is_open: this.isExamOpen(exam),
        my_attempt: attempt
          ? {
              _id: attempt._id,
              status: attempt.status,
              started_at: attempt.startedAt,
              submitted_at: attempt.submittedAt ?? null,
              result_visible: this.isResultPublished(exam),
              score: this.isResultPublished(exam) ? attempt.score ?? null : null,
              total_score: this.isResultPublished(exam) ? attempt.totalScore ?? null : null,
            }
          : null,
      };
    });
  }

  async getExamDetail(examId: string, requester: RequestUser) {
    const exam = await this.repo.findExamByIdWithClass(examId);
    if (!exam) throw new NotFoundError('Đề thi');
    this.assertBranchScope(exam.branchId, requester);

    if (requester.role === ROLES.TEACHER) {
      if (exam.teacherId.toString() !== requester.id) {
        throw new ForbiddenError('Bạn không phải giáo viên tạo đề thi này');
      }
      return this.serializeExam(exam, { includeQuestions: true, includeAnswers: true });
    }

    if (requester.role === ROLES.STUDENT) {
      await this.assertStudentCanAccessExam(exam, requester);
      return this.serializeExam(exam, { includeQuestions: false });
    }

    throw new ForbiddenError('Không có quyền xem đề thi');
  }

  async startAttempt(examId: string, requester: RequestUser, reqInfo: { ip?: string; userAgent?: string }) {
    const exam = await this.repo.findExamById(examId);
    if (!exam) throw new NotFoundError('Đề thi');
    await this.assertStudentCanAccessExam(exam, requester);
    if (!this.isExamOpen(exam)) throw new BadRequestError('Đề thi chưa mở hoặc đã đóng');

    const existingDoc = await this.repo.findAttemptDocByExamStudent(examId, requester.id);
    if (existingDoc) {
      if (this.isAttemptExpired(existingDoc)) await this.clearExpiredDraft(existingDoc);
      if (existingDoc.status === ATTEMPT_STATUSES.IN_PROGRESS) {
        return this.serializeAttempt(existingDoc, exam, false);
      }
      throw new ConflictError('Bạn đã hoàn tất lượt làm bài của đề thi này');
    }

    const startedAt = new Date();
    const attempt = await this.repo.createAttempt({
      branchId: exam.branchId,
      examId: exam._id as Types.ObjectId,
      studentId: new Types.ObjectId(requester.id),
      classId: exam.classId,
      status: ATTEMPT_STATUSES.IN_PROGRESS,
      startedAt,
      draftExpiresAt: this.getDraftExpiry(exam, startedAt),
      timeRemainingSeconds: (exam.durationMinutes ?? 45) * 60,
      answers: [],
      answerResults: [],
      essayGrades: [],
      ipAddress: reqInfo.ip,
      userAgent: reqInfo.userAgent,
      tabSwitchCount: 0,
    });
    await this.repo.incrementAttemptCount(examId);
    return this.serializeAttempt(attempt, exam, false);
  }

  async getAttempt(attemptId: string, requester: RequestUser) {
    const attempt = await this.repo.findAttemptDocById(attemptId);
    if (!attempt) throw new NotFoundError('Bài làm');
    if (attempt.studentId.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không có quyền xem bài làm này');
    }
    const exam = await this.repo.findExamById(attempt.examId.toString());
    if (!exam) throw new NotFoundError('Đề thi');
    if (this.isAttemptExpired(attempt)) await this.clearExpiredDraft(attempt);
    return this.serializeAttempt(attempt, exam, this.isResultPublished(exam));
  }

  async saveDraft(attemptId: string, body: AppPayload, requester: RequestUser) {
    const attempt = await this.repo.findAttemptDocById(attemptId);
    if (!attempt) throw new NotFoundError('Bài làm');
    if (attempt.studentId.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không có quyền lưu bài làm này');
    }
    const exam = await this.repo.findExamById(attempt.examId.toString());
    if (!exam) throw new NotFoundError('Đề thi');

    if (this.isAttemptExpired(attempt)) {
      await this.clearExpiredDraft(attempt);
      return this.serializeAttempt(attempt, exam, false);
    }
    if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS) {
      throw new BadRequestError('Bài làm không còn ở trạng thái nháp');
    }

    attempt.answers = this.normalizeAnswers(body.answers, exam);
    attempt.lastSavedAt = new Date();
    attempt.timeRemainingSeconds = this.getRemainingSeconds(attempt);
    attempt.tabSwitchCount = this.parseNumber(body.tab_switch_count, attempt.tabSwitchCount);
    await attempt.save();
    return this.serializeAttempt(attempt, exam, false);
  }

  async submitAttempt(attemptId: string, body: AppPayload, requester: RequestUser) {
    const attempt = await this.repo.findAttemptDocById(attemptId);
    if (!attempt) throw new NotFoundError('Bài làm');
    if (attempt.studentId.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không có quyền nộp bài làm này');
    }
    const exam = await this.repo.findExamById(attempt.examId.toString());
    if (!exam) throw new NotFoundError('Đề thi');

    if (this.isAttemptExpired(attempt)) {
      await this.clearExpiredDraft(attempt);
      throw new BadRequestError('Đã hết thời gian làm bài. Dữ liệu nháp đã được xóa');
    }
    if (attempt.status !== ATTEMPT_STATUSES.IN_PROGRESS) {
      throw new BadRequestError('Bài làm đã được nộp trước đó');
    }

    const answers = Array.isArray(body.answers) ? this.normalizeAnswers(body.answers, exam) : attempt.answers;
    const grading = this.gradeAttempt(exam, answers);

    attempt.answers = answers;
    attempt.status = ATTEMPT_STATUSES.GRADED;
    attempt.submittedAt = new Date();
    attempt.timeRemainingSeconds = 0;
    attempt.lastSavedAt = new Date();
    attempt.score = grading.autoScore;
    attempt.totalScore = grading.totalScore;
    attempt.autoScore = grading.autoScore;
    attempt.manualScore = 0;
    attempt.answerResults = grading.answerResults;
    attempt.gradedAt = new Date();
    await attempt.save();

    return this.serializeAttempt(attempt, exam, this.isResultPublished(exam));
  }

  async getResult(attemptId: string, requester: RequestUser) {
    const attempt = await this.repo.findAttemptDocById(attemptId);
    if (!attempt) throw new NotFoundError('Bài làm');
    if (attempt.studentId.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không có quyền xem kết quả này');
    }
    const exam = await this.repo.findExamById(attempt.examId.toString());
    if (!exam) throw new NotFoundError('Đề thi');
    if (!this.isResultPublished(exam)) {
      throw new ForbiddenError('Giáo viên chưa công bố kết quả bài thi');
    }
    return this.serializeAttempt(attempt, exam, true);
  }

  async getExamAttempts(examId: string, requester: RequestUser) {
    const exam = await this.resolveExamForTeacher(examId, requester);
    const attempts = await this.repo.findAttemptsByExam(examId, exam.branchId.toString());
    return attempts.map(attempt => {
      const student = attempt.studentId as PopulatedUserSummary;
      return {
        _id: attempt._id,
        student: {
          _id: student?._id ?? attempt.studentId,
          full_name: student?.fullName ?? null,
          user_code: student?.userCode ?? null,
          email: student?.email ?? null,
        },
        status: attempt.status,
        started_at: attempt.startedAt,
        submitted_at: attempt.submittedAt ?? null,
        score: attempt.score ?? null,
        total_score: attempt.totalScore ?? null,
        tab_switch_count: attempt.tabSwitchCount ?? 0,
      };
    });
  }
}
