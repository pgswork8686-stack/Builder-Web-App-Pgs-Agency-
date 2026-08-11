import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateServiceDto,
  ServiceListQuery,
  UpdateServiceDto,
} from './dto/service.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(code: string, message: string, error: any): never {
    this.logger.error(`${code}: ${error?.message ?? 'unknown database error'}`);
    throw new InternalServerErrorException({ code, message });
  }

  async getServices(filters: ServiceListQuery) {
    const offset = (filters.page - 1) * filters.pageSize;
    let query = this.client.from('services').select('*', { count: 'exact' });
    if (filters.q) {
      const term = filters.q.trim();
      query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + filters.pageSize - 1);
    if (error) {
      this.databaseFailure(
        'SERVICES_LOOKUP_FAILED',
        'Không thể truy vấn danh mục dịch vụ.',
        error,
      );
    }
    const total = count ?? 0;
    return {
      items: data ?? [],
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async getServiceById(serviceId: string) {
    const { data, error } = await this.client
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();
    if (error) {
      this.databaseFailure(
        'SERVICE_LOOKUP_FAILED',
        'Không thể truy vấn dịch vụ.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Không tìm thấy dịch vụ.',
      });
    }
    return data;
  }

  async createService(dto: CreateServiceDto, actorUserId: string) {
    const { data: existing, error: existingError } = await this.client
      .from('services')
      .select('id')
      .eq('code', dto.code)
      .maybeSingle();
    if (existingError) {
      this.databaseFailure(
        'SERVICE_CODE_LOOKUP_FAILED',
        'Không thể kiểm tra mã dịch vụ.',
        existingError,
      );
    }
    if (existing) {
      throw new ConflictException({
        code: 'SERVICE_CODE_ALREADY_EXISTS',
        message: 'Mã dịch vụ đã tồn tại.',
      });
    }
    const { data, error } = await this.client
      .from('services')
      .insert({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        active: dto.active,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'SERVICE_CODE_ALREADY_EXISTS',
          message: 'Mã dịch vụ đã tồn tại.',
        });
      }
      this.databaseFailure(
        'SERVICE_CREATE_FAILED',
        'Không thể tạo dịch vụ.',
        error,
      );
    }
    return data;
  }

  async updateService(
    serviceId: string,
    dto: UpdateServiceDto,
    actorUserId: string,
  ) {
    await this.getServiceById(serviceId);
    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.code !== undefined) payload.code = dto.code;
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined)
      payload.description = dto.description ?? null;
    if (dto.active !== undefined) payload.active = dto.active;
    const { data, error } = await this.client
      .from('services')
      .update(payload)
      .eq('id', serviceId)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'SERVICE_CODE_ALREADY_EXISTS',
          message: 'Mã dịch vụ đã tồn tại.',
        });
      }
      this.databaseFailure(
        'SERVICE_UPDATE_FAILED',
        'Không thể cập nhật dịch vụ.',
        error,
      );
    }
    return data;
  }
}
