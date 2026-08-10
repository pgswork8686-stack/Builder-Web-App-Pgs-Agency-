import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { RequestUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser('authUserId') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('bootstrap-admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async bootstrapAdmin(@CurrentUser() currentUser: RequestUser) {
    return this.authService.bootstrapAdmin(currentUser);
  }
}
