import { SetMetadata } from '@nestjs/common';
import { AppPermission } from './permissions.types';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
