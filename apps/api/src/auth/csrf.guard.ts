import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { CsrfService } from "./csrf.service";

@Injectable()
export class CsrfGuard implements CanActivate {
  public constructor(@Inject(CsrfService) private readonly csrf: CsrfService) {}

  public canActivate(context: ExecutionContext): boolean {
    if (!this.csrf.validate(context.switchToHttp().getRequest<Request>())) {
      throw new ForbiddenException({
        code: "CSRF_REQUIRED",
        message: "CSRF validation failed.",
      });
    }

    return true;
  }
}
