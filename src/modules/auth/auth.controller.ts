import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyPasswordResetDto,
} from './dto/password-reset.dto';
import type { AuthenticatedUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Send a password reset link (same response whether or not the email exists)',
  })
  @ApiNoContentResponse()
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.passwordReset.requestReset(dto.email);
  }

  @Post('reset-password/verify')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check that a password reset link is still valid' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'El enlace no es válido o ya venció.' })
  async verifyPasswordReset(
    @Body() dto: VerifyPasswordResetDto,
  ): Promise<void> {
    await this.passwordReset.verify(dto.token);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Set a new password with a reset link and close open sessions',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'El enlace no es válido o ya venció.' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.reset(dto.token, dto.password);
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Correo o contraseña incorrectos.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    response.cookie(
      this.authService.getRefreshCookieName(),
      result.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @Public()
  @UseGuards(ThrottlerGuard)
  // Por IP: en la fundación varios agentes comparten la misma IP y cada recarga
  // renueva la sesión. El refresh ya exige un token secreto.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Rotate the refresh token and issue an access token',
  })
  @ApiCreatedResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    try {
      const refreshToken = request.cookies?.[
        this.authService.getRefreshCookieName()
      ] as string | undefined;
      if (!refreshToken) {
        throw new UnauthorizedException(
          'Tu sesión expiró. Vuelve a iniciar sesión.',
        );
      }

      const result = await this.authService.refresh(refreshToken);
      response.cookie(
        this.authService.getRefreshCookieName(),
        result.refreshToken,
        this.authService.getRefreshCookieOptions(),
      );

      return { accessToken: result.accessToken };
    } catch (error) {
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[
      this.authService.getRefreshCookieName()
    ] as string | undefined;
    await this.authService.logout(user.id, refreshToken);
    this.clearRefreshCookie(response);
  }

  private clearRefreshCookie(response: Response): void {
    const options = { ...this.authService.getRefreshCookieOptions() };
    delete options.maxAge;
    response.clearCookie(this.authService.getRefreshCookieName(), options);
  }
}
