import { SetMetadata } from '@nestjs/common';

export type ScopeType = 'department' | 'project' | 'client' | 'self';

export const SCOPE_KEY = 'scope_type';
export const Scope = (type: ScopeType) => SetMetadata(SCOPE_KEY, type);
