// ============================================================
// LCMS — MongoDB Setup Script v3.0 (camelCase Version)
// Chạy trong MongoDB Compass > Open MongoDB Shell
// Hoặc dùng: mongosh "connection_string" --file lcms-mongo-setup-v3.js
// ============================================================

use("lcms");

(async () => {

// ════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════
async function setupCollection(name, validator, indexes) {
  const exists = db.getCollectionNames().includes(name);
  if (exists) {
    await db.runCommand({
      collMod: name,
      validator: { $jsonSchema: validator },
      validationLevel: "moderate",
      validationAction: "warn"
    });
    print(`✅ [${name}] đã tồn tại — cập nhật validator`);
  } else {
    await db.createCollection(name, {
      validator: { $jsonSchema: validator },
      validationLevel: "moderate",
      validationAction: "warn"
    });
    print(`✅ [${name}] đã tạo collection`);
  }
  for (const idx of indexes) {
    await db[name].createIndex(idx.key, idx.options);
  }
  print(`   ↳ ${indexes.length} index(es)`);
}

print("\n🚀 Bắt đầu tạo LCMS database v3.0 (camelCase)...\n");


// ════════════════════════════════════════════════════════════
// 1. COLLECTION: branches
// ════════════════════════════════════════════════════════════
await setupCollection(
  "branches",
  {
    bsonType: "object",
    required: ["branchCode", "name", "isActive", "createdAt"],
    properties: {
      schemaVersion:        { bsonType: "int" },
      branchCode:           { bsonType: "string" },
      name:                 { bsonType: "string" },
      address:              { bsonType: ["string", "null"] },
      phone:                { bsonType: ["string", "null"] },
      email:                { bsonType: ["string", "null"] },
      logoUrl:              { bsonType: ["string", "null"] },
      ownerId:              { bsonType: ["objectId", "null"] },
      timezone:             { bsonType: "string" },
      defaultFeePerSession: { bsonType: ["int", "double", "null"] },
      defaultSessionSlots:  { bsonType: "array" },
      rooms:                { bsonType: "array" },
      isActive:             { bsonType: "bool" },
      createdAt:            { bsonType: "date" },
      updatedAt:            { bsonType: ["date", "null"] },
      deletedAt:            { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { branchCode: 1 }, options: { unique: true, name: "idx_branches_code" } },
    { key: { isActive: 1 },   options: { name: "idx_branches_active" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 2. COLLECTION: users
// ════════════════════════════════════════════════════════════
await setupCollection(
  "users",
  {
    bsonType: "object",
    required: ["role", "fullName", "email", "passwordHash", "isActive", "createdAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      userCode:      { bsonType: "string" },

      email:         { bsonType: "string" },
      phone:         { bsonType: ["string", "null"] },
      passwordHash:  { bsonType: "string" },

      role: {
        bsonType: "string",
        enum: ["system_owner", "branch_owner", "staff", "teacher", "student", "parent"]
      },

      branchId: { bsonType: ["objectId", "null"] },

      fullName:    { bsonType: "string" },
      dateOfBirth: { bsonType: ["date", "null"] },
      gender:      { bsonType: ["string", "null"], enum: ["male", "female", "other", null] },
      avatarUrl:   { bsonType: ["string", "null"] },

      studentInfo: {
        bsonType: ["object", "null"],
        properties: {
          activeClassIds: { bsonType: "array" },
          enrollmentDate: { bsonType: ["date", "null"] },
          parentIds:      { bsonType: "array" },
          schoolName:     { bsonType: ["string", "null"] },
          grade:          { bsonType: ["int", "null"] }
        }
      },

      parentInfo: {
        bsonType: ["object", "null"],
        properties: {
          studentIds:   { bsonType: "array" },
          relationship: {
            bsonType: ["string", "null"],
            enum: ["father", "mother", "guardian", "other", null]
          }
        }
      },

      teacherInfo: {
        bsonType: ["object", "null"],
        properties: {
          subjects:       { bsonType: "array" },
          joinDate:       { bsonType: ["date", "null"] },
          activeClassIds: { bsonType: "array" }
        }
      },

      isActive:    { bsonType: "bool" },
      lastLoginAt: { bsonType: ["date", "null"] },

      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: ["date", "null"] },
      createdBy: { bsonType: ["objectId", "null"] },
      deletedAt: { bsonType: ["date", "null"] },
      deletedBy: { bsonType: ["objectId", "null"] }
    }
  },
  [
    { key: { email: 1 }, options: { unique: true, sparse: true, name: "idx_users_email" } },
    { key: { phone: 1 }, options: { sparse: true, name: "idx_users_phone" } },
    { key: { userCode: 1 }, options: { unique: true, sparse: true, name: "idx_users_code" } },
    { key: { branchId: 1, role: 1 }, options: { name: "idx_users_branch_role" } },
    { key: { branchId: 1, role: 1, "studentInfo.activeClassIds": 1 }, options: { name: "idx_users_student_active_classes" } },
    { key: { branchId: 1, role: 1, "teacherInfo.activeClassIds": 1 }, options: { name: "idx_users_teacher_active_classes" } },
    { key: { "parentInfo.studentIds": 1 }, options: { sparse: true, name: "idx_users_parent_students" } },
    { key: { fullName: "text" }, options: { name: "idx_users_fullname_text" } },
    { key: { deletedAt: 1 }, options: { sparse: true, name: "idx_users_deleted" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 3. COLLECTION: refresh_tokens
// ════════════════════════════════════════════════════════════
await setupCollection(
  "refresh_tokens",
  {
    bsonType: "object",
    required: ["userId", "tokenHash", "expiresAt", "createdAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      userId:        { bsonType: "objectId" },
      branchId:      { bsonType: ["objectId", "null"] },
      tokenHash:     { bsonType: "string" },
      deviceInfo:    { bsonType: ["string", "null"] },
      ipAddress:     { bsonType: ["string", "null"] },
      expiresAt:     { bsonType: "date" },
      revokedAt:     { bsonType: ["date", "null"] },
      revokedReason: {
        bsonType: ["string", "null"],
        enum: ["logout", "password_changed", "admin_revoke", "rotated", null]
      },
      createdAt: { bsonType: "date" }
    }
  },
  [
    { key: { tokenHash: 1 }, options: { unique: true, name: "idx_rtokens_hash" } },
    { key: { userId: 1, revokedAt: 1 }, options: { name: "idx_rtokens_user_active" } },
    { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "idx_rtokens_ttl" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 4. COLLECTION: classes
// ════════════════════════════════════════════════════════════
await setupCollection(
  "classes",
  {
    bsonType: "object",
    required: ["branchId", "subject", "name", "classType", "status", "createdAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: "objectId" },

      subject: {
        bsonType: "object",
        required: ["name"],
        properties: {
          name:  { bsonType: "string" },
          code:  { bsonType: ["string", "null"] },
          color: { bsonType: ["string", "null"] },
          icon:  { bsonType: ["string", "null"] }
        }
      },

      name:        { bsonType: "string" },
      classCode:   { bsonType: ["string", "null"] },
      description: { bsonType: ["string", "null"] },

      teacherId: { bsonType: ["objectId", "null"] },
      teacherSnapshot: { bsonType: ["object", "null"] },
      coTeacherIds:    { bsonType: "array" },

      classType: { bsonType: "string", enum: ["course", "ongoing"] },
      courseInfo:  { bsonType: ["object", "null"] },
      ongoingInfo: { bsonType: ["object", "null"] },

      weeklySchedule: { bsonType: "array" },

      maxStudents:  { bsonType: ["int", "null"] },
      studentCount: { bsonType: "int" },

      status: { bsonType: "string", enum: ["active", "completed", "cancelled", "upcoming"] },

      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: ["date", "null"] },
      createdBy: { bsonType: ["objectId", "null"] },
      deletedAt: { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { branchId: 1, status: 1 }, options: { name: "idx_classes_branch_status" } },
    { key: { branchId: 1, classCode: 1 }, options: { unique: true, sparse: true, name: "idx_classes_branch_code" } },
    { key: { teacherId: 1, status: 1 }, options: { name: "idx_classes_teacher" } },
    { key: { "subject.code": 1, branchId: 1 }, options: { name: "idx_classes_subject_code" } },
    { key: { "subject.name": 1 }, options: { name: "idx_classes_subject_name" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 5. COLLECTION: class_sessions
// ════════════════════════════════════════════════════════════
await setupCollection(
  "class_sessions",
  {
    bsonType: "object",
    required: ["branchId", "classId", "sessionDate", "status", "createdAt"],
    properties: {
      schemaVersion:    { bsonType: "int" },
      branchId:         { bsonType: "objectId" },
      classId:          { bsonType: "objectId" },
      teacherId:        { bsonType: ["objectId", "null"] },
      sessionDate:      { bsonType: "date" },
      startTime:        { bsonType: ["string", "null"] },
      endTime:          { bsonType: ["string", "null"] },
      roomCode:         { bsonType: ["string", "null"] },
      sessionType:      { bsonType: "string", enum: ["regular", "extra", "makeup", "cancelled"] },
      status:           { bsonType: "string", enum: ["scheduled", "completed", "cancelled"] },
      note:             { bsonType: ["string", "null"] },
      attendanceStatus: { bsonType: "string", enum: ["pending", "submitted"] },
      materials:        { bsonType: "array" },
      onlineMeetingUrl: { bsonType: ["string", "null"] },
      createdAt:        { bsonType: "date" },
      updatedAt:        { bsonType: ["date", "null"] },
      deletedAt:        { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { classId: 1, sessionDate: 1 }, options: { unique: true, name: "idx_sessions_class_date_unique" } },
    { key: { teacherId: 1, sessionDate: 1, status: 1 }, options: { name: "idx_sessions_teacher_date" } },
    { key: { classId: 1, sessionDate: 1, status: 1 }, options: { name: "idx_sessions_class_date_status" } },
    { key: { branchId: 1, sessionDate: 1 }, options: { name: "idx_sessions_branch_date" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 6. COLLECTION: enrollments
// ════════════════════════════════════════════════════════════
await setupCollection(
  "enrollments",
  {
    bsonType: "object",
    required: ["branchId", "studentId", "classId", "enrolledAt", "createdAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: "objectId" },
      studentId:     { bsonType: "objectId" },
      classId:       { bsonType: "objectId" },
      classSnapshot: { bsonType: ["object", "null"] },
      enrolledAt:    { bsonType: "date" },
      leftAt:        { bsonType: ["date", "null"] },
      leftReason:    { bsonType: ["string", "null"], enum: ["completed", "dropped", null] },
      enrolledBy:    { bsonType: ["objectId", "null"] },
      createdAt:     { bsonType: "date" },
      updatedAt:     { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { studentId: 1, enrolledAt: -1 }, options: { name: "idx_enrollments_student_date" } },
    { key: { studentId: 1, leftAt: 1 }, options: { name: "idx_enrollments_student_active" } },
    { key: { classId: 1, leftAt: 1 }, options: { name: "idx_enrollments_class_active" } },
    { key: { studentId: 1, classId: 1 }, options: { unique: true, partialFilterExpression: { leftAt: null }, name: "idx_enrollments_student_class_active_unique" } },
    { key: { branchId: 1, studentId: 1 }, options: { name: "idx_enrollments_branch_student" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 7. COLLECTION: attendances
// ════════════════════════════════════════════════════════════
await setupCollection(
  "attendances",
  {
    bsonType: "object",
    required: ["branchId", "sessionId", "studentId", "status", "sessionDate", "createdAt"],
    properties: {
      schemaVersion:   { bsonType: "int" },
      branchId:        { bsonType: "objectId" },
      sessionId:       { bsonType: "objectId" },
      classId:         { bsonType: "objectId" },
      studentId:       { bsonType: "objectId" },
      teacherId:       { bsonType: ["objectId", "null"] },
      status:          { bsonType: "string", enum: ["present", "absent"] },
      sessionDate:     { bsonType: "date" },
      markedAt:        { bsonType: ["date", "null"] },
      absenceNotified: { bsonType: "bool" },
      editHistory:     { bsonType: "array" },
      createdAt:       { bsonType: "date" },
      updatedAt:       { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { sessionId: 1, studentId: 1 }, options: { unique: true, name: "idx_attend_session_student" } },
    { key: { studentId: 1, classId: 1, sessionDate: 1 }, options: { name: "idx_attend_student_class_date" } },
    { key: { absenceNotified: 1, status: 1 }, options: { partialFilterExpression: { status: "absent", absenceNotified: false }, name: "idx_attend_absent_unnotified" } },
    { key: { branchId: 1, sessionDate: 1 }, options: { name: "idx_attend_branch_date" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 8. COLLECTION: assignments
// ════════════════════════════════════════════════════════════
await setupCollection(
  "assignments",
  {
    bsonType: "object",
    required: ["branchId", "classId", "teacherId", "title", "status", "createdAt"],
    properties: {
      schemaVersion:    { bsonType: "int" },
      branchId:         { bsonType: "objectId" },
      classId:          { bsonType: "objectId" },
      teacherId:        { bsonType: "objectId" },
      sessionId:        { bsonType: ["objectId", "null"] },
      title:            { bsonType: "string" },
      description:      { bsonType: ["string", "null"] },
      attachmentUrls:   { bsonType: "array" },
      assignmentType:   { bsonType: "string", enum: ["homework", "practice", "project"] },
      dueDate:          { bsonType: ["date", "null"] },
      maxScore:         { bsonType: ["int", "double", "null"] },
      isGraded:         { bsonType: "bool" },
      visibleToParent:  { bsonType: "bool" },
      submissionConfig: { bsonType: ["object", "null"] },
      status:           { bsonType: "string", enum: ["active", "closed", "draft"] },
      submissionCount:  { bsonType: "int" },
      gradedCount:      { bsonType: "int" },
      createdAt:        { bsonType: "date" },
      updatedAt:        { bsonType: ["date", "null"] },
      deletedAt:        { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { classId: 1, dueDate: -1, status: 1 }, options: { name: "idx_assignments_class_due" } },
    { key: { teacherId: 1, status: 1 }, options: { name: "idx_assignments_teacher" } },
    { key: { branchId: 1, status: 1 }, options: { name: "idx_assignments_branch_status" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 9. COLLECTION: submissions
// ════════════════════════════════════════════════════════════
await setupCollection(
  "submissions",
  {
    bsonType: "object",
    required: ["branchId", "assignmentId", "studentId", "status", "createdAt"],
    properties: {
      schemaVersion:     { bsonType: "int" },
      branchId:          { bsonType: "objectId" },
      assignmentId:      { bsonType: "objectId" },
      studentId:         { bsonType: "objectId" },
      classId:           { bsonType: "objectId" },
      contentText:       { bsonType: ["string", "null"] },
      attachmentUrls:    { bsonType: "array" },
      submittedAt:       { bsonType: ["date", "null"] },
      isLate:            { bsonType: "bool" },
      resubmitCount:     { bsonType: "int" },
      status:            { bsonType: "string", enum: ["draft", "submitted", "graded", "revision_requested"] },
      score:             { bsonType: ["int", "double", "null"] },
      maxScore:          { bsonType: ["int", "double", "null"] },
      feedback:          { bsonType: ["string", "null"] },
      gradedAt:          { bsonType: ["date", "null"] },
      gradedBy:          { bsonType: ["objectId", "null"] },
      revisionRequested: { bsonType: "bool" },
      revisionNote:      { bsonType: ["string", "null"] },
      createdAt:         { bsonType: "date" },
      updatedAt:         { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { assignmentId: 1, studentId: 1 }, options: { unique: true, name: "idx_submissions_assign_student" } },
    { key: { assignmentId: 1, status: 1, submittedAt: 1 }, options: { name: "idx_submissions_assign_status" } },
    { key: { studentId: 1, classId: 1 }, options: { name: "idx_submissions_student_class" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 10. COLLECTION: question_bank
// ════════════════════════════════════════════════════════════
await setupCollection(
  "question_bank",
  {
    bsonType: "object",
    required: ["createdBy", "subjectName", "questionType", "content", "difficulty", "createdAt"],
    properties: {
      schemaVersion:   { bsonType: "int" },
      createdBy:       { bsonType: "objectId" },
      subjectName:     { bsonType: "string" },
      subjectCode:     { bsonType: ["string", "null"] },
      questionType:    { bsonType: "string", enum: ["multiple_choice", "essay", "fill_blank", "true_false"] },
      content:         { bsonType: "string" },
      imageUrl:        { bsonType: ["string", "null"] },
      difficulty:      { bsonType: "string", enum: ["easy", "medium", "hard"] },
      tags:            { bsonType: "array" },
      chapter:         { bsonType: ["string", "null"] },
      options:         { bsonType: ["array", "null"] },
      correctAnswer:   {},
      answerTolerance: { bsonType: ["string", "null"] },
      gradingGuide:    { bsonType: ["string", "null"] },
      isReported:      { bsonType: "bool" },
      reportNote:      { bsonType: ["string", "null"] },
      isActive:        { bsonType: "bool" },
      usageCount:      { bsonType: "int" },
      createdAt:       { bsonType: "date" },
      updatedAt:       { bsonType: ["date", "null"] },
      deletedAt:       { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { subjectCode: 1, questionType: 1, difficulty: 1, isActive: 1 }, options: { name: "idx_qbank_filter" } },
    { key: { subjectName: 1, isActive: 1 }, options: { name: "idx_qbank_subject_name" } },
    { key: { tags: 1 }, options: { name: "idx_qbank_tags" } },
    { key: { createdBy: 1 }, options: { name: "idx_qbank_creator" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 11. COLLECTION: exams
// ════════════════════════════════════════════════════════════
await setupCollection(
  "exams",
  {
    bsonType: "object",
    required: ["branchId", "classId", "teacherId", "title", "status", "createdAt"],
    properties: {
      schemaVersion:   { bsonType: "int" },
      branchId:        { bsonType: "objectId" },
      classId:         { bsonType: "objectId" },
      teacherId:       { bsonType: "objectId" },
      title:           { bsonType: "string" },
      description:     { bsonType: ["string", "null"] },
      durationMinutes: { bsonType: ["int", "null"] },
      totalScore:      { bsonType: ["int", "double", "null"] },
      passingScore:    { bsonType: ["int", "double", "null"] },
      config:          { bsonType: ["object", "null"] },
      availableFrom:   { bsonType: ["date", "null"] },
      availableTo:     { bsonType: ["date", "null"] },
      questions:       { bsonType: "array" },
      status:          { bsonType: "string", enum: ["draft", "published", "closed"] },
      attemptCount:    { bsonType: "int" },
      createdAt:       { bsonType: "date" },
      updatedAt:       { bsonType: ["date", "null"] },
      deletedAt:       { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { classId: 1, status: 1, availableFrom: -1 }, options: { name: "idx_exams_class_status" } },
    { key: { branchId: 1, status: 1 }, options: { name: "idx_exams_branch_status" } },
    { key: { teacherId: 1, status: 1 }, options: { name: "idx_exams_teacher" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 12. COLLECTION: exam_attempts
// ════════════════════════════════════════════════════════════
await setupCollection(
  "exam_attempts",
  {
    bsonType: "object",
    required: ["branchId", "examId", "studentId", "status", "startedAt", "createdAt"],
    properties: {
      schemaVersion:        { bsonType: "int" },
      branchId:             { bsonType: "objectId" },
      examId:               { bsonType: "objectId" },
      studentId:            { bsonType: "objectId" },
      classId:              { bsonType: "objectId" },
      status:               { bsonType: "string", enum: ["in_progress", "submitted", "auto_submitted", "graded"] },
      startedAt:            { bsonType: "date" },
      submittedAt:          { bsonType: ["date", "null"] },
      timeRemainingSeconds: { bsonType: ["int", "null"] },
      answers:              { bsonType: "array" },
      lastSavedAt:          { bsonType: ["date", "null"] },
      score:                { bsonType: ["int", "double", "null"] },
      totalScore:           { bsonType: ["int", "double", "null"] },
      autoScore:            { bsonType: ["int", "double", "null"] },
      manualScore:          { bsonType: ["int", "double", "null"] },
      gradedAt:             { bsonType: ["date", "null"] },
      gradedBy:             { bsonType: ["objectId", "null"] },
      answerResults:        { bsonType: "array" },
      essayGrades:          { bsonType: "array" },
      ipAddress:            { bsonType: ["string", "null"] },
      userAgent:            { bsonType: ["string", "null"] },
      tabSwitchCount:       { bsonType: "int" },
      createdAt:            { bsonType: "date" },
      updatedAt:            { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { examId: 1, studentId: 1 }, options: { unique: true, name: "idx_attempts_exam_student" } },
    { key: { studentId: 1, status: 1 }, options: { name: "idx_attempts_student_status" } },
    { key: { examId: 1, status: 1 }, options: { name: "idx_attempts_exam_status" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 13. COLLECTION: invoices
// ════════════════════════════════════════════════════════════
await setupCollection(
  "invoices",
  {
    bsonType: "object",
    required: ["branchId", "studentId", "classId", "invoiceCode", "totalAmount", "status", "createdAt"],
    properties: {
      schemaVersion:       { bsonType: "int" },
      branchId:            { bsonType: "objectId" },
      studentId:           { bsonType: "objectId" },
      classId:             { bsonType: "objectId" },
      studentSnapshot:     { bsonType: ["object", "null"] },
      classSnapshot:       { bsonType: ["object", "null"] },
      invoiceCode:         { bsonType: "string" },
      invoiceType:         { bsonType: "string", enum: ["monthly", "course"] },
      billingPeriod:       { bsonType: ["string", "null"] },
      sessionsAttended:    { bsonType: ["int", "null"] },
      sessionsTotal:       { bsonType: ["int", "null"] },
      feePerSession:       { bsonType: ["int", "double", "null"] },
      courseFee:           { bsonType: ["int", "double", "null"] },
      subtotal:            { bsonType: ["int", "double"] },
      discountAmount:      { bsonType: ["int", "double"] },
      discountNote:        { bsonType: ["string", "null"] },
      excusedSessions:     { bsonType: "int" },
      totalAmount:         { bsonType: ["int", "double"] },
      dueDate:             { bsonType: ["date", "null"] },
      status:              { bsonType: "string", enum: ["unpaid", "paid", "overdue", "cancelled", "partial"] },
      paymentMethod:       { bsonType: ["string", "null"] },
      paidAt:              { bsonType: ["date", "null"] },
      paidAmount:          { bsonType: ["int", "double", "null"] },
      confirmedBy:         { bsonType: ["objectId", "null"] },
      paymentIds:          { bsonType: "array" },
      vnpayTransactionRef: { bsonType: ["string", "null"] },
      vnpayTransactionId:  { bsonType: ["string", "null"] },
      generationType:      { bsonType: "string", enum: ["auto", "manual"] },
      note:                { bsonType: ["string", "null"] },
      createdBy:           { bsonType: ["objectId", "null"] },
      createdAt:           { bsonType: "date" },
      updatedAt:           { bsonType: ["date", "null"] },
      deletedAt:           { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { invoiceCode: 1 }, options: { unique: true, name: "idx_invoices_code" } },
    { key: { branchId: 1, status: 1, dueDate: 1 }, options: { name: "idx_invoices_branch_status_due" } },
    { key: { branchId: 1, billingPeriod: 1, status: 1 }, options: { name: "idx_invoices_branch_period_status" } },
    { key: { vnpayTransactionRef: 1 }, options: { unique: true, sparse: true, name: "idx_invoices_vnpay_ref" } },
    { key: { studentId: 1, billingPeriod: 1 }, options: { name: "idx_invoices_student_period" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 14. COLLECTION: payments
// ════════════════════════════════════════════════════════════
await setupCollection(
  "payments",
  {
    bsonType: "object",
    required: ["branchId", "invoiceId", "paymentMethod", "amount", "status", "createdAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: "objectId" },
      invoiceId:     { bsonType: "objectId" },
      studentId:     { bsonType: "objectId" },
      paymentMethod: { bsonType: "string", enum: ["cash", "vnpay"] },
      amount:        { bsonType: ["int", "double"] },
      status:        { bsonType: "string", enum: ["pending", "success", "failed", "refunded"] },
      receivedBy:    { bsonType: ["objectId", "null"] },
      receivedAt:    { bsonType: ["date", "null"] },
      vnpayRef:      { bsonType: ["string", "null"] },
      vnpayData:     { bsonType: ["object", "null"] },
      createdAt:     { bsonType: "date" }
    }
  },
  [
    { key: { invoiceId: 1 }, options: { name: "idx_payments_invoice" } },
    { key: { branchId: 1, createdAt: -1, status: 1 }, options: { name: "idx_payments_branch_date" } },
    { key: { studentId: 1 }, options: { name: "idx_payments_student" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 15. COLLECTION: grade_records
// ════════════════════════════════════════════════════════════
await setupCollection(
  "grade_records",
  {
    bsonType: "object",
    required: ["branchId", "studentId", "classId", "academicPeriod", "status", "createdAt"],
    properties: {
      schemaVersion:    { bsonType: "int" },
      branchId:         { bsonType: "objectId" },
      studentId:        { bsonType: "objectId" },
      classId:          { bsonType: "objectId" },
      academicPeriod:   { bsonType: "string" },
      studentSnapshot:  { bsonType: ["object", "null"] },
      classSnapshot:    { bsonType: ["object", "null"] },
      assignmentAvg:    { bsonType: ["int", "double", "null"] },
      examScores:       { bsonType: "array" },
      finalScore:       { bsonType: ["int", "double", "null"] },
      gradeLetter:      { bsonType: ["string", "null"] },
      attendanceRate:   { bsonType: ["int", "double", "null"] },
      sessionsAttended: { bsonType: ["int", "null"] },
      sessionsTotal:    { bsonType: ["int", "null"] },
      teacherComment:   { bsonType: ["string", "null"] },
      status:           { bsonType: "string", enum: ["draft", "published"] },
      publishedAt:      { bsonType: ["date", "null"] },
      createdBy:        { bsonType: ["objectId", "null"] },
      createdAt:        { bsonType: "date" },
      updatedAt:        { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { studentId: 1, classId: 1, academicPeriod: 1 }, options: { unique: true, name: "idx_grades_student_class_period" } },
    { key: { classId: 1, academicPeriod: 1, status: 1 }, options: { name: "idx_grades_class_period" } },
    { key: { branchId: 1, academicPeriod: 1 }, options: { name: "idx_grades_branch_period" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 16. COLLECTION: notifications
// ════════════════════════════════════════════════════════════
await setupCollection(
  "notifications",
  {
    bsonType: "object",
    required: ["recipientId", "type", "title", "isRead", "createdAt", "expiresAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: ["objectId", "null"] },
      recipientId:   { bsonType: "objectId" },
      type:          { bsonType: "string", enum: ["absence", "invoice_due", "score_published", "assignment_due", "class_announcement", "system"] },
      title:         { bsonType: "string" },
      content:       { bsonType: ["string", "null"] },
      actionUrl:     { bsonType: ["string", "null"] },
      channels:      { bsonType: "array" },
      metadata:      { bsonType: ["object", "null"] },
      isRead:        { bsonType: "bool" },
      readAt:        { bsonType: ["date", "null"] },
      emailSent:     { bsonType: "bool" },
      emailSentAt:   { bsonType: ["date", "null"] },
      createdAt:     { bsonType: "date" },
      expiresAt:     { bsonType: "date" }
    }
  },
  [
    { key: { recipientId: 1, isRead: 1, createdAt: -1 }, options: { name: "idx_notif_user_unread" } },
    { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "idx_notif_ttl" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 17. COLLECTION: messages
// ════════════════════════════════════════════════════════════
await setupCollection(
  "messages",
  {
    bsonType: "object",
    required: ["branchId", "threadId", "senderId", "receiverId", "messageType", "sentAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: "objectId" },
      threadId:      { bsonType: "string" },
      senderId:      { bsonType: "objectId" },
      receiverId:    { bsonType: "objectId" },
      messageType:   { bsonType: "string", enum: ["text", "file", "image"] },
      content:       { bsonType: ["string", "null"] },
      attachmentUrl: { bsonType: ["string", "null"] },
      isRead:        { bsonType: "bool" },
      readAt:        { bsonType: ["date", "null"] },
      sentAt:        { bsonType: "date" },
      deletedAt:     { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { threadId: 1, sentAt: 1 }, options: { name: "idx_messages_thread" } },
    { key: { receiverId: 1, isRead: 1, sentAt: -1 }, options: { name: "idx_messages_unread" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 18. COLLECTION: class_announcements
// ════════════════════════════════════════════════════════════
await setupCollection(
  "class_announcements",
  {
    bsonType: "object",
    required: ["branchId", "classId", "authorId", "title", "createdAt"],
    properties: {
      schemaVersion:      { bsonType: "int" },
      branchId:           { bsonType: "objectId" },
      classId:            { bsonType: "objectId" },
      authorId:           { bsonType: "objectId" },
      title:              { bsonType: "string" },
      content:            { bsonType: ["string", "null"] },
      attachmentUrls:     { bsonType: "array" },
      targetAudience:     { bsonType: "array" },
      isPinned:           { bsonType: "bool" },
      notificationSent:   { bsonType: "bool" },
      notificationSentAt: { bsonType: ["date", "null"] },
      createdAt:          { bsonType: "date" },
      updatedAt:          { bsonType: ["date", "null"] },
      deletedAt:          { bsonType: ["date", "null"] }
    }
  },
  [
    { key: { classId: 1, createdAt: -1 }, options: { name: "idx_announcements_class_date" } },
    { key: { classId: 1, isPinned: 1, createdAt: -1 }, options: { name: "idx_announcements_pinned" } }
  ]
);


// ════════════════════════════════════════════════════════════
// 19. COLLECTION: audit_logs
// ════════════════════════════════════════════════════════════
await setupCollection(
  "audit_logs",
  {
    bsonType: "object",
    required: ["actorId", "actorRole", "action", "createdAt", "expiresAt"],
    properties: {
      schemaVersion: { bsonType: "int" },
      branchId:      { bsonType: ["objectId", "null"] },
      actorId:       { bsonType: "objectId" },
      actorRole:     { bsonType: "string" },
      actorName:     { bsonType: ["string", "null"] },
      requestId:     { bsonType: ["string", "null"] },
      action: {
        bsonType: "string",
        enum: [
          "UPDATE_SCORE", "DELETE_STUDENT", "CHANGE_INVOICE",
          "CREATE_ACCOUNT", "RESET_PASSWORD", "TRANSFER_CLASS",
          "CONFIRM_PAYMENT", "CANCEL_INVOICE",
          "LOGIN", "LOGOUT", "FAILED_LOGIN", "EXPORT_DATA"
        ]
      },
      targetType: { bsonType: ["string", "null"] },
      targetId:   { bsonType: ["objectId", "null"] },
      before:     { bsonType: ["object", "null"] },
      after:      { bsonType: ["object", "null"] },
      ipAddress:  { bsonType: ["string", "null"] },
      userAgent:  { bsonType: ["string", "null"] },
      createdAt:  { bsonType: "date" },
      expiresAt:  { bsonType: "date" }
    }
  },
  [
    { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "idx_audit_ttl" } },
    { key: { branchId: 1, action: 1, createdAt: -1 }, options: { name: "idx_audit_branch_action" } },
    { key: { actorId: 1, createdAt: -1 }, options: { name: "idx_audit_actor" } }
  ]
);


// ════════════════════════════════════════════════════════════
// TỔNG KẾT
// ════════════════════════════════════════════════════════════
print("\n" + "═".repeat(58));
print("🎉 LCMS Database v3.0 (camelCase) setup hoàn tất!");
print("═".repeat(58));
print("Collections đã tạo (subjects đã bỏ, tổng 19 collection):\n");

const allCollections = db.getCollectionNames().sort();
allCollections.forEach((name, i) => {
  const count = db[name].countDocuments();
  print(`  ${String(i+1).padStart(2)}. ${name.padEnd(26)} (${count} docs)`);
});

print("\n⚠️  VIỆC CẦN LÀM NGAY ĐỂ TEST:");
print("  1. XÓA SẠCH DATABASE CŨ BẰNG COMPASS (hoặc dùng lệnh: db.dropDatabase() trong MongoDB Shell).");
print("  2. Chạy lại file lcms-mongo-setup-v3.js này để setup các validation chuẩn camelCase.");
print("  3. Chạy lệnh: yarn seed");
print("═".repeat(58) + "\n");

})();