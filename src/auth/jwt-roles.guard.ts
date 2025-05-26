import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard extends AuthGuard('jwt') implements CanActivate {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Primero verifica el token con AuthGuard
        const isAuthorized = await super.canActivate(context);
        if (!isAuthorized) {
            return false;
        }
        console.log("isAuthorized", isAuthorized);

        // Verifica los roles permitidos para esta ruta
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles) {
            // Si no se especifican roles, se permite el acceso
            return true;
        }

        // Obtén el usuario del contexto
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Verifica si el usuario tiene al menos uno de los roles requeridos
        const hasRole = requiredRoles.some(role => user.rol?.includes(role));

        if (!hasRole) {
            throw new ForbiddenException('No tienes los permisos necesarios para acceder a esta ruta.');
        }

        return true;
    }
}
