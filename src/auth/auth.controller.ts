import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DemoLoginDto } from './dto/demo-login.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @SkipThrottle({ authLogin: true })
  @Throttle({ authRegister: {} })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @SkipThrottle({ authRegister: true })
  @Throttle({ authLogin: {} })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('demo-login')
  @SkipThrottle({ authRegister: true })
  @Throttle({ authLogin: {} })
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.authService.demoLogin(dto);
  }
}