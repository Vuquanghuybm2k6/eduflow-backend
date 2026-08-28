import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    passwordResetToken: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { update: jest.Mock; create: jest.Mock };
    refreshToken: { updateMany: jest.Mock; create: jest.Mock };
    organization: { create: jest.Mock };
    role: { create: jest.Mock };
    membership: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let users: { findByEmail: jest.Mock };
  let mail: { sendOtpEmail: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      passwordResetToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { update: jest.fn(), create: jest.fn() },
      refreshToken: { updateMany: jest.fn(), create: jest.fn() },
      organization: { create: jest.fn() },
      role: { create: jest.fn() },
      membership: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    users = { findByEmail: jest.fn() };
    mail = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('returns a generic message without sending email if user not found', async () => {
      users.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@example.com');

      expect(result.message).toContain('đã được gửi');
      expect(mail.sendOtpEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('invalidates old OTPs and sends a 6-digit OTP email when user exists', async () => {
      users.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        status: 'ACTIVE',
      });
      mail.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('a@b.com');

      expect(result.message).toContain('đã được gửi');
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'a@b.com', usedAt: null },
        }),
      );
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'a@b.com' }),
        }),
      );
      expect(mail.sendOtpEmail).toHaveBeenCalledWith(
        'a@b.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe('verifyOtp', () => {
    it('throws BadRequestException when no OTP matches', async () => {
      users.findByEmail.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      prisma.passwordResetToken.findMany.mockResolvedValue([]);

      await expect(
        service.verifyOtp('a@b.com', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a resetToken when OTP is valid', async () => {
      const otp = '123456';
      const tokenHash = await bcrypt.hash(otp, 10);
      users.findByEmail.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      prisma.passwordResetToken.findMany.mockResolvedValue([
        { id: 'reset-1', email: 'a@b.com', tokenHash, usedAt: null },
      ]);
      jwt.signAsync.mockResolvedValue('signed-reset-token');

      const result = await service.verifyOtp('a@b.com', otp);

      expect(result.resetToken).toBe('signed-reset-token');
      expect(jwt.signAsync).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException for an invalid reset token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.resetPassword('bad-token', 'new-pass-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password, invalidates OTP and revokes refresh tokens when valid', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.com',
        otpId: 'reset-1',
      });
      prisma.$transaction.mockImplementation((ops: unknown[]) =>
        Promise.all(ops),
      );

      const result = await service.resetPassword('good-token', 'new-pass-123');

      expect(result.message).toContain('đặt lại');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'reset-1' } }),
      );
    });
  });

  describe('loginWithGoogle', () => {
    let verifySpy: jest.SpyInstance;

    beforeEach(() => {
      verifySpy = jest
        .spyOn(OAuth2Client.prototype, 'verifyIdToken')
        .mockResolvedValue({
          getPayload: () => ({
            email: 'google@example.com',
            sub: 'google-sub-1',
            name: 'Google User',
            picture: 'https://example.com/pic.jpg',
            email_verified: true,
          }),
        } as any);
      jwt.signAsync.mockResolvedValue('signed-token');
      prisma.refreshToken.create.mockResolvedValue(undefined);
    });

    afterEach(() => {
      verifySpy.mockRestore();
    });

    it('throws UnauthorizedException for an invalid Google token', async () => {
      verifySpy.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.loginWithGoogle('bad-id-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and links googleId for an existing user', async () => {
      users.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'google@example.com',
        fullName: 'Google User',
        status: 'ACTIVE',
        avatarUrl: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'google@example.com',
        fullName: 'Google User',
        avatarUrl: 'https://example.com/pic.jpg',
        status: 'ACTIVE',
        googleId: 'google-sub-1',
      });

      const result = await service.loginWithGoogle('good-id-token');

      expect(result.accessToken).toBe('signed-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { googleId: 'google-sub-1' },
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('creates a new user with org, role and membership when email is new', async () => {
      users.findByEmail.mockResolvedValue(null);
      const tx = {
        user: {
          create: jest
            .fn()
            .mockResolvedValue({
              id: 'user-new',
              email: 'google@example.com',
              fullName: 'Google User',
              avatarUrl: 'https://example.com/pic.jpg',
              googleId: 'google-sub-1',
              status: 'ACTIVE',
            }),
        },
        organization: {
          create: jest.fn().mockResolvedValue({ id: 'org-1' }),
        },
        role: { create: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        membership: { create: jest.fn().mockResolvedValue({ id: 'mb-1' }) },
      };
      prisma.$transaction.mockImplementation(
        (cb: (client: typeof tx) => unknown) => cb(tx),
      );

      const result = await service.loginWithGoogle('good-id-token');

      expect(result.accessToken).toBe('signed-token');
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ googleId: 'google-sub-1' }),
        }),
      );
      expect(tx.organization.create).toHaveBeenCalled();
      expect(tx.role.create).toHaveBeenCalled();
      expect(tx.membership.create).toHaveBeenCalled();
    });
  });
});
