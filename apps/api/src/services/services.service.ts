import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateServiceCategoryDto,
  ServiceCategoryQuery,
  UpdateServiceCategoryDto,
} from './dto/service-category.dto';
import {
  CreateServiceDeliveryItemDto,
  UpdateServiceDeliveryItemDto,
} from './dto/service-delivery-item.dto';
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

  // ============================================================
  // SERVICE CATEGORIES
  // ============================================================

  async getCategories(filters?: ServiceCategoryQuery) {
    let query = this.client
      .from('service_categories')
      .select('*, services:services(count)')
      .order('sort_order', { ascending: true })
      .order('service_category_code', { ascending: true });

    if (filters?.active !== undefined) {
      query = query.eq('active', filters.active);
    }
    if (filters?.q) {
      const term = filters.q.trim();
      query = query.or(
        `code.ilike.%${term}%,name.ilike.%${term}%,service_category_code.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      this.databaseFailure(
        'SERVICE_CATEGORIES_LOOKUP_FAILED',
        'Không thể truy vấn danh mục nhóm dịch vụ.',
        error,
      );
    }

    return (data ?? []).map((cat: any) => ({
      id: cat.id,
      serviceCategoryCode: cat.service_category_code,
      code: cat.code,
      name: cat.name,
      description: cat.description,
      sortOrder: cat.sort_order,
      active: cat.active,
      servicesCount: cat.services?.[0]?.count ?? 0,
      createdAt: cat.created_at,
      updatedAt: cat.updated_at,
    }));
  }

  async getCategoryById(categoryId: string) {
    const { data, error } = await this.client
      .from('service_categories')
      .select('*, services:services(count)')
      .eq('id', categoryId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'SERVICE_CATEGORY_LOOKUP_FAILED',
        'Không thể truy vấn nhóm dịch vụ.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'SERVICE_CATEGORY_NOT_FOUND',
        message: 'Không tìm thấy nhóm dịch vụ.',
      });
    }

    return {
      id: data.id,
      serviceCategoryCode: data.service_category_code,
      code: data.code,
      name: data.name,
      description: data.description,
      sortOrder: data.sort_order,
      active: data.active,
      servicesCount: data.services?.[0]?.count ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createCategory(dto: CreateServiceCategoryDto, actorUserId: string) {
    const { data: existing } = await this.client
      .from('service_categories')
      .select('id')
      .eq('code', dto.code)
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'SERVICE_CATEGORY_CODE_ALREADY_EXISTS',
        message: 'Mã nhóm dịch vụ đã tồn tại.',
      });
    }

    const { data, error } = await this.client
      .from('service_categories')
      .insert({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        sort_order: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'SERVICE_CATEGORY_CODE_ALREADY_EXISTS',
          message: 'Mã nhóm dịch vụ đã tồn tại.',
        });
      }
      this.databaseFailure(
        'SERVICE_CATEGORY_CREATE_FAILED',
        'Không thể tạo nhóm dịch vụ.',
        error,
      );
    }

    return data;
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateServiceCategoryDto,
    actorUserId: string,
  ) {
    await this.getCategoryById(categoryId);

    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.code !== undefined) payload.code = dto.code;
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined)
      payload.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;
    if (dto.active !== undefined) payload.active = dto.active;

    const { data, error } = await this.client
      .from('service_categories')
      .update(payload)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException({
          code: 'SERVICE_CATEGORY_CODE_ALREADY_EXISTS',
          message: 'Mã nhóm dịch vụ đã tồn tại.',
        });
      }
      this.databaseFailure(
        'SERVICE_CATEGORY_UPDATE_FAILED',
        'Không thể cập nhật nhóm dịch vụ.',
        error,
      );
    }

    return data;
  }

  async deactivateCategory(categoryId: string, actorUserId: string) {
    return this.updateCategory(categoryId, { active: false }, actorUserId);
  }

  // ============================================================
  // SERVICES
  // ============================================================

  async getServices(filters: ServiceListQuery) {
    const offset = (filters.page - 1) * filters.pageSize;
    let query = this.client
      .from('services')
      .select(
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name), delivery_items:service_delivery_items(id,delivery_item_code,name,sort_order,active)',
        { count: 'exact' },
      );

    if (filters.q) {
      const term = filters.q.trim();
      query = query.or(
        `code.ilike.%${term}%,name.ilike.%${term}%,service_code.ilike.%${term}%`,
      );
    }
    if (filters.categoryId) {
      query = query.eq('service_category_id', filters.categoryId);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    const { data, count, error } = await query
      .order('sort_order', { ascending: true })
      .order('service_code', { ascending: true })
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
      .select(
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name), delivery_items:service_delivery_items(*)',
      )
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

    // Sort delivery items by sort_order
    if (data.delivery_items && Array.isArray(data.delivery_items)) {
      data.delivery_items.sort(
        (a: any, b: any) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          (a.delivery_item_code ?? '').localeCompare(
            b.delivery_item_code ?? '',
          ),
      );
    }

    return data;
  }

  async createService(dto: CreateServiceDto, actorUserId: string) {
    if (dto.categoryId) {
      await this.getCategoryById(dto.categoryId);
    }

    const payload: Record<string, unknown> = {
      name: dto.name,
      description: dto.description ?? null,
      service_category_id: dto.categoryId ?? null,
      sort_order: dto.sortOrder,
      active: dto.active,
      created_by: actorUserId,
      updated_by: actorUserId,
    };

    if (dto.code) {
      const { data: existing } = await this.client
        .from('services')
        .select('id')
        .eq('code', dto.code)
        .maybeSingle();

      if (existing) {
        throw new ConflictException({
          code: 'SERVICE_CODE_ALREADY_EXISTS',
          message: 'Mã dịch vụ đã tồn tại.',
        });
      }
      payload.code = dto.code;
    } else {
      payload.code = `DV_AUTO_${Date.now()}`;
    }

    const { data, error } = await this.client
      .from('services')
      .insert(payload)
      .select(
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name)',
      )
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

    if (dto.categoryId) {
      await this.getCategoryById(dto.categoryId);
    }

    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.code !== undefined) payload.code = dto.code;
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined)
      payload.description = dto.description ?? null;
    if (dto.categoryId !== undefined)
      payload.service_category_id = dto.categoryId;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;
    if (dto.active !== undefined) payload.active = dto.active;

    const { data, error } = await this.client
      .from('services')
      .update(payload)
      .eq('id', serviceId)
      .select(
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name)',
      )
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

  async deactivateService(serviceId: string, actorUserId: string) {
    return this.updateService(serviceId, { active: false }, actorUserId);
  }

  // ============================================================
  // SERVICE DELIVERY ITEMS (Standard Template Items)
  // ============================================================

  async getDeliveryItems(serviceId: string) {
    await this.getServiceById(serviceId);

    const { data, error } = await this.client
      .from('service_delivery_items')
      .select('*')
      .eq('service_id', serviceId)
      .order('sort_order', { ascending: true })
      .order('delivery_item_code', { ascending: true });

    if (error) {
      this.databaseFailure(
        'DELIVERY_ITEMS_LOOKUP_FAILED',
        'Không thể truy vấn hạng mục triển khai chuẩn.',
        error,
      );
    }

    return data ?? [];
  }

  async createDeliveryItem(
    serviceId: string,
    dto: CreateServiceDeliveryItemDto,
    actorUserId: string,
  ) {
    const service = await this.getServiceById(serviceId);

    const { data, error } = await this.client
      .from('service_delivery_items')
      .insert({
        service_id: service.id,
        name: dto.name,
        description: dto.description ?? null,
        sort_order: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        created_by: actorUserId,
        updated_by: actorUserId,
      })
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'DELIVERY_ITEM_CREATE_FAILED',
        'Không thể tạo hạng mục triển khai chuẩn.',
        error,
      );
    }

    return data;
  }

  async updateDeliveryItem(
    serviceId: string,
    itemId: string,
    dto: UpdateServiceDeliveryItemDto,
    actorUserId: string,
  ) {
    const { data: item, error: itemError } = await this.client
      .from('service_delivery_items')
      .select('*')
      .eq('id', itemId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (itemError) {
      this.databaseFailure(
        'DELIVERY_ITEM_LOOKUP_FAILED',
        'Không thể kiểm tra hạng mục chuẩn.',
        itemError,
      );
    }
    if (!item) {
      throw new NotFoundException({
        code: 'DELIVERY_ITEM_NOT_FOUND',
        message: 'Không tìm thấy hạng mục triển khai chuẩn.',
      });
    }

    const payload: Record<string, unknown> = { updated_by: actorUserId };
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined)
      payload.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;
    if (dto.active !== undefined) payload.active = dto.active;

    const { data, error } = await this.client
      .from('service_delivery_items')
      .update(payload)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'DELIVERY_ITEM_UPDATE_FAILED',
        'Không thể cập nhật hạng mục triển khai chuẩn.',
        error,
      );
    }

    return data;
  }

  async deleteDeliveryItem(
    serviceId: string,
    itemId: string,
    actorUserId: string,
  ) {
    const { count, error: countErr } = await this.client
      .from('project_service_items')
      .select('*', { count: 'exact', head: true })
      .eq('source_delivery_item_id', itemId);

    if (!countErr && count && count > 0) {
      return this.updateDeliveryItem(
        serviceId,
        itemId,
        { active: false },
        actorUserId,
      );
    }

    const { error } = await this.client
      .from('service_delivery_items')
      .delete()
      .eq('id', itemId)
      .eq('service_id', serviceId);

    if (error) {
      this.databaseFailure(
        'DELIVERY_ITEM_DELETE_FAILED',
        'Không thể xóa hạng mục triển khai chuẩn.',
        error,
      );
    }

    return { success: true };
  }
}
