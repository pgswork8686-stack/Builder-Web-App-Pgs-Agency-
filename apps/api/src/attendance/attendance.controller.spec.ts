import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import { AttendanceController } from './attendance.controller';

function rolesFor(methodName: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    AttendanceController.prototype,
    methodName,
  );
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new Error(`Missing controller method: ${methodName}`);
  }
  return Reflect.getMetadata(ROLES_KEY, descriptor.value);
}

describe('AttendanceController settings access', () => {
  it('declares the canonical settings routes as admin-only', () => {
    expect(rolesFor('getSettings')).toEqual(['admin']);
    expect(rolesFor('updateSettings')).toEqual(['admin']);
  });

  it('exposes the redacted policy only to internal roles', () => {
    expect(rolesFor('getPolicy')).toEqual([
      'admin',
      'team_leader',
      'employee',
      'accountant',
    ]);
  });
});
