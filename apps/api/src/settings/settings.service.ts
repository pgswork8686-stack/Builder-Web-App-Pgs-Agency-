import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import {
  BulkUpdateSettingsDto,
  UpdateSystemSettingDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private handleDbError(error: any, message: string): never {
    this.logger.error(`${message}: ${error?.message ?? JSON.stringify(error)}`);
    throw new InternalServerErrorException({
      code: 'SETTINGS_DATABASE_ERROR',
      message,
    });
  }

  async getAllSettings(user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'SETTINGS_ACCESS_DENIED',
        message: 'Chỉ Quản trị viên mới có quyền xem cấu hình hệ thống.',
      });
    }

    const { data, error } = await this.client
      .from('system_settings')
      .select(
        '*, updated_by:profiles!system_settings_updated_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .order('category', { ascending: true });

    if (error) {
      this.handleDbError(error, 'Không thể tải cấu hình hệ thống.');
    }

    return data || [];
  }

  async updateSetting(dto: UpdateSystemSettingDto, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'SETTINGS_ACCESS_DENIED',
        message: 'Chỉ Quản trị viên mới có quyền cập nhật cấu hình hệ thống.',
      });
    }

    const { data, error } = await this.client
      .from('system_settings')
      .upsert({
        key: dto.key,
        category: dto.category,
        value: dto.value,
        description: dto.description || null,
        updated_by_user_id: user.profileId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể lưu cấu hình hệ thống.');
    }

    return data;
  }

  async bulkUpdateSettings(dto: BulkUpdateSettingsDto, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'SETTINGS_ACCESS_DENIED',
        message: 'Chỉ Quản trị viên mới có quyền cập nhật cấu hình hệ thống.',
      });
    }

    const upsertRows = dto.settings.map((s) => ({
      key: s.key,
      category: s.category,
      value: s.value,
      description: s.description || null,
      updated_by_user_id: user.profileId,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from('system_settings')
      .upsert(upsertRows)
      .select();

    if (error) {
      this.handleDbError(error, 'Không thể cập nhật danh sách cấu hình.');
    }

    return data || [];
  }
}
