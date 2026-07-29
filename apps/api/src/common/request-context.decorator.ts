import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestWithContext } from "./middleware/request-context.middleware";

export const RequestContext = createParamDecorator(
  (key: "requestId" | "correlationId" | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    if (!key) {
      return request.context;
    }

    return request.context?.[key];
  },
);
