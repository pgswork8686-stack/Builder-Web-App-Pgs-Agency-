import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DepartmentsController } from './departments.controller';
import { OrganizationService } from './organization.service';
import { TeamsController } from './teams.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [DepartmentsController, TeamsController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
