import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { JwtPayload, Role } from '@app/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';
export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/** Endpoint tanpa autentikasi */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Batasi endpoint untuk role tertentu */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Tetap bisa diakses walau user wajib mengganti password terlebih dahulu */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

/** Pesan sukses di envelope response */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload =>
    context.switchToHttp().getRequest<{ user: JwtPayload }>().user,
);
