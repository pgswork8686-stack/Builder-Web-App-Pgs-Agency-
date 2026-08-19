import {
  BadRequestException,
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
import { UpdateServiceResponsibilityDto } from './dto/service-responsibility.dto';

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
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name), delivery_items:service_delivery_items(id,delivery_item_code,name,sort_order,is_required,active), department_assignments:service_department_assignments(id,department_id,department_code,responsibility_role), team_assignments:service_team_assignments(id,team_id,team_code,department_code,responsibility_role)',
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
        '*, category:service_categories!services_service_category_id_fkey(id,code,service_category_code,name), delivery_items:service_delivery_items(*), department_assignments:service_department_assignments(id,department_id,department_code,responsibility_role), team_assignments:service_team_assignments(id,team_id,team_code,department_code,responsibility_role)',
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
  // SERVICE RESPONSIBILITY (Department / Team ownership)
  // ============================================================

  async getServiceResponsibilities(serviceId: string) {
    const { data: service, error: serviceError } = await this.client
      .from('services')
      .select('id,service_code,name')
      .eq('id', serviceId)
      .maybeSingle();

    if (serviceError) {
      this.databaseFailure(
        'SERVICE_RESPONSIBILITY_LOOKUP_FAILED',
        'Không thể kiểm tra dịch vụ.',
        serviceError,
      );
    }
    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Không tìm thấy dịch vụ.',
      });
    }

    const [departmentResult, teamResult] = await Promise.all([
      this.client
        .from('service_department_assignments')
        .select('id,department_id,department_code,responsibility_role')
        .eq('service_id', serviceId),
      this.client
        .from('service_team_assignments')
        .select('id,team_id,team_code,department_code,responsibility_role')
        .eq('service_id', serviceId),
    ]);

    if (departmentResult.error) {
      this.databaseFailure(
        'SERVICE_DEPARTMENT_RESPONSIBILITY_LOOKUP_FAILED',
        'Không thể truy vấn phòng ban phụ trách dịch vụ.',
        departmentResult.error,
      );
    }
    if (teamResult.error) {
      this.databaseFailure(
        'SERVICE_TEAM_RESPONSIBILITY_LOOKUP_FAILED',
        'Không thể truy vấn team phụ trách dịch vụ.',
        teamResult.error,
      );
    }

    const departments = departmentResult.data ?? [];
    const teams = teamResult.data ?? [];
    const ownerDepartment = departments.find(
      (row: any) => row.responsibility_role === 'owner',
    );
    const ownerTeam = teams.find(
      (row: any) => row.responsibility_role === 'owner',
    );

    return {
      serviceId: service.id,
      serviceCode: service.service_code,
      serviceName: service.name,
      ownerDepartment: ownerDepartment
        ? {
            id: ownerDepartment.department_id,
            code: ownerDepartment.department_code,
          }
        : null,
      ownerTeam: ownerTeam
        ? {
            id: ownerTeam.team_id,
            code: ownerTeam.team_code,
            departmentCode: ownerTeam.department_code,
          }
        : null,
      collaboratingDepartments: departments
        .filter((row: any) => row.responsibility_role === 'collaborator')
        .map((row: any) => ({
          id: row.department_id,
          code: row.department_code,
        })),
      collaboratingTeams: teams
        .filter((row: any) => row.responsibility_role === 'collaborator')
        .map((row: any) => ({
          id: row.team_id,
          code: row.team_code,
          departmentCode: row.department_code,
        })),
    };
  }

  async updateServiceResponsibilities(
    serviceId: string,
    dto: UpdateServiceResponsibilityDto,
    actorUserId: string,
  ) {
    await this.getServiceResponsibilities(serviceId);

    const collaboratorDepartmentIds = [
      ...new Set(dto.collaboratorDepartmentIds),
    ].filter((id) => id !== dto.ownerDepartmentId);
    const collaboratorTeamIds = [...new Set(dto.collaboratorTeamIds)].filter(
      (id) => id !== dto.ownerTeamId,
    );

    const departmentIds = [
      dto.ownerDepartmentId,
      ...collaboratorDepartmentIds,
    ];
    const { data: departments, error: departmentError } = await this.client
      .from('departments')
      .select('id,department_code,is_active')
      .in('id', departmentIds);

    if (
      departmentError ||
      !departments ||
      departments.length !== departmentIds.length ||
      departments.some((department: any) => !department.is_active)
    ) {
      throw new BadRequestException({
        code: 'SERVICE_RESPONSIBILITY_INVALID_DEPARTMENT',
        message: 'Phòng ban phụ trách/phối hợp không hợp lệ hoặc đã ngưng hoạt động.',
      });
    }

    const teamIds = [
      ...(dto.ownerTeamId ? [dto.ownerTeamId] : []),
      ...collaboratorTeamIds,
    ];
    let teams: any[] = [];
    if (teamIds.length > 0) {
      const { data, error } = await this.client
        .from('teams')
        .select('id,team_code,department_id,is_active')
        .in('id', teamIds);

      if (
        error ||
        !data ||
        data.length !== teamIds.length ||
        data.some((team: any) => !team.is_active)
      ) {
        throw new BadRequestException({
          code: 'SERVICE_RESPONSIBILITY_INVALID_TEAM',
          message: 'Team phụ trách/phối hợp không hợp lệ hoặc đã ngưng hoạt động.',
        });
      }
      teams = data;
    }

    if (dto.ownerTeamId) {
      const ownerTeam = teams.find((team: any) => team.id === dto.ownerTeamId);
      if (ownerTeam?.department_id !== dto.ownerDepartmentId) {
        throw new BadRequestException({
          code: 'SERVICE_OWNER_TEAM_DEPARTMENT_MISMATCH',
          message: 'Owner Team phải thuộc Owner Department của dịch vụ.',
        });
      }
    }

    const allowedTeamDepartmentIds = new Set(departmentIds);
    const invalidCollaboratorTeam = teams.find(
      (team: any) =>
        team.id !== dto.ownerTeamId &&
        !allowedTeamDepartmentIds.has(team.department_id),
    );
    if (invalidCollaboratorTeam) {
      throw new BadRequestException({
        code: 'SERVICE_COLLABORATOR_TEAM_DEPARTMENT_MISMATCH',
        message:
          'Team phối hợp phải thuộc Owner Department hoặc một Collaborating Department.',
      });
    }

    const [oldDepartmentResult, oldTeamResult] = await Promise.all([
      this.client
        .from('service_department_assignments')
        .select('*')
        .eq('service_id', serviceId),
      this.client
        .from('service_team_assignments')
        .select('*')
        .eq('service_id', serviceId),
    ]);
    if (oldDepartmentResult.error || oldTeamResult.error) {
      this.databaseFailure(
        'SERVICE_RESPONSIBILITY_SNAPSHOT_FAILED',
        'Không thể lưu trạng thái trách nhiệm hiện tại.',
        oldDepartmentResult.error ?? oldTeamResult.error,
      );
    }

    const rollback = async () => {
      await this.client
        .from('service_team_assignments')
        .delete()
        .eq('service_id', serviceId);
      await this.client
        .from('service_department_assignments')
        .delete()
        .eq('service_id', serviceId);

      if ((oldDepartmentResult.data ?? []).length > 0) {
        await this.client
          .from('service_department_assignments')
          .insert(oldDepartmentResult.data ?? []);
      }
      if ((oldTeamResult.data ?? []).length > 0) {
        await this.client
          .from('service_team_assignments')
          .insert(oldTeamResult.data ?? []);
      }
    };

    const { error: deleteTeamsError } = await this.client
      .from('service_team_assignments')
      .delete()
      .eq('service_id', serviceId);
    if (deleteTeamsError) {
      this.databaseFailure(
        'SERVICE_TEAM_RESPONSIBILITY_UPDATE_FAILED',
        'Không thể cập nhật Team phụ trách dịch vụ.',
        deleteTeamsError,
      );
    }

    const { error: deleteDepartmentsError } = await this.client
      .from('service_department_assignments')
      .delete()
      .eq('service_id', serviceId);
    if (deleteDepartmentsError) {
      await rollback();
      this.databaseFailure(
        'SERVICE_DEPARTMENT_RESPONSIBILITY_UPDATE_FAILED',
        'Không thể cập nhật phòng ban phụ trách dịch vụ.',
        deleteDepartmentsError,
      );
    }

    const departmentRows = [
      {
        service_id: serviceId,
        department_id: dto.ownerDepartmentId,
        responsibility_role: 'owner',
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      ...collaboratorDepartmentIds.map((departmentId) => ({
        service_id: serviceId,
        department_id: departmentId,
        responsibility_role: 'collaborator',
        created_by: actorUserId,
        updated_by: actorUserId,
      })),
    ];

    const { error: insertDepartmentsError } = await this.client
      .from('service_department_assignments')
      .insert(departmentRows);
    if (insertDepartmentsError) {
      await rollback();
      this.databaseFailure(
        'SERVICE_DEPARTMENT_RESPONSIBILITY_UPDATE_FAILED',
        'Không thể cập nhật phòng ban phụ trách dịch vụ.',
        insertDepartmentsError,
      );
    }

    const teamRows = [
      ...(dto.ownerTeamId
        ? [
            {
              service_id: serviceId,
              team_id: dto.ownerTeamId,
              responsibility_role: 'owner',
              created_by: actorUserId,
              updated_by: actorUserId,
            },
          ]
        : []),
      ...collaboratorTeamIds.map((teamId) => ({
        service_id: serviceId,
        team_id: teamId,
        responsibility_role: 'collaborator',
        created_by: actorUserId,
        updated_by: actorUserId,
      })),
    ];

    if (teamRows.length > 0) {
      const { error: insertTeamsError } = await this.client
        .from('service_team_assignments')
        .insert(teamRows);
      if (insertTeamsError) {
        await rollback();
        this.databaseFailure(
          'SERVICE_TEAM_RESPONSIBILITY_UPDATE_FAILED',
          'Không thể cập nhật Team phụ trách dịch vụ.',
          insertTeamsError,
        );
      }
    }

    return this.getServiceResponsibilities(serviceId);
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
        is_required: dto.isRequired ?? true,
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
    if (dto.isRequired !== undefined) payload.is_required = dto.isRequired;
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
