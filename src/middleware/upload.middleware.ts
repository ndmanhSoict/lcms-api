import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { BadRequestError } from '../shared/errors/AllErrors.js';

const SESSION_MATERIAL_DIR = path.join(process.cwd(), 'uploads', 'session-materials');
const ASSIGNMENT_ATTACHMENT_DIR = path.join(process.cwd(), 'uploads', 'assignments');
const SUBMISSION_ATTACHMENT_DIR = path.join(process.cwd(), 'uploads', 'submissions');
const MAX_SESSION_MATERIAL_SIZE = 10 * 1024 * 1024;
const MAX_ASSIGNMENT_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_SESSION_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_ASSIGNMENT_FILE_MIME_TYPES = new Set([
  ...ALLOWED_SESSION_MATERIAL_MIME_TYPES,
]);

fs.mkdirSync(SESSION_MATERIAL_DIR, { recursive: true });
fs.mkdirSync(ASSIGNMENT_ATTACHMENT_DIR, { recursive: true });
fs.mkdirSync(SUBMISSION_ATTACHMENT_DIR, { recursive: true });

const sessionMaterialStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, SESSION_MATERIAL_DIR);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

export const uploadSessionMaterial = multer({
  storage: sessionMaterialStorage,
  limits: { fileSize: MAX_SESSION_MATERIAL_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_SESSION_MATERIAL_MIME_TYPES.has(file.mimetype)) {
      cb(new BadRequestError('Chỉ hỗ trợ file ảnh, PDF hoặc Word'));
      return;
    }
    cb(null, true);
  },
});

function createStorage(uploadDir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${extension}`);
    },
  });
}

function assignmentFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!ALLOWED_ASSIGNMENT_FILE_MIME_TYPES.has(file.mimetype)) {
    cb(new BadRequestError('Chỉ hỗ trợ file ảnh, PDF hoặc Word'));
    return;
  }
  cb(null, true);
}

export const uploadAssignmentAttachments = multer({
  storage: createStorage(ASSIGNMENT_ATTACHMENT_DIR),
  limits: { fileSize: MAX_ASSIGNMENT_FILE_SIZE, files: 10 },
  fileFilter: assignmentFileFilter,
});

export const uploadSubmissionAttachments = multer({
  storage: createStorage(SUBMISSION_ATTACHMENT_DIR),
  limits: { fileSize: MAX_ASSIGNMENT_FILE_SIZE, files: 10 },
  fileFilter: assignmentFileFilter,
});
