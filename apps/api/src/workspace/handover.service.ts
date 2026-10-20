import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkspaceAccessService } from './workspace-access.service';

const FILE_BUCKET = 'project-files';
const DOWNLOAD_SECONDS = 120;

/**
 * project_files.file_category value that marks a file as handed over to the
 * client. Reusing the existing free-text column keeps this feature free of
 * schema changes; only files carrying it are ever visible to a client.
 */
export const HANDOVER_CATEGORY = 'client_handover';

/**
 * Handover documents: internal managers mark project files for the client, the
 * client lists and downloads ONLY those, scoped to its own company's projects.
 * Project files themselves stay closed to clients (WorkspaceAccessService).
 */
@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: WorkspaceAccessService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(
    code: string,
    message: string,
    error: unknown,
  ): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({ code, message });
  }

  /** Active client company members (user ids) of one company. */
  private async clientMembers(companyId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('client_memberships')
      .select(
        'user_id, profile:profiles!client_memberships_user_id_fkey(account_status)',
      )
      .eq('client_company_id', companyId);
    if (error) {
      this.databaseFailure(
        'HANDOVER_MEMBERS_LOOKUP_FAILED',
        'Không thể xác định người nhận.',
        error,
      );
    }
    return (data ?? [])
      .filter((row) => {
        const profile = Array.isArray(row.profile)
          ? row.profile[0]
          : row.profile;
        return profile?.account_status === 'active';
      })
      .map((row) => String(row.user_id));
  }

  /** Mark / unmark a project file as handed over (managers only, idempotent). */
  async setHandover(
    projectId: string,
    fileId: string,
    clientVisible: boolean,
    user: RequestUser,
  ) {
    const access = await this.accessService.requireProjectAccess(
      projectId,
      user,
      'FILE_ACCESS_DENIED',
    );
    if (!access.isManager) {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message:
          'Chỉ quản lý dự án mới có thể bàn giao tài liệu cho khách hàng.',
      });
    }
    const { data: file, error } = await this.client
      .from('project_files')
      .select('id,project_id,original_name,file_category,delete_status')
      .eq('id', fileId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'FILE_LOOKUP_FAILED',
        'Không thể truy vấn tệp.',
        error,
      );
    }
    if (
      !file ||
      file.project_id !== projectId ||
      file.delete_status !== 'active'
    ) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy tệp trong dự án.',
      });
    }
    const handedOver = file.file_category === HANDOVER_CATEGORY;
    if (handedOver === clientVisible) {
      return { id: file.id, clientVisible, changed: false };
    }
    const { error: updateError } = await this.client
      .from('project_files')
      .update({ file_category: clientVisible ? HANDOVER_CATEGORY : null })
      .eq('id', fileId);
    if (updateError) {
      this.databaseFailure(
        'HANDOVER_UPDATE_FAILED',
        'Không thể cập nhật trạng thái bàn giao.',
        updateError,
      );
    }
    if (clientVisible) {
      await this.notifyHandedOver(projectId, String(file.original_name), user);
    }
    return { id: file.id, clientVisible, changed: true };
  }

  private async notifyHandedOver(
    projectId: string,
    fileName: string,
    actor: RequestUser,
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const { data: project } = await this.client
        .from('projects')
        .select('project_code,name,client_company_id')
        .eq('id', projectId)
        .maybeSingle();
      if (!project) return;
      const recipients = await this.clientMembers(
        String(project.client_company_id),
      );
      await this.notifications.createForUsers(recipients, {
        type: 'project.handover_document',
        title: 'Có tài liệu bàn giao mới',
        message: `Tài liệu "${fileName}" của dự án ${project.project_code} · ${project.name} đã được bàn giao cho bạn.`,
        entityType: 'project',
        entityId: projectId,
        actionUrl: '/app/client/documents',
        metadata: { projectId },
        actorUserId: actor.profileId,
      });
    } catch (error) {
      this.logger.error(
        `Handover notification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private requireClient(user: RequestUser): void {
    if (user.role !== 'client') {
      throw new ForbiddenException({
        code: 'HANDOVER_ACCESS_DENIED',
        message: 'Chỉ khách hàng mới xem tài liệu bàn giao.',
      });
    }
  }

  /** Projects (id -> row) of the client's company memberships. */
  private async clientProjects(userId: string) {
    const { data: memberships, error } = await this.client
      .from('client_memberships')
      .select('client_company_id')
      .eq('user_id', userId);
    if (error) {
      this.databaseFailure(
        'HANDOVER_SCOPE_FAILED',
        'Không thể xác định phạm vi khách hàng.',
        error,
      );
    }
    const companyIds = [
      ...new Set(
        (memberships ?? []).map((row) => String(row.client_company_id)),
      ),
    ];
    const projects = new Map<string, Record<string, any>>();
    if (companyIds.length === 0) return projects;
    const { data, error: projectError } = await this.client
      .from('projects')
      .select('id,project_code,name,status')
      .in('client_company_id', companyIds);
    if (projectError) {
      this.databaseFailure(
        'HANDOVER_SCOPE_FAILED',
        'Không thể xác định dự án của khách hàng.',
        projectError,
      );
    }
    for (const project of data ?? []) projects.set(String(project.id), project);
    return projects;
  }

  /** The client's handed-over files across its projects (paginated). */
  async listForClient(
    user: RequestUser,
    query: { page: number; pageSize: number; projectId?: string },
  ) {
    this.requireClient(user);
    const projects = await this.clientProjects(user.profileId);
    const empty = {
      items: [] as Array<Record<string, unknown>>,
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      totalPages: 0,
    };
    let projectIds = [...projects.keys()];
    if (query.projectId) {
      if (!projects.has(query.projectId)) {
        throw new NotFoundException({
          code: 'PROJECT_NOT_FOUND',
          message: 'Không tìm thấy dự án.',
        });
      }
      projectIds = [query.projectId];
    }
    if (projectIds.length === 0) return empty;
    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await this.client
      .from('project_files')
      .select('id,project_id,original_name,mime_type,size_bytes,updated_at', {
        count: 'exact',
      })
      .in('project_id', projectIds)
      .eq('file_category', HANDOVER_CATEGORY)
      .eq('delete_status', 'active')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + query.pageSize - 1);
    if (error) {
      this.databaseFailure(
        'HANDOVER_LIST_FAILED',
        'Không thể tải tài liệu bàn giao.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      ...empty,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      items: (data ?? []).map((row) => {
        const project = projects.get(String(row.project_id));
        return {
          id: row.id,
          projectId: row.project_id,
          projectCode: project?.project_code ?? null,
          projectName: project?.name ?? null,
          projectStatus: project?.status ?? null,
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          handedOverAt: row.updated_at,
        };
      }),
    };
  }

  /** Short-lived signed URL for a handed-over file of the client's own company. */
  async downloadForClient(fileId: string, user: RequestUser) {
    this.requireClient(user);
    const { data: file, error } = await this.client
      .from('project_files')
      .select(
        'id,project_id,original_name,storage_path,file_category,delete_status',
      )
      .eq('id', fileId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'FILE_LOOKUP_FAILED',
        'Không thể truy vấn tệp.',
        error,
      );
    }
    const projects = await this.clientProjects(user.profileId);
    // Same answer for "missing", "not yours" and "not handed over": no probing.
    if (
      !file ||
      file.delete_status !== 'active' ||
      file.file_category !== HANDOVER_CATEGORY ||
      !projects.has(String(file.project_id))
    ) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy tài liệu bàn giao.',
      });
    }
    const downloadName = Array.from(String(file.original_name))
      .map((character) => {
        const code = character.charCodeAt(0);
        return code < 32 ||
          code === 127 ||
          character === '"' ||
          character === '\\' ||
          character === '/'
          ? '-'
          : character;
      })
      .join('')
      .trim()
      .substring(0, 180);
    const { data, error: signError } = await this.client.storage
      .from(FILE_BUCKET)
      .createSignedUrl(String(file.storage_path), DOWNLOAD_SECONDS, {
        download: downloadName || 'download',
      });
    if (signError || !data) {
      this.databaseFailure(
        'FILE_STORAGE_OBJECT_NOT_FOUND',
        'Không thể tạo liên kết tải tệp.',
        signError,
      );
    }
    return { signedUrl: data.signedUrl, expiresIn: DOWNLOAD_SECONDS };
  }

  /** Validation helper shared by the controller. */
  static parseClientVisible(body: unknown): boolean {
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as { clientVisible?: unknown }).clientVisible !== 'boolean'
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'clientVisible phải là true hoặc false.',
      });
    }
    return (body as { clientVisible: boolean }).clientVisible;
  }
}
