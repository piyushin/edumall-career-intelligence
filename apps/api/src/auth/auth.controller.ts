import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { AppConfig } from "@edumall/config";
import type { Request, Response } from "express";
import { APP_CONFIG } from "../config/app-config.token";
import { authenticationHttpError } from "./auth-http";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CredentialDto, type AuthContext, LoginDto } from "./auth.types";
import { CsrfGuard } from "./csrf.guard";
import { CsrfService } from "./csrf.service";
import { CurrentAuthContext } from "./current-auth-context.decorator";

@Controller("auth")
export class AuthController {
  public constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CsrfService) private readonly csrfService: CsrfService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get("csrf")
  @Header("cache-control", "no-store")
  public csrf(@Res({ passthrough: true }) response: Response): { csrfToken: string } {
    return { csrfToken: this.csrfService.issue(response) };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  public async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.login(body.email, body.password, body.organizationId, {
        ipAddress: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.cookie(this.config.authCookieName, result.rawToken, {
        expires: result.expiresAt,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: this.config.authCookieSecure,
      });
      response.setHeader("cache-control", "no-store");

      return {
        session: {
          expiresAt: result.expiresAt.toISOString(),
          membershipId: result.context.membershipId,
          organizationId: result.context.organizationId,
          role: result.context.role,
          userId: result.context.userId,
        },
        user: result.user,
      };
    } catch (error) {
      throw authenticationHttpError(error, "login");
    }
  }

  @Get("session")
  @Header("cache-control", "no-store")
  @UseGuards(AuthGuard)
  public async currentSession(@CurrentAuthContext() context: AuthContext) {
    try {
      const user = await this.authService.getCurrentUser(context);
      return {
        session: {
          membershipId: context.membershipId,
          organizationId: context.organizationId,
          role: context.role,
          userId: context.userId,
        },
        user,
      };
    } catch (error) {
      throw authenticationHttpError(error, "session");
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, CsrfGuard)
  public async logout(
    @CurrentAuthContext() context: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.authService.logout(context);
    } catch (error) {
      throw authenticationHttpError(error, "session");
    }

    response.clearCookie(this.config.authCookieName, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: this.config.authCookieSecure,
    });
    this.csrfService.clear(response);
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  public async acceptInvitation(
    @Body() body: CredentialDto,
    @Req() request: Request,
  ): Promise<{ status: "accepted" }> {
    try {
      await this.authService.acceptInvitation(body.token, body.password, request.ip);
      return { status: "accepted" };
    } catch (error) {
      throw authenticationHttpError(error, "invitation");
    }
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  public async confirmPasswordReset(
    @Body() body: CredentialDto,
    @Req() request: Request,
  ): Promise<{ status: "confirmed" }> {
    try {
      await this.authService.confirmPasswordReset(body.token, body.password, request.ip);
      return { status: "confirmed" };
    } catch (error) {
      throw authenticationHttpError(error, "password-reset");
    }
  }
}
