import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Cookie = createParamDecorator(
  (cookieName: string, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.cookies?.[cookieName];
  },
);
