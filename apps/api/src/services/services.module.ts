import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ServiceCategoriesController, ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
