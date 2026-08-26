export type AppPermission =
  // Projects
  | 'projects:create'
  | 'projects:read'
  | 'projects:update'
  | 'projects:delete'
  | 'projects:manage_members'
  // Tasks
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:update'
  | 'tasks:delete'
  // Attendance & Leave
  | 'attendance:check_in'
  | 'attendance:read'
  | 'attendance:manage'
  | 'leave:apply'
  | 'leave:approve'
  // Finance
  | 'finance:read'
  | 'finance:manage'
  // Services & Catalog
  | 'services:read'
  | 'services:manage'
  // Administration
  | 'users:manage'
  | 'settings:manage';
