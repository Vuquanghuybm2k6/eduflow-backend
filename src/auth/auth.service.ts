import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Role } from '../roles/entities/role.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const PASSWORD_RESET_TTL_MS = 3 * 60 * 1000; // 3 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.dataSource.transaction(async (manager) => {
      const newUser = await manager.save(
        manager.create(User, {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
        }),
      );

      const org = await manager.save(
        manager.create(Organization, {
          name: `${dto.fullName}'s Organization`,
          slug: `org-${newUser.id.slice(0, 8)}`,
        }),
      );

      const role = await manager.save(
        manager.create(Role, {
          name: 'Admin',
          organizationId: org.id,
          isSystem: true,
        }),
      );

      await manager.save(
        manager.create(Membership, {
          userId: newUser.id,
          organizationId: org.id,
          roleId: role.id,
        }),
      );

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

    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
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

  async loginWithGoogle(idToken: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const client = new OAuth2Client(clientId);

    let payload: {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
      email_verified?: boolean;
    };
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const email = payload.email;
    if (!email || !payload.sub || !payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const existing = await this.usersService.findByEmail(email);
    let user = existing;

    if (!user) {
      user = await this.dataSource.transaction(async (manager) => {
        const newUser = await manager.save(
          manager.create(User, {
            email,
            fullName: payload.name ?? email.split('@')[0],
            avatarUrl: payload.picture ?? null,
            googleId: payload.sub,
          }),
        );

        const org = await manager.save(
          manager.create(Organization, {
            name: `${newUser.fullName}'s Organization`,
            slug: `org-${newUser.id.slice(0, 8)}`,
          }),
        );

        const role = await manager.save(
          manager.create(Role, {
            name: 'Admin',
            organizationId: org.id,
            isSystem: true,
          }),
        );

        await manager.save(
          manager.create(Membership, {
            userId: newUser.id,
            organizationId: org.id,
            roleId: role.id,
          }),
        );

        return newUser;
      });
    } else {
      await this.userRepository.update(
        { id: user.id },
        { googleId: payload.sub },
      );
      user = await this.usersService.findById(user.id);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
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

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return {
        message: 'Nếu email tồn tại, mã OTP đã được gửi đến email của bạn.',
      };
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        PasswordResetToken,
        { email, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      await manager.save(
        manager.create(PasswordResetToken, { email, tokenHash, expiresAt }),
      );
    });

    try {
      await this.mailService.sendOtpEmail(user.email, otp);
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${user.email}`, error);
    }

    return {
      message: 'Nếu email tồn tại, mã OTP đã được gửi đến email của bạn.',
    };
  }

  async verifyOtp(email: string, otp: string) {
    const validTokens = await this.passwordResetTokenRepository.find({
      where: {
        email,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    let matchedToken: PasswordResetToken | undefined;
    for (const t of validTokens) {
      if (await bcrypt.compare(otp, t.tokenHash)) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.usersService.findByEmail(email);
    const resetToken = await this.jwtService.signAsync(
      { sub: user!.id, email, otpId: matchedToken.id },
      {
        secret: this.configService.get<string>('JWT_RESET_SECRET'),
        expiresIn: 10 * 60, // 10 minutes
      },
    );

    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    let payload: { sub: string; email: string; otpId: string };
    try {
      payload = await this.jwtService.verifyAsync(resetToken, {
        secret: this.configService.get<string>('JWT_RESET_SECRET'),
      });
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, { id: payload.sub }, { passwordHash });
      await manager.update(
        PasswordResetToken,
        { id: payload.otpId },
        { usedAt: new Date() },
      );
      await manager.update(
        RefreshToken,
        { userId: payload.sub, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });

    return { message: 'Mật khẩu đã được đặt lại thành công' };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const storedToken = await this.refreshTokenRepository.findOne({
        where: {
          userId: payload.sub,
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (!isValid) {
        // Possible token theft — revoke all user tokens
        await this.refreshTokenRepository.update(
          { userId: payload.sub },
          { revokedAt: new Date() },
        );
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Rotate: revoke old token, issue new ones
      await this.refreshTokenRepository.update(
        { id: storedToken.id },
        { revokedAt: new Date() },
      );

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
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
      const storedTokens = await this.refreshTokenRepository.find({
        where: { userId, revokedAt: IsNull() },
      });

      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (isValid) {
          await this.refreshTokenRepository.update(
            { id: stored.id },
            { revokedAt: new Date() },
          );
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
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const storedTokens = await this.refreshTokenRepository.find({
        where: { userId: payload.sub, revokedAt: IsNull() },
      });

      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
        if (isValid) {
          await this.refreshTokenRepository.update(
            { id: stored.id },
            { revokedAt: new Date() },
          );
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

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId,
        tokenHash,
        expiresAt,
      }),
    );
  }

  private sanitizeUser(user: User) {
    const { passwordHash: _passwordHash, ...rest } = user;
    void _passwordHash;
    return rest;
  }
}
