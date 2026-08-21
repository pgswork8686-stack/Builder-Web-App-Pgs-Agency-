import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import { SupportController } from './support.controller';

function rolesFor(method: keyof SupportController) {
  const descriptor = Object.getOwnPropertyDescriptor(
    SupportController.prototype,
    method,
  );
  return Reflect.getMetadata(ROLES_KEY, descriptor?.value);
}

describe('SupportController role boundaries', () => {
  it('does not grant accountants support access', () => {
    expect(rolesFor('listTickets')).toEqual([
      'admin',
      'team_leader',
      'employee',
      'client',
    ]);
    expect(rolesFor('getTicketById')).toEqual([
      'admin',
      'team_leader',
      'employee',
      'client',
    ]);
    expect(rolesFor('createMessage')).toEqual([
      'admin',
      'team_leader',
      'employee',
      'client',
    ]);
  });

  it('limits ticket creation and status changes to their least-privilege roles', () => {
    expect(rolesFor('createTicket')).toEqual(['admin', 'client']);
    expect(rolesFor('updateStatus')).toEqual(['admin', 'team_leader']);
  });
});
