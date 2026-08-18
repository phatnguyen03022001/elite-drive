import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

interface SessionUser {
  id: string;
  email: string;
  role: string;
}

@Controller('api/auth')
@UseGuards(JwtAuthGuard)
export class SessionController {
  @Get('me')
  me(
    @CurrentUser('id') id: string,
    @CurrentUser('email') email: string,
    @CurrentUser('role') role: string,
  ) {
    const user: SessionUser = { id, email, role };
    return ApiResponse.success(user);
  }
}
