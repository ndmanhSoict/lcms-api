import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';

const SEED_SOURCE = 'binh-minh-rich-v1';
const BRANCH_EMAIL = 'csbm@lcms.edu.vn';
const MOCK_PASSWORD = 'BinhMinh@123';
const ACADEMIC_PERIOD = '2025-2026';

// Seed documents intentionally cover many collection shapes in one script.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const id = (key: string) =>
  new Types.ObjectId(createHash('sha1').update(`${SEED_SOURCE}:${key}`).digest('hex').slice(0, 24));

const now = new Date();
const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};
const addDays = (date: Date, amount: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
};
const addMonths = (date: Date, amount: number) => {
  const value = new Date(date);
  value.setMonth(value.getMonth() + amount);
  return value;
};
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

let randomState = 20260615;
const random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
};
const randomInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T>(values: T[]) => values[Math.floor(random() * values.length)];
const round1 = (value: number) => Math.round(value * 10) / 10;

const insertMany = async (collection: string, docs: Doc[]) => {
  if (docs.length > 0) {
    await mongoose.connection.db!.collection(collection).insertMany(docs, { ordered: false });
  }
  return docs.length;
};

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI chưa được cấu hình.');
  }

  console.log('Đang kết nối MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db!;

  const branch = await db.collection('branches').findOne({ email: BRANCH_EMAIL });
  if (!branch) {
    throw new Error(`Không tìm thấy cơ sở có email ${BRANCH_EMAIL}.`);
  }
  if (!branch.ownerId) {
    throw new Error('Cơ sở Bình Minh chưa có ownerId.');
  }

  const branchId = branch._id as Types.ObjectId;
  const ownerId = branch.ownerId as Types.ObjectId;
  const owner = await db.collection('users').findOne({ _id: ownerId });
  if (!owner) {
    throw new Error('Không tìm thấy tài khoản chủ Cơ sở Bình Minh.');
  }

  console.log(`Đã nhận diện: ${branch.name} (${branchId.toString()}) - ${owner.fullName}`);

  const cleanupCollections = [
    'audit_logs',
    'messages',
    'notifications',
    'evaluation_forms',
    'class_announcements',
    'payments',
    'invoices',
    'grade_records',
    'exam_attempts',
    'exams',
    'question_bank',
    'submissions',
    'assignments',
    'attendances',
    'class_sessions',
    'enrollments',
    'classes',
    'classrooms',
    'users',
  ];
  for (const collection of cleanupCollections) {
    await db.collection(collection).deleteMany({ seedSource: SEED_SOURCE });
  }

  const roomDefs = [
    ['BM-A01', 24, 'Tầng 1 - TV 65 inch, điều hòa, bảng từ'],
    ['BM-A02', 20, 'Tầng 1 - Phòng học nhóm, ánh sáng tự nhiên'],
    ['BM-A03', 28, 'Tầng 1 - Máy chiếu, loa, bảng tương tác'],
    ['BM-B01', 26, 'Tầng 2 - Phòng Toán và Khoa học tự nhiên'],
    ['BM-B02', 22, 'Tầng 2 - Phòng Ngoại ngữ, tai nghe luyện nghe'],
    ['BM-B03', 30, 'Tầng 2 - Phòng học lớn và sinh hoạt chuyên đề'],
    ['BM-C01', 18, 'Tầng 3 - Phòng phụ đạo và học cá nhân'],
    ['BM-LAB', 20, 'Tầng 3 - Phòng máy tính và thi trực tuyến'],
  ] as const;
  const roomIds = roomDefs.map((_, index) => id(`room-${index + 1}`));

  await db.collection('branches').updateOne(
    { _id: branchId },
    {
      $set: {
        name: 'Cơ sở Bình Minh',
        address: branch.address || '128 Nguyễn Văn Cừ, Long Biên, Hà Nội',
        phone: branch.phone || '024-7308-6868',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultFeePerSession: 180000,
        defaultSessionSlots: [
          { name: 'Ca sáng 1', startTime: '07:30', endTime: '09:00' },
          { name: 'Ca sáng 2', startTime: '09:15', endTime: '10:45' },
          { name: 'Ca chiều', startTime: '14:00', endTime: '16:00' },
          { name: 'Ca tối', startTime: '18:00', endTime: '20:00' },
        ],
        rooms: roomDefs.map(([code, capacity, detail]) => ({ code, name: code, capacity, detail })),
        updatedAt: now,
      },
    }
  );

  const passwordHash = await bcrypt.hash(MOCK_PASSWORD, 12);
  const teacherDefs = [
    ['Phạm Minh Anh', 'Toán học', 'female'],
    ['Nguyễn Quốc Bảo', 'Ngữ văn', 'male'],
    ['Trần Thu Hà', 'Tiếng Anh', 'female'],
    ['Lê Hoàng Nam', 'Vật lý', 'male'],
    ['Vũ Thùy Dương', 'Hóa học', 'female'],
    ['Đỗ Đức Long', 'Toán học', 'male'],
    ['Bùi Ngọc Mai', 'Tiếng Anh', 'female'],
    ['Hoàng Gia Huy', 'Ngữ văn', 'male'],
  ] as const;
  const teacherIds = teacherDefs.map((_, index) => id(`teacher-${index + 1}`));

  const classDefs = [
    {
      code: 'BM-T6A',
      name: 'Toán 6 Nền tảng',
      subject: 'Toán học',
      subjectCode: 'TOAN',
      grade: 6,
      teacher: 0,
      room: 0,
      days: [2, 5],
      time: ['18:00', '20:00'],
      color: '#2563EB',
    },
    {
      code: 'BM-V6A',
      name: 'Ngữ văn 6 Cảm thụ',
      subject: 'Ngữ văn',
      subjectCode: 'VAN',
      grade: 6,
      teacher: 1,
      room: 1,
      days: [3, 6],
      time: ['18:00', '20:00'],
      color: '#DB2777',
    },
    {
      code: 'BM-A6A',
      name: 'Tiếng Anh 6 Giao tiếp',
      subject: 'Tiếng Anh',
      subjectCode: 'ANH',
      grade: 6,
      teacher: 2,
      room: 4,
      days: [4, 0],
      time: ['18:00', '20:00'],
      color: '#7C3AED',
    },
    {
      code: 'BM-T7A',
      name: 'Toán 7 Nâng cao',
      subject: 'Toán học',
      subjectCode: 'TOAN',
      grade: 7,
      teacher: 5,
      room: 3,
      days: [2, 5],
      time: ['18:00', '20:00'],
      color: '#2563EB',
    },
    {
      code: 'BM-L7A',
      name: 'Vật lý 7 Thực hành',
      subject: 'Vật lý',
      subjectCode: 'LY',
      grade: 7,
      teacher: 3,
      room: 2,
      days: [3, 6],
      time: ['18:00', '20:00'],
      color: '#0891B2',
    },
    {
      code: 'BM-A7A',
      name: 'Tiếng Anh 7 IELTS Foundation',
      subject: 'Tiếng Anh',
      subjectCode: 'ANH',
      grade: 7,
      teacher: 6,
      room: 4,
      days: [4, 0],
      time: ['18:00', '20:00'],
      color: '#7C3AED',
    },
    {
      code: 'BM-T8A',
      name: 'Toán 8 Chuyên đề',
      subject: 'Toán học',
      subjectCode: 'TOAN',
      grade: 8,
      teacher: 0,
      room: 3,
      days: [2, 5],
      time: ['18:00', '20:00'],
      color: '#2563EB',
    },
    {
      code: 'BM-H8A',
      name: 'Hóa học 8 Khám phá',
      subject: 'Hóa học',
      subjectCode: 'HOA',
      grade: 8,
      teacher: 4,
      room: 2,
      days: [3, 6],
      time: ['18:00', '20:00'],
      color: '#059669',
    },
    {
      code: 'BM-V8A',
      name: 'Ngữ văn 8 Viết sáng tạo',
      subject: 'Ngữ văn',
      subjectCode: 'VAN',
      grade: 8,
      teacher: 7,
      room: 1,
      days: [4, 0],
      time: ['18:00', '20:00'],
      color: '#DB2777',
    },
    {
      code: 'BM-T9A',
      name: 'Toán 9 Luyện thi vào 10',
      subject: 'Toán học',
      subjectCode: 'TOAN',
      grade: 9,
      teacher: 5,
      room: 5,
      days: [2, 5],
      time: ['18:00', '20:00'],
      color: '#2563EB',
    },
    {
      code: 'BM-A9A',
      name: 'Tiếng Anh 9 Luyện đề',
      subject: 'Tiếng Anh',
      subjectCode: 'ANH',
      grade: 9,
      teacher: 6,
      room: 4,
      days: [3, 6],
      time: ['18:00', '20:00'],
      color: '#7C3AED',
    },
    {
      code: 'BM-V9A',
      name: 'Ngữ văn 9 Luyện thi vào 10',
      subject: 'Ngữ văn',
      subjectCode: 'VAN',
      grade: 9,
      teacher: 1,
      room: 5,
      days: [4, 0],
      time: ['18:00', '20:00'],
      color: '#DB2777',
    },
  ];
  const classIds = classDefs.map(definition => id(`class-${definition.code}`));

  const staffNames = [
    'Nguyễn Thị Thanh Hương',
    'Trần Đức Thành',
    'Lê Mai Phương',
    'Phạm Quang Vinh',
  ];
  const staffIds = staffNames.map((_, index) => id(`staff-${index + 1}`));
  const firstNames = [
    'An',
    'Bình',
    'Chi',
    'Dũng',
    'Giang',
    'Hà',
    'Hải',
    'Hân',
    'Hiếu',
    'Hoài',
    'Hùng',
    'Khánh',
  ];
  const middleNames = ['Minh', 'Ngọc', 'Gia', 'Thanh'];
  const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm'];
  const studentIds = Array.from({ length: 48 }, (_, index) => id(`student-${index + 1}`));
  const parentIds = Array.from({ length: 48 }, (_, index) => id(`parent-${index + 1}`));
  const studentNames = Array.from(
    { length: 48 },
    (_, index) =>
      `${familyNames[index % familyNames.length]} ${middleNames[Math.floor(index / 12)]} ${firstNames[index % firstNames.length]}`
  );

  const studentClassIndexes = Array.from({ length: 48 }, (_, index) => {
    const gradeGroup = Math.floor(index / 12);
    return [gradeGroup * 3, gradeGroup * 3 + 1, gradeGroup * 3 + 2];
  });

  const userDocs: Doc[] = [];
  staffNames.forEach((fullName, index) => {
    userDocs.push({
      _id: staffIds[index],
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      userCode: `BM-ST-${String(index + 1).padStart(3, '0')}`,
      email: `staff${index + 1}.binhminh@lcms.edu.vn`,
      phone: `0388100${String(index + 1).padStart(3, '0')}`,
      passwordHash,
      role: 'staff',
      branchId,
      fullName,
      dateOfBirth: new Date(1988 + index, index + 1, 10 + index),
      gender: index % 2 === 0 ? 'female' : 'male',
      avatarUrl: null,
      studentInfo: null,
      parentInfo: null,
      teacherInfo: null,
      isActive: true,
      lastLoginAt: addDays(now, -index),
      createdBy: ownerId,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -180 + index),
      updatedAt: now,
    });
  });
  teacherDefs.forEach(([fullName, subject, gender], index) => {
    const activeClassIds = classDefs
      .map((definition, classIndex) => (definition.teacher === index ? classIds[classIndex] : null))
      .filter(Boolean);
    userDocs.push({
      _id: teacherIds[index],
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      userCode: `BM-GV-${String(index + 1).padStart(3, '0')}`,
      email: `giaovien${index + 1}.binhminh@lcms.edu.vn`,
      phone: `0388200${String(index + 1).padStart(3, '0')}`,
      passwordHash,
      role: 'teacher',
      branchId,
      fullName,
      dateOfBirth: new Date(1983 + index, index % 12, 5 + index),
      gender,
      avatarUrl: null,
      studentInfo: null,
      parentInfo: null,
      teacherInfo: {
        subjects: [subject],
        joinDate: addDays(now, -500 + index * 20),
        activeClassIds,
      },
      isActive: true,
      lastLoginAt: addDays(now, -randomInt(0, 6)),
      createdBy: ownerId,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -500 + index * 20),
      updatedAt: now,
    });
  });
  studentIds.forEach((studentId, index) => {
    const grade = 6 + Math.floor(index / 12);
    const activeClassIds = studentClassIndexes[index].map(classIndex => classIds[classIndex]);
    userDocs.push({
      _id: parentIds[index],
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      userCode: `BM-PH-${String(index + 1).padStart(3, '0')}`,
      email: `phuhuynh${String(index + 1).padStart(2, '0')}.binhminh@lcms.edu.vn`,
      phone: `0391${String(100000 + index).slice(-6)}`,
      passwordHash,
      role: 'parent',
      branchId,
      fullName: `${familyNames[index % 4]} Văn ${index % 2 === 0 ? 'Hùng' : 'Lan'}`,
      dateOfBirth: new Date(1977 + (index % 12), index % 12, 1 + (index % 25)),
      gender: index % 2 === 0 ? 'male' : 'female',
      avatarUrl: null,
      studentInfo: null,
      parentInfo: { studentIds: [studentId], relationship: index % 2 === 0 ? 'father' : 'mother' },
      teacherInfo: null,
      isActive: true,
      lastLoginAt: addDays(now, -randomInt(0, 12)),
      createdBy: ownerId,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -150 + index),
      updatedAt: now,
    });
    userDocs.push({
      _id: studentId,
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      userCode: `BM-HS-${String(index + 1).padStart(3, '0')}`,
      email: `hocsinh${String(index + 1).padStart(2, '0')}.binhminh@lcms.edu.vn`,
      phone: null,
      passwordHash,
      role: 'student',
      branchId,
      fullName: studentNames[index],
      dateOfBirth: new Date(2014 - grade, (index * 3) % 12, 1 + (index % 25)),
      gender: index % 2 === 0 ? 'male' : 'female',
      avatarUrl: null,
      studentInfo: {
        activeClassIds,
        enrollmentDate: addDays(now, -120 + (index % 20)),
        parentIds: [parentIds[index]],
        schoolName: pick(['THCS Ngọc Lâm', 'THCS Ái Mộ', 'THCS Gia Thụy', 'THCS Việt Hưng']),
        grade,
      },
      parentInfo: null,
      teacherInfo: null,
      isActive: true,
      lastLoginAt: addDays(now, -randomInt(0, 8)),
      createdBy: ownerId,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -120 + (index % 20)),
      updatedAt: now,
    });
  });
  await insertMany('users', userDocs);

  const classroomDocs = roomDefs.map(([code, capacity, detail], index) => ({
    _id: roomIds[index],
    seedSource: SEED_SOURCE,
    schemaVersion: 1,
    branchId,
    code,
    capacity,
    detail,
    isActive: true,
    createdBy: ownerId,
    deletedAt: null,
    createdAt: addDays(now, -200),
    updatedAt: now,
  }));
  await insertMany('classrooms', classroomDocs);

  const classDocs = classDefs.map((definition, index) => {
    const room = roomDefs[definition.room];
    const teacher = teacherDefs[definition.teacher];
    return {
      _id: classIds[index],
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      branchId,
      subject: {
        name: definition.subject,
        code: definition.subjectCode,
        color: definition.color,
        icon: null,
      },
      name: definition.name,
      classCode: definition.code,
      description: `Chương trình ${definition.subject} lớp ${definition.grade} tại Cơ sở Bình Minh.`,
      teacherId: teacherIds[definition.teacher],
      teacherSnapshot: { fullName: teacher[0], avatarUrl: null },
      coTeacherIds: [],
      roomId: roomIds[definition.room],
      roomSnapshot: { code: room[0], capacity: room[1], detail: room[2] },
      classType: 'ongoing',
      startDate: addDays(now, -120),
      endDate: null,
      courseInfo: null,
      ongoingInfo: { feePerSession: 180000 + definition.grade * 5000, billingCycle: 'monthly' },
      weeklySchedule: definition.days.map(dayOfWeek => ({
        dayOfWeek,
        startTime: definition.time[0],
        endTime: definition.time[1],
        roomId: roomIds[definition.room],
        roomCode: room[0],
      })),
      maxStudents: 20,
      studentCount: 12,
      status: 'active',
      createdBy: ownerId,
      deletedAt: null,
      createdAt: addDays(now, -130),
      updatedAt: now,
    };
  });
  await insertMany('classes', classDocs);

  const enrollmentDocs: Doc[] = [];
  studentIds.forEach((studentId, studentIndex) => {
    studentClassIndexes[studentIndex].forEach(classIndex => {
      const definition = classDefs[classIndex];
      enrollmentDocs.push({
        _id: id(`enrollment-${studentIndex}-${classIndex}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        studentId,
        classId: classIds[classIndex],
        classSnapshot: {
          name: definition.name,
          subjectName: definition.subject,
          teacherName: teacherDefs[definition.teacher][0],
        },
        enrolledAt: addDays(now, -120 + (studentIndex % 15)),
        leftAt: null,
        leftReason: null,
        enrolledBy: ownerId,
        createdAt: addDays(now, -120 + (studentIndex % 15)),
        updatedAt: now,
      });
    });
  });
  await insertMany('enrollments', enrollmentDocs);

  const sessionDocs: Doc[] = [];
  const sessionsByClass = new Map<number, Doc[]>();
  classDefs.forEach((definition, classIndex) => {
    const classSessions: Doc[] = [];
    for (let offset = -120; offset <= 30; offset += 1) {
      const sessionDate = startOfDay(addDays(now, offset));
      if (!definition.days.includes(sessionDate.getDay())) continue;
      const sessionId = id(`session-${classIndex}-${sessionDate.toISOString().slice(0, 10)}`);
      const isPast = sessionDate < startOfDay(now);
      const cancelled = isPast && random() < 0.025;
      const doc = {
        _id: sessionId,
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        classId: classIds[classIndex],
        teacherId: teacherIds[definition.teacher],
        sessionDate,
        startTime: definition.time[0],
        endTime: definition.time[1],
        roomId: roomIds[definition.room],
        roomSnapshot: {
          code: roomDefs[definition.room][0],
          capacity: roomDefs[definition.room][1],
          detail: roomDefs[definition.room][2],
        },
        roomCode: roomDefs[definition.room][0],
        sessionType: cancelled ? 'cancelled' : 'regular',
        status: cancelled ? 'cancelled' : isPast ? 'completed' : 'scheduled',
        note: cancelled
          ? 'Nghỉ theo thông báo của trung tâm.'
          : offset === 0
            ? 'Buổi học hôm nay.'
            : null,
        attendanceStatus: isPast && !cancelled ? 'submitted' : 'pending',
        materials:
          isPast && random() < 0.28
            ? [
                {
                  name: `Tài liệu ${definition.subject} - buổi ${classSessions.length + 1}`,
                  url: `/uploads/materials/${definition.code.toLowerCase()}-${classSessions.length + 1}.pdf`,
                  mimeType: 'application/pdf',
                  size: randomInt(180000, 950000),
                  uploadedAt: sessionDate,
                  uploadedBy: teacherIds[definition.teacher],
                },
              ]
            : [],
        onlineMeetingUrl:
          !isPast && random() < 0.15
            ? `https://meet.lcms.edu.vn/${definition.code.toLowerCase()}`
            : null,
        deletedAt: null,
        createdAt: addDays(sessionDate, -7),
        updatedAt: isPast ? sessionDate : now,
      };
      classSessions.push(doc);
      sessionDocs.push(doc);
    }
    sessionsByClass.set(classIndex, classSessions);
  });
  await insertMany('class_sessions', sessionDocs);

  const attendanceDocs: Doc[] = [];
  classDefs.forEach((definition, classIndex) => {
    const classStudents = studentIds.filter((_, studentIndex) =>
      studentClassIndexes[studentIndex].includes(classIndex)
    );
    for (const session of sessionsByClass.get(classIndex) ?? []) {
      if (session.status !== 'completed') continue;
      classStudents.forEach((studentId, studentPosition) => {
        const absent = random() < 0.07 + (studentPosition % 5 === 0 ? 0.03 : 0);
        attendanceDocs.push({
          _id: id(`attendance-${session._id}-${studentId}`),
          seedSource: SEED_SOURCE,
          schemaVersion: 1,
          branchId,
          sessionId: session._id,
          classId: classIds[classIndex],
          studentId,
          teacherId: teacherIds[definition.teacher],
          status: absent ? 'absent' : 'present',
          sessionDate: session.sessionDate,
          markedAt: new Date(session.sessionDate.getTime() + 3 * 60 * 60 * 1000),
          absenceNotified: absent,
          editHistory: [],
          createdAt: session.sessionDate,
          updatedAt: session.sessionDate,
        });
      });
    }
  });
  await insertMany('attendances', attendanceDocs);

  const assignmentTitles = [
    'Bài luyện tập tuần',
    'Phiếu củng cố kiến thức',
    'Bài tập vận dụng',
    'Dự án học tập mini',
  ];
  const assignmentDocs: Doc[] = [];
  const assignmentsByClass = new Map<number, Doc[]>();
  classDefs.forEach((definition, classIndex) => {
    const docs = assignmentTitles.map((title, assignmentIndex) => {
      const dueDate = addDays(now, -35 + assignmentIndex * 16 + (classIndex % 4));
      const status =
        dueDate < now
          ? 'closed'
          : assignmentIndex === 3 && classIndex % 3 === 0
            ? 'draft'
            : 'active';
      return {
        _id: id(`assignment-${classIndex}-${assignmentIndex}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        classId: classIds[classIndex],
        teacherId: teacherIds[definition.teacher],
        sessionId: null,
        title: `${title} ${definition.subject} ${definition.grade}`,
        description: '<p>Hoàn thành đầy đủ, trình bày rõ ràng và nộp đúng hạn.</p>',
        attachmentUrls: [],
        questions: [
          {
            _id: id(`assignment-question-${classIndex}-${assignmentIndex}`),
            prompt: 'Em tự đánh giá mức độ hiểu bài?',
            type: 'single_choice',
            options: [
              { id: 'a', text: 'Đã hiểu và vận dụng được', isCorrect: true },
              { id: 'b', text: 'Cần được hỗ trợ thêm', isCorrect: false },
            ],
            points: 1,
          },
        ],
        assignmentType:
          assignmentIndex === 3 ? 'project' : assignmentIndex === 1 ? 'practice' : 'homework',
        dueDate,
        maxScore: 10,
        isGraded: true,
        visibleToParent: true,
        submissionConfig: {
          allowLate: true,
          allowText: true,
          allowFile: true,
          maxFileSizeMb: 10,
          allowedFileTypes: ['pdf', 'docx', 'jpg', 'png'],
        },
        status,
        submissionCount: 0,
        gradedCount: 0,
        deletedAt: null,
        createdAt: addDays(dueDate, -10),
        updatedAt: now,
      };
    });
    assignmentsByClass.set(classIndex, docs);
    assignmentDocs.push(...docs);
  });

  const submissionDocs: Doc[] = [];
  classDefs.forEach((definition, classIndex) => {
    const classStudents = studentIds.filter((_, studentIndex) =>
      studentClassIndexes[studentIndex].includes(classIndex)
    );
    (assignmentsByClass.get(classIndex) ?? []).forEach((assignment, assignmentIndex) => {
      let submissionCount = 0;
      let gradedCount = 0;
      classStudents.forEach((studentId, studentPosition) => {
        const shouldSubmit =
          assignment.status === 'closed'
            ? random() < 0.9
            : assignment.status === 'active' && random() < 0.48;
        if (!shouldSubmit) return;
        submissionCount += 1;
        const graded = assignment.status === 'closed' || random() < 0.45;
        if (graded) gradedCount += 1;
        const score = round1(Math.min(10, 6.2 + random() * 3.8));
        const submittedAt = addDays(assignment.dueDate, random() < 0.12 ? 1 : -randomInt(1, 5));
        submissionDocs.push({
          _id: id(`submission-${classIndex}-${assignmentIndex}-${studentId}`),
          seedSource: SEED_SOURCE,
          schemaVersion: 1,
          branchId,
          assignmentId: assignment._id,
          studentId,
          classId: classIds[classIndex],
          contentText: `Bài làm của ${studentNames[studentIds.findIndex(value => value.equals(studentId))]}.`,
          attachmentUrls: [],
          answers: [
            {
              questionId: assignment.questions[0]._id.toString(),
              value: studentPosition % 4 === 0 ? 'b' : 'a',
              score: graded ? 1 : null,
              isCorrect: graded ? studentPosition % 4 !== 0 : null,
            },
          ],
          submittedAt,
          isLate: submittedAt > assignment.dueDate,
          resubmitCount: random() < 0.08 ? 1 : 0,
          status: graded ? 'graded' : 'submitted',
          score: graded ? score : null,
          maxScore: 10,
          feedback: graded
            ? pick([
                'Hoàn thành tốt.',
                'Trình bày rõ ràng, cần kiểm tra kỹ bước cuối.',
                'Có tiến bộ, tiếp tục phát huy.',
                'Nắm chắc kiến thức cơ bản.',
              ])
            : null,
          gradedAt: graded ? addDays(submittedAt, 1) : null,
          gradedBy: graded ? teacherIds[definition.teacher] : null,
          revisionRequested: false,
          revisionNote: null,
          createdAt: submittedAt,
          updatedAt: graded ? addDays(submittedAt, 1) : submittedAt,
        });
      });
      assignment.submissionCount = submissionCount;
      assignment.gradedCount = gradedCount;
    });
  });
  await insertMany('assignments', assignmentDocs);
  await insertMany('submissions', submissionDocs);

  const questionDocs: Doc[] = [];
  const questionsBySubject = new Map<string, Doc[]>();
  const subjectDefs = [...new Map(classDefs.map(value => [value.subjectCode, value])).values()];
  subjectDefs.forEach(subject => {
    const docs = Array.from({ length: 12 }, (_, index) => ({
      _id: id(`question-${subject.subjectCode}-${index}`),
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      createdBy: teacherIds[subject.teacher],
      subjectName: subject.subject,
      subjectCode: subject.subjectCode,
      questionType: 'multiple_choice',
      content: `Câu ${index + 1}: Chọn đáp án đúng cho chuyên đề ${subject.subject}.`,
      imageUrl: null,
      difficulty: index < 4 ? 'easy' : index < 9 ? 'medium' : 'hard',
      tags: [subject.subjectCode.toLowerCase(), 'binh-minh'],
      chapter: `Chuyên đề ${Math.floor(index / 3) + 1}`,
      options: [
        { key: 'A', content: 'Đáp án A' },
        { key: 'B', content: 'Đáp án B' },
        { key: 'C', content: 'Đáp án C' },
        { key: 'D', content: 'Đáp án D' },
      ],
      correctAnswer: ['A', 'B', 'C', 'D'][index % 4],
      answerTolerance: null,
      gradingGuide: null,
      isReported: false,
      reportNote: null,
      isActive: true,
      usageCount: 2,
      deletedAt: null,
      createdAt: addDays(now, -90 + index),
      updatedAt: now,
    }));
    questionsBySubject.set(subject.subjectCode, docs);
    questionDocs.push(...docs);
  });
  await insertMany('question_bank', questionDocs);

  const examDocs: Doc[] = [];
  const attemptDocs: Doc[] = [];
  const examsByClass = new Map<number, Doc[]>();
  classDefs.forEach((definition, classIndex) => {
    const sourceQuestions = questionsBySubject.get(definition.subjectCode)!;
    const docs = [0, 1].map(examIndex => {
      const closed = examIndex === 0;
      const availableFrom = addDays(now, closed ? -28 - (classIndex % 5) : 7 + (classIndex % 4));
      const selected = sourceQuestions.slice(examIndex * 5, examIndex * 5 + 5);
      return {
        _id: id(`exam-${classIndex}-${examIndex}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        classId: classIds[classIndex],
        targetType: 'class',
        teacherId: teacherIds[definition.teacher],
        title: `${closed ? 'Kiểm tra định kỳ' : 'Bài kiểm tra sắp tới'} - ${definition.name}`,
        description: `Đề kiểm tra 45 phút môn ${definition.subject}.`,
        durationMinutes: 45,
        totalScore: 10,
        passingScore: 5,
        config: {
          shuffleQuestions: true,
          shuffleOptions: true,
          showResultAfter: 'graded',
          allowedAttempts: 1,
        },
        availableFrom,
        availableTo: addDays(availableFrom, 2),
        questions: selected.map((question, questionIndex) => ({
          questionId: question._id,
          questionType: question.questionType,
          content: question.content,
          imageUrl: null,
          options: question.options,
          correctAnswer: question.correctAnswer,
          score: 2,
          order: questionIndex + 1,
        })),
        status: closed ? 'closed' : 'published',
        resultPublishedAt: closed ? addDays(availableFrom, 4) : null,
        resultPublishedBy: closed ? teacherIds[definition.teacher] : null,
        attemptCount: closed ? 12 : 0,
        deletedAt: null,
        createdAt: addDays(availableFrom, -10),
        updatedAt: now,
      };
    });
    examsByClass.set(classIndex, docs);
    examDocs.push(...docs);

    const classStudents = studentIds.filter((_, studentIndex) =>
      studentClassIndexes[studentIndex].includes(classIndex)
    );
    classStudents.forEach((studentId, studentPosition) => {
      const exam = docs[0];
      const score = round1(Math.min(10, 5.5 + random() * 4.5));
      attemptDocs.push({
        _id: id(`attempt-${classIndex}-${studentId}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        examId: exam._id,
        studentId,
        classId: classIds[classIndex],
        status: 'graded',
        startedAt: new Date(exam.availableFrom.getTime() + studentPosition * 60000),
        submittedAt: new Date(exam.availableFrom.getTime() + (35 + studentPosition) * 60000),
        timeRemainingSeconds: randomInt(120, 600),
        draftExpiresAt: null,
        answers: exam.questions.map((question: Doc) => ({
          questionId: question.questionId,
          questionOrder: question.order,
          answer: question.correctAnswer,
          isFlagged: false,
          answeredAt: exam.availableFrom,
        })),
        lastSavedAt: new Date(exam.availableFrom.getTime() + 30 * 60000),
        score,
        totalScore: 10,
        autoScore: score,
        manualScore: 0,
        gradedAt: addDays(exam.availableFrom, 3),
        gradedBy: teacherIds[definition.teacher],
        answerResults: exam.questions.map((question: Doc, questionIndex: number) => ({
          questionId: question.questionId,
          questionType: question.questionType,
          studentAnswer: question.correctAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: questionIndex < Math.round(score / 2),
          scoreEarned: questionIndex < Math.round(score / 2) ? 2 : 0,
        })),
        essayGrades: [],
        ipAddress: `10.10.${classIndex}.${studentPosition + 10}`,
        userAgent: 'LCMS Seed Browser',
        tabSwitchCount: randomInt(0, 2),
        createdAt: exam.availableFrom,
        updatedAt: addDays(exam.availableFrom, 3),
      });
    });
  });
  await insertMany('exams', examDocs);
  await insertMany('exam_attempts', attemptDocs);

  const gradeDocs: Doc[] = [];
  enrollmentDocs.forEach(enrollment => {
    const classIndex = classIds.findIndex(value => value.equals(enrollment.classId));
    const studentIndex = studentIds.findIndex(value => value.equals(enrollment.studentId));
    const definition = classDefs[classIndex];
    const attendanceForStudent = attendanceDocs.filter(
      value =>
        value.classId.equals(enrollment.classId) && value.studentId.equals(enrollment.studentId)
    );
    const presentCount = attendanceForStudent.filter(value => value.status === 'present').length;
    const totalSessions = attendanceForStudent.length;
    const attendanceRate = totalSessions ? round1((presentCount * 100) / totalSessions) : 100;
    const classAssignments = assignmentsByClass.get(classIndex) ?? [];
    const homeworkScores = classAssignments.slice(0, 3).map(assignment => ({
      assignmentId: assignment._id,
      title: assignment.title,
      score: round1(7 + random() * 3),
      maxScore: 10,
      weight: 0.1,
      dueDate: assignment.dueDate,
      submittedAt: addDays(assignment.dueDate, -1),
      feedback: 'Hoàn thành tốt yêu cầu.',
    }));
    const exam = examsByClass.get(classIndex)![0];
    const attempt = attemptDocs.find(
      value => value.examId.equals(exam._id) && value.studentId.equals(enrollment.studentId)
    )!;
    const assignmentAvg = round1(
      homeworkScores.reduce((sum, value) => sum + value.score, 0) / homeworkScores.length
    );
    const finalScore = round1(assignmentAvg * 0.4 + attempt.score * 0.6);
    gradeDocs.push({
      _id: id(`grade-${enrollment.studentId}-${enrollment.classId}`),
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      branchId,
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      teacherId: teacherIds[definition.teacher],
      academicPeriod: ACADEMIC_PERIOD,
      attendanceSummary: {
        totalSessions,
        presentCount,
        absentCount: totalSessions - presentCount,
        attendanceRate,
        note: attendanceRate >= 90 ? 'Chuyên cần tốt.' : 'Cần cải thiện chuyên cần.',
      },
      homeworkScores,
      assignmentAvg,
      testScores: [
        {
          examId: exam._id,
          title: exam.title,
          score: attempt.score,
          totalScore: 10,
          weight: 0.6,
          testDate: exam.availableFrom,
          note: 'Kết quả kiểm tra định kỳ.',
        },
      ],
      examScores: [
        {
          examId: exam._id,
          title: exam.title,
          score: attempt.score,
          totalScore: 10,
          weight: 0.6,
          examDate: exam.availableFrom,
        },
      ],
      finalScore,
      gradeLetter: finalScore >= 8.5 ? 'A' : finalScore >= 7 ? 'B' : 'C',
      attendanceRate,
      sessionsAttended: presentCount,
      sessionsTotal: totalSessions,
      regularComment: pick([
        'Có ý thức học tập tốt.',
        'Tích cực phát biểu xây dựng bài.',
        'Tiến bộ rõ rệt trong tháng gần đây.',
      ]),
      teacherComment:
        finalScore >= 8
          ? 'Nắm chắc kiến thức, vận dụng tốt.'
          : 'Cần luyện tập thêm các dạng bài vận dụng.',
      courseComment: 'Duy trì lịch học và hoàn thành bài tập đúng hạn.',
      sessionComments: [],
      monthlyComments: [
        {
          month: monthKey(now),
          comment: 'Học tập nghiêm túc và có tiến bộ.',
          strengths: 'Chủ động, hợp tác tốt.',
          improvements: 'Rèn tốc độ và độ chính xác.',
        },
      ],
      status: 'published',
      publishedAt: addDays(now, -2),
      createdAt: addDays(now, -20 + (studentIndex % 5)),
      updatedAt: now,
    });
  });
  await insertMany('grade_records', gradeDocs);

  const invoiceDocs: Doc[] = [];
  const paymentDocs: Doc[] = [];
  const billingMonths = [-2, -1, 0].map(offset => addMonths(now, offset));
  studentIds.forEach((studentId, studentIndex) => {
    const primaryClassIndex = studentClassIndexes[studentIndex][0];
    const definition = classDefs[primaryClassIndex];
    billingMonths.forEach((billingDate, billingIndex) => {
      const period = monthKey(billingDate);
      const invoiceId = id(`invoice-${studentIndex}-${period}`);
      const paid = billingIndex < 2 || studentIndex % 4 !== 0;
      const partial = billingIndex === 2 && studentIndex % 9 === 0;
      const overdue = billingIndex === 2 && studentIndex % 12 === 0;
      const totalAmount = 1440000 + (studentIndex % 4) * 90000;
      const paidAmount = partial ? Math.floor(totalAmount / 2) : paid ? totalAmount : 0;
      const status = partial ? 'partial' : overdue ? 'overdue' : paid ? 'paid' : 'unpaid';
      const paymentId = paidAmount > 0 ? id(`payment-${studentIndex}-${period}`) : null;
      const paymentMethod = studentIndex % 3 === 0 ? 'vnpay' : 'cash';
      invoiceDocs.push({
        _id: invoiceId,
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        studentId,
        classId: classIds[primaryClassIndex],
        studentSnapshot: {
          fullName: studentNames[studentIndex],
          studentCode: `BM-HS-${String(studentIndex + 1).padStart(3, '0')}`,
        },
        classSnapshot: { name: definition.name, subjectName: definition.subject },
        invoiceCode: `BM-SEED-${period.replace('-', '')}-${String(studentIndex + 1).padStart(3, '0')}`,
        invoiceType: 'monthly',
        billingPeriod: period,
        sessionsAttended: 8,
        sessionsTotal: 8,
        feePerSession: totalAmount / 8,
        courseFee: null,
        subtotal: totalAmount,
        discountAmount: 0,
        discountNote: null,
        excusedSessions: 0,
        totalAmount,
        dueDate: new Date(billingDate.getFullYear(), billingDate.getMonth(), 15, 23, 59, 59),
        status,
        paymentMethod: paidAmount > 0 ? paymentMethod : null,
        paidAt:
          paidAmount > 0
            ? new Date(billingDate.getFullYear(), billingDate.getMonth(), 10 + (studentIndex % 5))
            : null,
        paidAmount: paidAmount || null,
        confirmedBy: paidAmount > 0 ? ownerId : null,
        paymentIds: paymentId ? [paymentId] : [],
        vnpayTransactionRef:
          paymentMethod === 'vnpay' && paymentId
            ? `BM${period.replace('-', '')}${String(studentIndex + 1).padStart(4, '0')}`
            : null,
        vnpayTransactionId: null,
        generationType: 'auto',
        note: partial ? 'Đã thanh toán một phần.' : null,
        createdBy: ownerId,
        deletedAt: null,
        createdAt: new Date(billingDate.getFullYear(), billingDate.getMonth(), 1),
        updatedAt: now,
      });
      if (paymentId) {
        paymentDocs.push({
          _id: paymentId,
          seedSource: SEED_SOURCE,
          schemaVersion: 1,
          branchId,
          invoiceId,
          studentId,
          paymentMethod,
          amount: paidAmount,
          status: 'success',
          receivedBy: ownerId,
          receivedAt: new Date(
            billingDate.getFullYear(),
            billingDate.getMonth(),
            10 + (studentIndex % 5)
          ),
          vnpayRef:
            paymentMethod === 'vnpay'
              ? `BM${period.replace('-', '')}${String(studentIndex + 1).padStart(4, '0')}`
              : null,
          vnpayData: null,
          createdAt: new Date(
            billingDate.getFullYear(),
            billingDate.getMonth(),
            10 + (studentIndex % 5)
          ),
        });
      }
    });
  });
  await insertMany('invoices', invoiceDocs);
  await insertMany('payments', paymentDocs);

  const evaluationDocs = enrollmentDocs.map((enrollment, index) => {
    const classIndex = classIds.findIndex(value => value.equals(enrollment.classId));
    const definition = classDefs[classIndex];
    return {
      _id: id(`evaluation-${enrollment._id}`),
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      branchId,
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      sessionId: null,
      teacherId: teacherIds[definition.teacher],
      createdBy: teacherIds[definition.teacher],
      createdByRole: 'teacher',
      periodType: 'monthly',
      periodLabel: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
      month: monthKey(now),
      title: `Đánh giá tháng - ${definition.name}`,
      content: 'Học sinh tham gia đầy đủ các hoạt động học tập và có tiến bộ ổn định.',
      strengths: pick([
        'Tư duy tốt, tiếp thu nhanh.',
        'Chăm chỉ và có tinh thần tự học.',
        'Tích cực trao đổi và hợp tác trong lớp.',
      ]),
      improvements: pick([
        'Cần trình bày bài cẩn thận hơn.',
        'Cần tăng tốc độ làm bài.',
        'Nên chủ động ôn tập trước mỗi buổi học.',
      ]),
      recommendations: 'Duy trì lịch học, hoàn thành bài tập và đọc trước nội dung buổi tiếp theo.',
      attitudeScore: randomInt(8, 10),
      studyScore: randomInt(7, 10),
      homeworkScore: randomInt(7, 10),
      criteria: [
        { label: 'Thái độ học tập', score: randomInt(8, 10), maxScore: 10, comment: 'Nghiêm túc.' },
        {
          label: 'Mức độ hoàn thành bài tập',
          score: randomInt(7, 10),
          maxScore: 10,
          comment: 'Đạt yêu cầu.',
        },
      ],
      status: 'published',
      publishedAt: addDays(now, -(index % 10)),
      createdAt: addDays(now, -(index % 10)),
      updatedAt: now,
    };
  });
  await insertMany('evaluation_forms', evaluationDocs);

  const announcementDocs: Doc[] = [];
  classDefs.forEach((definition, classIndex) => {
    [
      'Lịch học và nội quy lớp',
      'Tài liệu ôn tập trong tháng',
      'Thông báo kiểm tra định kỳ',
    ].forEach((title, announcementIndex) => {
      announcementDocs.push({
        _id: id(`announcement-${classIndex}-${announcementIndex}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        classId: classIds[classIndex],
        authorId: teacherIds[definition.teacher],
        title,
        content: `${title} của lớp ${definition.name}. Phụ huynh và học sinh vui lòng theo dõi để thực hiện đúng kế hoạch.`,
        attachmentUrls:
          announcementIndex === 1
            ? [`/uploads/announcements/${definition.code.toLowerCase()}-review.pdf`]
            : [],
        targetAudience: ['student', 'parent'],
        isPinned: announcementIndex === 0,
        notificationSent: true,
        notificationSentAt: addDays(now, -announcementIndex * 5 - (classIndex % 3)),
        deletedAt: null,
        createdAt: addDays(now, -announcementIndex * 5 - (classIndex % 3)),
        updatedAt: now,
      });
    });
  });
  await insertMany('class_announcements', announcementDocs);

  const notificationDocs: Doc[] = [];
  studentIds.forEach((studentId, studentIndex) => {
    const recipients = [studentId, parentIds[studentIndex]];
    recipients.forEach((recipientId, recipientIndex) => {
      const templates = [
        ['assignment_due', 'Sắp đến hạn nộp bài', 'Bài luyện tập tuần sẽ hết hạn trong 2 ngày.'],
        [
          'score_published',
          'Đã công bố kết quả học tập',
          'Giáo viên đã cập nhật điểm và nhận xét mới.',
        ],
        [
          'invoice_due',
          'Thông báo học phí tháng này',
          'Phiếu học phí mới đã được tạo, vui lòng kiểm tra.',
        ],
      ];
      templates.forEach(([type, title, content], templateIndex) => {
        const createdAt = addDays(now, -templateIndex * 3 - (studentIndex % 4));
        notificationDocs.push({
          _id: id(`notification-${studentIndex}-${recipientIndex}-${templateIndex}`),
          seedSource: SEED_SOURCE,
          schemaVersion: 1,
          branchId,
          recipientId,
          type,
          title,
          content,
          actionUrl:
            templateIndex === 0
              ? '/student/assignments'
              : templateIndex === 1
                ? '/student/grades'
                : '/parent/invoices',
          channels: ['in_app'],
          metadata: { source: SEED_SOURCE },
          isRead: templateIndex > 0 || studentIndex % 3 === 0,
          readAt: templateIndex > 0 ? addDays(createdAt, 1) : null,
          emailSent: false,
          emailSentAt: null,
          createdAt,
          expiresAt: addMonths(createdAt, 6),
        });
      });
    });
  });
  await insertMany('notifications', notificationDocs);

  const messageDocs: Doc[] = [];
  studentIds.forEach((studentId, studentIndex) => {
    const classIndex = studentClassIndexes[studentIndex][0];
    const teacherId = teacherIds[classDefs[classIndex].teacher];
    const parentId = parentIds[studentIndex];
    const threadId = [teacherId.toString(), parentId.toString()].sort().join('_');
    const messages = [
      [
        parentId,
        teacherId,
        'Chào thầy/cô, cho tôi xin nhận xét tình hình học tập gần đây của con.',
      ],
      [teacherId, parentId, 'Em học khá tập trung và hoàn thành bài tập đều.'],
      [parentId, teacherId, 'Cảm ơn thầy/cô. Gia đình sẽ tiếp tục nhắc em ôn bài.'],
      [
        teacherId,
        parentId,
        'Tuần tới lớp có bài kiểm tra ngắn, phụ huynh nhắc em xem lại tài liệu nhé.',
      ],
    ] as const;
    messages.forEach(([senderId, receiverId, content], messageIndex) => {
      const sentAt = addDays(now, -8 + messageIndex * 2 + (studentIndex % 3));
      messageDocs.push({
        _id: id(`message-${studentIndex}-${messageIndex}`),
        seedSource: SEED_SOURCE,
        schemaVersion: 1,
        branchId,
        threadId,
        senderId,
        receiverId,
        messageType: 'text',
        content,
        attachmentUrl: null,
        isRead: messageIndex < 3,
        readAt: messageIndex < 3 ? new Date(sentAt.getTime() + 30 * 60000) : null,
        sentAt,
        deletedAt: null,
      });
    });
  });
  await insertMany('messages', messageDocs);

  const auditActions = [
    'CREATE_ACCOUNT',
    'LOGIN',
    'UPDATE_SCORE',
    'CONFIRM_PAYMENT',
    'EXPORT_DATA',
  ] as const;
  const auditDocs = Array.from({ length: 80 }, (_, index) => {
    const actorId = index % 5 === 0 ? ownerId : staffIds[index % staffIds.length];
    const actorName = index % 5 === 0 ? owner.fullName : staffNames[index % staffNames.length];
    const createdAt = addDays(now, -index);
    return {
      _id: id(`audit-${index}`),
      seedSource: SEED_SOURCE,
      schemaVersion: 1,
      branchId,
      actorId,
      actorRole: index % 5 === 0 ? 'branch_owner' : 'staff',
      actorName,
      requestId: `seed-bm-${String(index + 1).padStart(4, '0')}`,
      action: auditActions[index % auditActions.length],
      targetType: index % 2 === 0 ? 'User' : 'Invoice',
      targetId:
        index % 2 === 0
          ? studentIds[index % studentIds.length]
          : invoiceDocs[index % invoiceDocs.length]._id,
      before: null,
      after: { seed: true },
      ipAddress: '127.0.0.1',
      userAgent: 'LCMS Binh Minh Seed',
      createdAt,
      expiresAt: addMonths(createdAt, 6),
    };
  });
  await insertMany('audit_logs', auditDocs);

  const summaryCollections = [
    'users',
    'classrooms',
    'classes',
    'enrollments',
    'class_sessions',
    'attendances',
    'assignments',
    'submissions',
    'question_bank',
    'exams',
    'exam_attempts',
    'grade_records',
    'invoices',
    'payments',
    'evaluation_forms',
    'class_announcements',
    'notifications',
    'messages',
    'audit_logs',
  ];
  const summary: Record<string, number> = {};
  for (const collection of summaryCollections) {
    summary[collection] = await db
      .collection(collection)
      .countDocuments({ seedSource: SEED_SOURCE });
  }

  console.log('\nSeed Cơ sở Bình Minh hoàn tất:');
  console.table(summary);
  console.log(`Tài khoản mock: giaovien1.binhminh@lcms.edu.vn / ${MOCK_PASSWORD}`);
  console.log(`Học viên mock: hocsinh01.binhminh@lcms.edu.vn / ${MOCK_PASSWORD}`);
  console.log(`Phụ huynh mock: phuhuynh01.binhminh@lcms.edu.vn / ${MOCK_PASSWORD}`);
};

seed()
  .catch(error => {
    console.error('Seed Cơ sở Bình Minh thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
