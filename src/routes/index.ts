import { Router } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { healthRouter } from './health.js';
import { authRouter } from '../modules/auth/auth.route.js';
import { branchRouter } from '../modules/branch/branch.route.js';
import { userRouter } from '../modules/user/user.route.js';
import { studentRouter } from '../modules/student/student.route.js';
import { classRouter } from '../modules/class/class.route.js';
import { enrollmentRouter } from '../modules/enrollment/enrollment.route.js';
import { classSessionRouter } from '../modules/classSession/classSession.route.js';
import { attendanceRouter } from '../modules/attendance/attendance.route.js';
import { assignmentRouter } from '../modules/assignment/assignment.route.js';
import { gradeRecordRouter } from '../modules/gradeRecord/gradeRecord.route.js';
import { financeRouter } from '../modules/finance/finance.route.js';
import { notificationRouter } from '../modules/notification/notification.route.js';
import { messageRouter } from '../modules/message/message.route.js';
import { reportRouter } from '../modules/report/report.route.js';
import { classAnnouncementRouter } from '../modules/classAnnouncement/classAnnouncement.route.js';
import { evaluationFormRouter } from '../modules/evaluationForm/evaluationForm.route.js';
import { teacherRouter } from '../modules/teacher/teacher.route.js';
import { parentRouter } from '../modules/parent/parent.route.js';
import { classroomRouter } from '../modules/classroom/classroom.route.js';
import { examRouter } from '../modules/exam/exam.route.js';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Swagger UI
const swaggerDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../swagger.yaml'), 'utf8')
) as object;

export const appRouter = Router();

const apiV1Router = Router();
appRouter.use('/health', healthRouter);
appRouter.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/branch', branchRouter);
apiV1Router.use('/user', userRouter);
apiV1Router.use('/teachers', teacherRouter);
apiV1Router.use('/parents', parentRouter);
apiV1Router.use('/classrooms', classroomRouter);
apiV1Router.use('/student', studentRouter);
apiV1Router.use('/class', classRouter);
apiV1Router.use('/enrollments', enrollmentRouter);
apiV1Router.use('/', financeRouter);
apiV1Router.use('/', classSessionRouter);
apiV1Router.use('/', attendanceRouter);
apiV1Router.use('/', assignmentRouter);
apiV1Router.use('/', gradeRecordRouter);
apiV1Router.use('/', notificationRouter);
apiV1Router.use('/', messageRouter);
apiV1Router.use('/', reportRouter);
apiV1Router.use('/', classAnnouncementRouter);
apiV1Router.use('/', evaluationFormRouter);
apiV1Router.use('/', examRouter);

appRouter.use('/api/v1', apiV1Router);
