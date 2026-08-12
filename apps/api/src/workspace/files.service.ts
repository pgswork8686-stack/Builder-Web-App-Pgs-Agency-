import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AllowedFileMimeSchema,
  type FileListQuery,
  type FinalizeFileDto,
  type UploadRequestDto,
} from './dto/workspace.dto';
import {
  WorkspaceAccessService,
  type WorkspaceProjectAccess,
} from './workspace-access.service';
import {
  WorkspaceRealtimeGateway,
  type WorkspaceEvent,
} from './workspace-realtime.gateway';

const FILE_BUCKET = 'project-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const UPLOAD_SESSION_MS = 15 * 60 * 1000;
const DOWNLOAD_SECONDS = 120;

const MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: WorkspaceAccessService,
    private readonly realtime: WorkspaceRealtimeGateway,
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

  private emit(event: WorkspaceEvent): void {
    try {
      this.realtime.emitProjectEvent(event);
    } catch (error) {
      this.logger.error(
        `Realtime file broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private sanitizeFilename(value: string): string {
    const withoutControls = Array.from(value.normalize('NFKD'))
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .replaceAll('/', '-')
      .replaceAll('\\', '-');
    const normalized = withoutControls
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\.\.+/g, '.')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .replace(/-+/g, '-')
      .substring(0, 120);
    return normalized || 'file';
  }

  private safeDownloadName(value: string): string {
    return Array.from(value)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .replaceAll('"', '-')
      .replaceAll('\\', '-')
      .replaceAll('/', '-')
      .trim()
      .substring(0, 180);
  }

  private validateFile(dto: UploadRequestDto): void {
    const parsedMime = AllowedFileMimeSchema.safeParse(dto.mimeType);
    const extension = dto.fileName.includes('.')
      ? dto.fileName.split('.').pop()?.toLowerCase()
      : undefined;
    if (
      !parsedMime.success ||
      !extension ||
      !MIME_EXTENSIONS[dto.mimeType]?.includes(extension)
    ) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'Loại tệp này không được phép tải lên.',
      });
    }
    if (dto.sizeBytes > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Tệp vượt quá giới hạn 25 MB.',
      });
    }
  }

  private buildStoragePath(
    projectId: string,
    taskId: string | null,
    originalName: string,
  ): string {
    const safeName = this.sanitizeFilename(originalName);
    const objectName = `${randomUUID()}-${safeName}`;
    if (taskId) return `projects/${projectId}/tasks/${taskId}/${objectName}`;
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `projects/${projectId}/${year}/${month}/${objectName}`;
  }

  private async requireFileAccess(
    projectId: string,
    user: RequestUser,
  ): Promise<WorkspaceProjectAccess> {
    return this.accessService.requireProjectAccess(
      projectId,
      user,
      'FILE_ACCESS_DENIED',
    );
  }

  private requireUpload(access: WorkspaceProjectAccess): void {
    if (access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message: 'Người xem chỉ có quyền đọc tệp.',
      });
    }
  }

  private mapFile(
    row: Record<string, any>,
    access: WorkspaceProjectAccess,
    user: RequestUser,
  ) {
    const active = row.delete_status === 'active';
    const readOnly = access.projectRole === 'viewer';
    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id ?? null,
      uploadedBy: row.uploaded_by,
      uploader: row.uploader ?? null,
      task: row.task ?? null,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      fileCategory: row.file_category ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      canDelete:
        active &&
        !readOnly &&
        (access.isManager || row.uploaded_by === user.profileId),
    };
  }

  private async bestEffortRemove(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(FILE_BUCKET)
      .remove([path]);
    if (error) this.logger.error(`Storage cleanup failed: ${error.message}`);
  }

  private isMissingStorageObject(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    return (
      candidate.code === 'NoSuchKey' ||
      candidate.status === 404 ||
      candidate.statusCode === '404'
    );
  }

  async list(
    projectId: string,
    filters: FileListQuery,
    user: RequestUser,
    taskId?: string,
  ) {
    const access = await this.requireFileAccess(projectId, user);
    const effectiveTaskId = taskId ?? filters.taskId;
    if (effectiveTaskId) {
      await this.accessService.requireTask(
        projectId,
        effectiveTaskId,
        'FILE_ACCESS_DENIED',
      );
    }
    const offset = (filters.page - 1) * filters.pageSize;
    let query = this.client
      .from('project_files')
      .select(
        '*,uploader:profiles!project_files_uploaded_by_fkey(id,full_name,email,avatar_url),task:tasks!project_files_task_id_fkey(id,title)',
        { count: 'exact' },
      );
    query = query.eq('project_id', projectId);
    query = query.eq('delete_status', 'active');
    if (effectiveTaskId) query = query.eq('task_id', effectiveTaskId);
    if (filters.mimeType) query = query.eq('mime_type', filters.mimeType);
    if (filters.q) query = query.ilike('original_name', `%${filters.q}%`);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + filters.pageSize - 1);
    if (error) {
      this.databaseFailure(
        'FILES_LOOKUP_FAILED',
        'Không thể tải danh sách tệp lúc này.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapFile(row, access, user)),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async createUploadRequest(
    projectId: string,
    dto: UploadRequestDto,
    user: RequestUser,
    taskId?: string,
  ) {
    const access = await this.requireFileAccess(projectId, user);
    this.requireUpload(access);
    this.validateFile(dto);
    if (taskId) {
      await this.accessService.requireTask(
        projectId,
        taskId,
        'FILE_ACCESS_DENIED',
      );
    }

    const storagePath = this.buildStoragePath(
      projectId,
      taskId ?? null,
      dto.fileName,
    );
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_MS).toISOString();
    const { data: session, error: sessionError } = await this.client
      .from('file_upload_sessions')
      .insert({
        project_id: projectId,
        task_id: taskId ?? null,
        user_id: user.profileId,
        storage_bucket: FILE_BUCKET,
        storage_path: storagePath,
        expected_name: dto.fileName,
        expected_mime: dto.mimeType,
        expected_size: dto.sizeBytes,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (sessionError) {
      this.databaseFailure(
        'FILE_UPLOAD_REQUEST_FAILED',
        'Không thể khởi tạo phiên tải tệp.',
        sessionError,
      );
    }

    const { data: signed, error: signedError } = await this.client.storage
      .from(FILE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (signedError || !signed) {
      await this.client
        .from('file_upload_sessions')
        .delete()
        .eq('id', session.id);
      this.databaseFailure(
        'FILE_UPLOAD_REQUEST_FAILED',
        'Không thể cấp quyền tải tệp lúc này.',
        signedError,
      );
    }

    return {
      uploadSessionId: session.id,
      bucket: FILE_BUCKET,
      path: storagePath,
      signedUrl: signed.signedUrl,
      token: signed.token,
      expiresAt,
    };
  }

  private async getUploadSession(
    projectId: string,
    sessionId: string,
    userId: string,
  ) {
    const { data, error } = await this.client
      .from('file_upload_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'FILE_UPLOAD_SESSION_LOOKUP_FAILED',
        'Không thể kiểm tra phiên tải tệp.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'FILE_UPLOAD_SESSION_NOT_FOUND',
        message: 'Không tìm thấy phiên tải tệp.',
      });
    }
    if (
      !data.completed_at &&
      new Date(data.expires_at).getTime() <= Date.now()
    ) {
      await this.bestEffortRemove(data.storage_path);
      await this.client.from('file_upload_sessions').delete().eq('id', data.id);
      throw new ForbiddenException({
        code: 'FILE_UPLOAD_SESSION_EXPIRED',
        message: 'Phiên tải tệp đã hết hạn.',
      });
    }
    return data as Record<string, any>;
  }

  private async verifyStorageObject(session: Record<string, any>) {
    const separator = session.storage_path.lastIndexOf('/');
    const folder = session.storage_path.substring(0, separator);
    const name = session.storage_path.substring(separator + 1);
    const { data, error } = await this.client.storage
      .from(FILE_BUCKET)
      .list(folder, { limit: 100, search: name });
    if (error) {
      this.databaseFailure(
        'FILE_STORAGE_VERIFY_FAILED',
        'Không thể kiểm tra tệp đã tải lên.',
        error,
      );
    }
    const object = (data ?? []).find((item) => item.name === name);
    if (!object) {
      throw new NotFoundException({
        code: 'FILE_STORAGE_OBJECT_NOT_FOUND',
        message: 'Không tìm thấy tệp trong kho lưu trữ.',
      });
    }
    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const size = Number(metadata.size ?? 0);
    const mimeValue = metadata.mimetype ?? metadata.contentType;
    const mime = typeof mimeValue === 'string' ? mimeValue : '';
    if (
      size !== Number(session.expected_size) ||
      (mime && mime !== session.expected_mime)
    ) {
      await this.bestEffortRemove(session.storage_path);
      await this.client
        .from('file_upload_sessions')
        .delete()
        .eq('id', session.id);
      throw new BadRequestException({
        code: 'FILE_FINALIZE_INVALID',
        message: 'Thông tin tệp tải lên không khớp phiên đã cấp.',
      });
    }
  }

  async finalize(
    projectId: string,
    dto: FinalizeFileDto,
    user: RequestUser,
    taskId?: string,
  ) {
    const access = await this.requireFileAccess(projectId, user);
    this.requireUpload(access);
    const session = await this.getUploadSession(
      projectId,
      dto.uploadSessionId,
      user.profileId,
    );
    if ((session.task_id ?? null) !== (taskId ?? null)) {
      throw new ForbiddenException({
        code: 'FILE_FINALIZE_INVALID',
        message: 'Phiên tải tệp không thuộc phạm vi được yêu cầu.',
      });
    }
    if (taskId) {
      await this.accessService.requireTask(
        projectId,
        taskId,
        'FILE_ACCESS_DENIED',
      );
    }
    const alreadyCompleted = Boolean(session.completed_at);
    if (!alreadyCompleted) {
      await this.verifyStorageObject(session);
    }

    const { data, error } = await this.client.rpc(
      'phase4_finalize_project_file',
      { p_session_id: session.id, p_user_id: user.profileId },
    );
    let finalized = Array.isArray(data) ? data[0] : data;
    if (error || !finalized) {
      const { data: existing, error: existingError } = await this.client
        .from('project_files')
        .select('*')
        .eq('storage_path', session.storage_path)
        .maybeSingle();
      if (existing) {
        finalized = existing;
      } else {
        if (!alreadyCompleted) {
          await this.bestEffortRemove(session.storage_path);
        }
        const errorMessage = String(error?.message ?? 'FILE_FINALIZE_INVALID');
        if (errorMessage.includes('FILE_UPLOAD_SESSION_EXPIRED')) {
          throw new ForbiddenException({
            code: 'FILE_UPLOAD_SESSION_EXPIRED',
            message: 'Phiên tải tệp đã hết hạn.',
          });
        }
        this.databaseFailure(
          'FILE_FINALIZE_INVALID',
          'Không thể hoàn tất tải tệp lúc này.',
          error ?? existingError,
        );
      }
    }

    if (finalized.delete_status !== 'active') {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy tệp.',
      });
    }

    if (!alreadyCompleted) {
      this.emit({
        projectId,
        entityId: finalized.id,
        event: 'file.created',
        updatedAt: finalized.updated_at,
        changes: { taskId: finalized.task_id ?? null },
      });
    }
    return this.mapFile(finalized, access, user);
  }

  private async getFile(fileId: string) {
    const { data, error } = await this.client
      .from('project_files')
      .select(
        '*,uploader:profiles!project_files_uploaded_by_fkey(id,full_name,email,avatar_url),task:tasks!project_files_task_id_fkey(id,title,project_id)',
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
    if (!data) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy tệp.',
      });
    }
    return data as Record<string, any>;
  }

  async download(projectId: string, fileId: string, user: RequestUser) {
    await this.requireFileAccess(projectId, user);
    const file = await this.getFile(fileId);
    if (file.project_id !== projectId) {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message: 'Tệp không thuộc dự án được yêu cầu.',
      });
    }
    if (file.delete_status !== 'active') {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy tệp.',
      });
    }
    if (file.task_id) {
      await this.accessService.requireTask(
        projectId,
        file.task_id,
        'FILE_ACCESS_DENIED',
      );
    }
    const downloadName =
      this.safeDownloadName(file.original_name) || 'download';
    const { data, error } = await this.client.storage
      .from(FILE_BUCKET)
      .createSignedUrl(file.storage_path, DOWNLOAD_SECONDS, {
        download: downloadName,
      });
    if (error || !data) {
      this.databaseFailure(
        'FILE_STORAGE_OBJECT_NOT_FOUND',
        'Không thể tạo liên kết tải tệp.',
        error,
      );
    }
    return { signedUrl: data.signedUrl, expiresIn: DOWNLOAD_SECONDS };
  }

  async remove(projectId: string, fileId: string, user: RequestUser) {
    const access = await this.requireFileAccess(projectId, user);
    if (access.projectRole === 'viewer') {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message: 'Người xem chỉ có quyền đọc tệp.',
      });
    }
    const file = await this.getFile(fileId);
    if (file.project_id !== projectId) {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message: 'Tệp không thuộc dự án được yêu cầu.',
      });
    }
    if (!access.isManager && file.uploaded_by !== user.profileId) {
      throw new ForbiddenException({
        code: 'FILE_ACCESS_DENIED',
        message: 'Bạn không có quyền xóa tệp này.',
      });
    }

    const { data: markedData, error: markError } = await this.client.rpc(
      'phase4_request_project_file_delete',
      { p_file_id: fileId },
    );
    const marked = Array.isArray(markedData) ? markedData[0] : markedData;
    if (markError || !marked) {
      this.databaseFailure(
        'FILE_DELETE_FAILED',
        'Không thể bắt đầu xóa tệp.',
        markError,
      );
    }

    const { error: storageError } = await this.client.storage
      .from(FILE_BUCKET)
      .remove([marked.storage_path]);
    if (storageError && !this.isMissingStorageObject(storageError)) {
      this.logger.error(`Storage delete failed: ${storageError.message}`);
      const { error: restoreError } = await this.client.rpc(
        'phase4_restore_project_file_delete',
        { p_file_id: fileId },
      );
      if (restoreError) {
        this.logger.error(
          `File delete state restore failed: ${restoreError.message}`,
        );
      }
      throw new InternalServerErrorException({
        code: 'FILE_DELETE_FAILED',
        message: 'Không thể xóa tệp khỏi kho lưu trữ.',
      });
    }
    if (storageError) {
      this.logger.warn(
        `Storage object was already absent during delete retry: ${marked.storage_path}`,
      );
    }

    const { error: databaseError } = await this.client.rpc(
      'phase4_finalize_project_file_delete',
      { p_file_id: fileId },
    );
    if (databaseError) {
      this.databaseFailure(
        'FILE_DELETE_FAILED',
        'Không thể hoàn tất xóa tệp.',
        databaseError,
      );
    }
    this.emit({
      projectId,
      entityId: fileId,
      event: 'file.deleted',
      updatedAt: new Date().toISOString(),
      changes: { taskId: marked.task_id ?? null },
    });
    return { success: true };
  }
}
