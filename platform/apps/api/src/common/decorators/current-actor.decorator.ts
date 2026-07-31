import type { ActorContext } from "@r2m/authz";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

interface RequestWithActor extends Request {
  actor?: ActorContext;
}

/** Injects the ActorContext attached by JwtAuthGuard — never trust a client-supplied actor. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const request = ctx.switchToHttp().getRequest<RequestWithActor>();
  if (!request.actor) {
    throw new Error("CurrentActor used on a route without JwtAuthGuard attaching an actor.");
  }
  return request.actor;
});
