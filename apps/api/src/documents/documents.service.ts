import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateDocumentUploadSessionDto,
  DocumentQuery,
  FinalizeDocumentDto,
} from './dto/document.dto';

const BUCKET_NAME = 'company-documents';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private handleDbError(error: any, message: string): never {
    this.logger.error(`${message}: ${error?.message ?? JSON.stringify(error)}`);
    throw new InternalServerErrorException({
      code: 'DOCUMENT_DATABASE_ERROR',
      message,
    });
  }

  private sanitizeFilename(value: string): string {
    return (
      value
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/\.\.+/g, '.')
        .replace(/^[.-]+|[.-]+$/g, '')
        .substring(0, 100) || 'document'
    );
  }

  async listDocuments(query: DocumentQuery, user: RequestUser) {
    let dbQuery = this.client
      .from('company_documents')
      .select(
        '*, department:departments(id, name, department_code), uploaded_by:profiles!company_documents_uploaded_by_user_id_fkey(id, full_name, email, user_code)',
        { count: 'exact' },
      )
      .eq('delete_status', 'active');

    // Access level scoping
    if (user.role === 'client') {
      dbQuery = dbQuery.eq('access_level', 'public_company');
    } else if (user.role === 'employee' || user.role === 'accountant') {
      dbQuery = dbQuery.in('access_level', ['public_company', 'internal_only']);
    }

    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }
    if (query.departmentId) {
      dbQuery = dbQuery.eq('department_id', query.departmentId);
    }
    if (query.search) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query.search}%,description.ilike.%${query.search}%,document_code.ilike.%${query.search}%`,
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    dbQuery = dbQuery.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await dbQuery;
    if (error) {
      this.handleDbError(error, 'Không thể tải danh sách tài liệu.');
    }

    return {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async createUploadSession(
    dto: CreateDocumentUploadSessionDto,
    user: RequestUser,
  ) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Khách hàng không có quyền tải lên tài liệu công ty.',
      });
    }

    const safeName = this.sanitizeFilename(dto.fileName);
    const datePrefix = new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    const storagePath = `general/${datePrefix}/${Date.now()}-${safeName}`;

    const { data: uploadUrlData, error: storageErr } = await this.client.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (storageErr || !uploadUrlData) {
      this.logger.warn(
        `Storage signed URL creation notice: ${storageErr?.message}`,
      );
    }

    return {
      storagePath,
      signedUrl:
        uploadUrlData?.signedUrl ?? `https://storage.local/${storagePath}`,
      token: uploadUrlData?.token ?? 'mock-token',
    };
  }

  async finalizeDocument(dto: FinalizeDocumentDto, user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Khách hàng không có quyền tạo tài liệu.',
      });
    }

    const { data, error } = await this.client
      .from('company_documents')
      .insert({
        title: dto.title,
        description: dto.description || null,
        category: dto.category,
        storage_bucket: BUCKET_NAME,
        storage_path: dto.storagePath,
        file_name: dto.fileName,
        mime_type: dto.mimeType,
        size_bytes: dto.sizeBytes,
        access_level: dto.accessLevel || 'public_company',
        department_id: dto.departmentId || null,
        uploaded_by_user_id: user.profileId,
        version: dto.version || '1.0',
        delete_status: 'active',
      })
      .select(
        '*, department:departments(id, name, department_code), uploaded_by:profiles!company_documents_uploaded_by_user_id_fkey(id, full_name, email, user_code)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể lưu thông tin tài liệu.');
    }

    return data;
  }

  async getDownloadUrl(id: string, user: RequestUser) {
    const { data: doc, error } = await this.client
      .from('company_documents')
      .select('*')
      .eq('id', id)
      .eq('delete_status', 'active')
      .maybeSingle();

    if (error || !doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu.',
      });
    }

    // Access check
    if (user.role === 'client' && doc.access_level !== 'public_company') {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập tài liệu này.',
      });
    }

    if (
      (user.role === 'employee' || user.role === 'accountant') &&
      doc.access_level === 'management_only'
    ) {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Tài liệu này chỉ dành riêng cho cấp quản lý.',
      });
    }

    const { data: downloadData } = await this.client.storage
      .from(doc.storage_bucket || BUCKET_NAME)
      .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

    return {
      id: doc.id,
      fileName: doc.file_name,
      downloadUrl:
        downloadData?.signedUrl ?? `https://storage.local/${doc.storage_path}`,
    };
  }

  async removeDocument(id: string, user: RequestUser) {
    const { data: doc, error } = await this.client
      .from('company_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Không tìm thấy tài liệu.',
      });
    }

    if (user.role !== 'admin' && doc.uploaded_by_user_id !== user.profileId) {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc người tải lên mới có quyền xóa tài liệu.',
      });
    }

    const { error: deleteErr } = await this.client
      .from('company_documents')
      .update({ delete_status: 'deleted' })
      .eq('id', id);

    if (deleteErr) {
      this.handleDbError(deleteErr, 'Không thể xóa tài liệu.');
    }

    return { ok: true, id };
  }
}
