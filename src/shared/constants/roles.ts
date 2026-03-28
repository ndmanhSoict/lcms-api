export const ROLES = {
  SYSTEM_OWNER: 'SYSTEM_OWNER',
  BRANCH_OWNER: 'BRANCH_OWNER',
  STAFF: 'STAFF',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];
