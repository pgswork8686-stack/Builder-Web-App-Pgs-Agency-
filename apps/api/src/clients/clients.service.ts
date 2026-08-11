import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateClientCompanyDto,
  UpdateClientCompanyDto,
  CreateClientMembershipDto,
  UpdateClientMembershipDto,
} from './dto/client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // --- CLIENT COMPANIES CRUD ---

  async getClientCompanies(filters: {
    query?: string;
    status?: 'active' | 'inactive';
    page?: number;
    pageSize?: number;
  }) {
    const pageNum = Math.max(1, filters.page || 1);
    const sizeNum = Math.min(100, Math.max(1, filters.pageSize || 20));
    const offset = (pageNum - 1) * sizeNum;

    const client = this.supabaseService.getSystemClient();
    let dbQuery = client
      .from('client_companies')
      .select('*, memberships_count:client_memberships(count)', {
        count: 'exact',
      });

    if (filters.status) {
      dbQuery = dbQuery.eq('status', filters.status);
    }
    if (filters.query) {
      const q = filters.query.trim();
      dbQuery = dbQuery.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,tax_code.ilike.%${q}%,email.ilike.%${q}%`,
      );
    }

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + sizeNum - 1);

    if (error) {
      this.logger.error(`Failed to get client companies: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'CLIENT_COMPANIES_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh sách công ty khách hàng.',
      });
    }

    const items = (data || []).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      taxCode: c.tax_code ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      website: c.website ?? null,
      address: c.address ?? null,
      status: c.status,
      notes: c.notes ?? null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      membersCount: c.memberships_count?.[0]?.count ?? 0,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / sizeNum);

    return {
      items,
      page: pageNum,
      pageSize: sizeNum,
      total,
      totalPages,
    };
  }

  async getClientCompanyById(id: string) {
    const client = this.supabaseService.getSystemClient();
    const { data, error } = await client
      .from('client_companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get client company ${id}: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'CLIENT_COMPANY_LOOKUP_FAILED',
        message: 'Không thể truy vấn thông tin công ty khách hàng.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'CLIENT_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy công ty khách hàng được yêu cầu.',
      });
    }

    return data;
  }

  async createClientCompany(dto: CreateClientCompanyDto, adminUserId: string) {
    const client = this.supabaseService.getSystemClient();

    // Check unique code
    const { data: existing } = await client
      .from('client_companies')
      .select('id')
      .eq('code', dto.code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'CLIENT_COMPANY_CODE_ALREADY_EXISTS',
        message: 'Mã khách hàng này đã tồn tại trong hệ thống.',
      });
    }

    const { data, error } = await client
      .from('client_companies')
      .insert({
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        tax_code: dto.taxCode?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        website: dto.website?.trim() || null,
        address: dto.address?.trim() || null,
        status: dto.status,
        notes: dto.notes?.trim() || null,
        created_by: adminUserId,
        updated_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create client company: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'CLIENT_COMPANY_CREATE_FAILED',
        message: 'Không thể tạo công ty khách hàng lúc này.',
      });
    }

    return data;
  }

  async updateClientCompany(
    id: string,
    dto: UpdateClientCompanyDto,
    adminUserId: string,
  ) {
    // Check if exists
    await this.getClientCompanyById(id);

    const client = this.supabaseService.getSystemClient();
    const updatePayload: any = {
      updated_by: adminUserId,
    };

    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.taxCode !== undefined)
      updatePayload.tax_code = dto.taxCode?.trim() || null;
    if (dto.email !== undefined)
      updatePayload.email = dto.email?.trim() || null;
    if (dto.phone !== undefined)
      updatePayload.phone = dto.phone?.trim() || null;
    if (dto.website !== undefined)
      updatePayload.website = dto.website?.trim() || null;
    if (dto.address !== undefined)
      updatePayload.address = dto.address?.trim() || null;
    if (dto.status !== undefined) updatePayload.status = dto.status;
    if (dto.notes !== undefined)
      updatePayload.notes = dto.notes?.trim() || null;

    const { data, error } = await client
      .from('client_companies')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to update client company ${id}: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'CLIENT_COMPANY_UPDATE_FAILED',
        message: 'Không thể cập nhật công ty khách hàng.',
      });
    }

    return data;
  }

  // --- CLIENT MEMBERSHIPS CRUD (Admin & scoping) ---

  async getMemberships(companyId: string) {
    // Check company exists
    await this.getClientCompanyById(companyId);

    const client = this.supabaseService.getSystemClient();
    const { data, error } = await client
      .from('client_memberships')
      .select(
        '*, profile:profiles(email, full_name, avatar_url, account_status)',
      )
      .eq('client_company_id', companyId);

    if (error) {
      this.logger.error(`Failed to get memberships: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'CLIENT_MEMBERSHIPS_LOOKUP_FAILED',
        message: 'Không thể truy vấn danh sách tài khoản liên kết.',
      });
    }

    return (data || []).map((m) => {
      const p: any = m.profile;
      return {
        id: m.id,
        clientCompanyId: m.client_company_id,
        userId: m.user_id,
        email: p?.email ?? null,
        fullName: p?.full_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        accountStatus: p?.account_status ?? null,
        title: m.title ?? null,
        isPrimary: m.is_primary,
        createdAt: m.created_at,
        updatedAt: m.updated_at ?? null,
      };
    });
  }

  async createMembership(
    companyId: string,
    dto: CreateClientMembershipDto,
    adminUserId: string,
  ) {
    // Check company exists
    await this.getClientCompanyById(companyId);

    const client = this.supabaseService.getSystemClient();

    const { data, error } = await client.rpc(
      'create_client_membership_atomic',
      {
        p_company_id: companyId,
        p_user_id: dto.userId,
        p_title: dto.title?.trim() || null,
        p_is_primary: dto.isPrimary ?? false,
        p_created_by: adminUserId,
      },
    );

    if (error) {
      this.logger.error(`Failed to create membership: ${error.message}`);

      if (error.message.includes('CLIENT_COMPANY_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'CLIENT_COMPANY_NOT_FOUND',
          message: 'Không tìm thấy công ty khách hàng được yêu cầu.',
        });
      }
      if (error.message.includes('USER_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy tài khoản người dùng.',
        });
      }
      if (error.message.includes('USER_NOT_A_CLIENT')) {
        throw new BadRequestException({
          code: 'INVALID_CLIENT_MEMBER_ROLE',
          message:
            'Chỉ tài khoản có vai trò Khách hàng (client) mới được liên kết vào công ty khách hàng.',
        });
      }
      if (error.message.includes('USER_NOT_ACTIVE')) {
        throw new BadRequestException({
          code: 'USER_NOT_ACTIVE',
          message: 'Chỉ được phép liên kết tài khoản đã hoạt động.',
        });
      }
      if (
        error.message.includes('MEMBERSHIP_DUPLICATE') ||
        error.code === '23505'
      ) {
        throw new ConflictException({
          code: 'CLIENT_MEMBERSHIP_ALREADY_EXISTS',
          message: 'Tài khoản này đã được liên kết với công ty khách hàng này.',
        });
      }

      throw new InternalServerErrorException({
        code: 'CLIENT_MEMBERSHIP_CREATE_FAILED',
        message: 'Không thể tạo liên kết tài khoản khách hàng.',
      });
    }

    return data;
  }

  async updateMembership(
    companyId: string,
    membershipId: string,
    dto: UpdateClientMembershipDto,
  ) {
    // Check company exists
    await this.getClientCompanyById(companyId);

    const client = this.supabaseService.getSystemClient();

    const { data, error } = await client.rpc(
      'update_client_membership_atomic',
      {
        p_company_id: companyId,
        p_membership_id: membershipId,
        p_title: dto.title?.trim() || null,
        p_title_provided: dto.title !== undefined,
        p_is_primary: dto.isPrimary ?? false,
        p_is_primary_provided: dto.isPrimary !== undefined,
      },
    );

    if (error) {
      this.logger.error(`Failed to update membership: ${error.message}`);

      if (error.message.includes('MEMBERSHIP_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'CLIENT_MEMBERSHIP_NOT_FOUND',
          message: 'Không tìm thấy liên kết tài khoản được yêu cầu.',
        });
      }

      throw new InternalServerErrorException({
        code: 'CLIENT_MEMBERSHIP_UPDATE_FAILED',
        message: 'Không thể cập nhật liên kết tài khoản.',
      });
    }

    return data;
  }

  async deleteMembership(companyId: string, membershipId: string) {
    // Check company exists
    await this.getClientCompanyById(companyId);

    const client = this.supabaseService.getSystemClient();

    // Verify membership exists
    const { data: membership } = await client
      .from('client_memberships')
      .select('id')
      .eq('id', membershipId)
      .eq('client_company_id', companyId)
      .maybeSingle();

    if (!membership) {
      throw new NotFoundException({
        code: 'CLIENT_MEMBERSHIP_NOT_FOUND',
        message: 'Không tìm thấy liên kết tài khoản để gỡ bỏ.',
      });
    }

    const { error } = await client
      .from('client_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) {
      this.logger.error(`Failed to delete membership: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'CLIENT_MEMBERSHIP_DELETE_FAILED',
        message: 'Không thể gỡ bỏ tài khoản liên kết.',
      });
    }

    return { success: true };
  }

  // --- CLIENT OWN COMPANY SCOPE ---

  async getClientOwnCompanies(userId: string) {
    const client = this.supabaseService.getSystemClient();

    const { data: memberships, error } = await client
      .from('client_memberships')
      .select('*, client_company:client_companies(*)')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to query own client companies: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'CLIENT_COMPANIES_LOOKUP_FAILED',
        message: 'Không thể truy cập danh sách công ty liên kết.',
      });
    }

    return (memberships || []).map((m) => ({
      id: m.client_company.id,
      code: m.client_company.code,
      name: m.client_company.name,
      taxCode: m.client_company.tax_code ?? null,
      email: m.client_company.email ?? null,
      phone: m.client_company.phone ?? null,
      website: m.client_company.website ?? null,
      address: m.client_company.address ?? null,
      status: m.client_company.status,
      title: m.title ?? null,
      isPrimary: m.is_primary,
      joinedAt: m.created_at,
    }));
  }
}
