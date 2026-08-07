import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestWithAuth } from "./auth.types";

export const CurrentAuthContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<RequestWithAuth>().authContext,
);
