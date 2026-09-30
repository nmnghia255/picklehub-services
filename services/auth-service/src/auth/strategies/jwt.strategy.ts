import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_ACCESS_SECRET || 'your-secret-key',
        });
    }

    async validate(payload: any) {
        // Payload contains: { sub: userId, role: userRole }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, name: true, status: true, isActive: true }
        });

        if (!user || user.status !== 'ACTIVE' || !user.isActive) {
            throw new UnauthorizedException('User not found or inactive');
        }

        // This will be available as req.user in controllers
        return {
            id: user.id,
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };
    }
}
