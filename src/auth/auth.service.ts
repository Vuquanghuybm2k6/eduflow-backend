import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
        },
      });

      const org = await tx.organization.create({
        data: {
          name: `${dto.fullName}'s Organization`,
          slug: `org-${newUser.id.slice(0, 8)}`,
        },
      });

      const role = await tx.role.create({
        data: {
          name: 'Admin',
          organizationId: org.id,
          isSystem: true,
        },
      });

      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: org.id,
          roleId: role.id,
        },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (!isValid) {
        // Possible token theft — revoke all user tokens
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Rotate: revoke old token, issue new ones
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      const tokens = await this.generateTokens(user.id, user.email);
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        user: this.sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const storedTokens = await this.prisma.refreshToken.findMany({
        where: { userId, revokedAt: null },
      });

      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (isValid) {
          await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    }

    return { message: 'Logged out successfully' };
  }

  async logoutByRefreshToken(refreshToken?: string) {
    if (!refreshToken) {
      return { message: 'Logged out successfully' };
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const storedTokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.sub, revokedAt: null },
      });

      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (isValid) {
          await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    } catch {
      // Token invalid or expired — still return success
    }

    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: 60 * 15, // 15 minutes in seconds
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}