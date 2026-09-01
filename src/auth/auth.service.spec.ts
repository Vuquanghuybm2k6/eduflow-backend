import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { Membership } from '../memberships/entities/membership.entity';

describe('AuthService', () => {
  let service: AuthService;
  let dataSource: {
    transaction: jest.Mock;
    manager: {
      save: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let userRepository: { update: jest.Mock };
  let refreshTokenRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let verificationTokenRepository: { find: jest.Mock };
  let membershipRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let users: { findByEmail: jest.Mock; findById: jest.Mock };
  let mail: { sendOtpEmail: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn(),
      manager: {
        save: jest.fn((entity: unknown) => entity),
        create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
          id: 'generated-id',
          status: 'ACTIVE',
          ...data,
        })),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    dataSource.transaction.mockImplementation((cb: (manager: any) => unknown) =>
      cb(dataSource.manager),
    );

    userRepository = { update: jest.fn().mockResolvedValue(undefined) };
    refreshTokenRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((entity: unknown) => entity),
      create: jest.fn((data: unknown) => data),
    };
    verificationTokenRepository = { find: jest.fn() };
    membershipRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((entity: unknown) => entity),
      create: jest.fn((data: unknown) => data),
    };
    users = { findByEmail: jest.fn(), findById: jest.fn() };
    mail = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: verificationTokenRepository,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipRepository,
        },
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

      expect(result.message).toContain('Ä‘Ã£ Ä‘Æ°á»£c gá»­i');
      expect(mail.sendOtpEmail).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('invalidates old OTPs and sends a 6-digit OTP email when user exists', async () => {
      users.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        status: 'ACTIVE',
      });
      mail.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('a@b.com');

      expect(result.message).toContain('Ä‘Ã£ Ä‘Æ°á»£c gá»­i');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(dataSource.manager.update).toHaveBeenCalledWith(
        VerificationToken,
        expect.objectContaining({ email: 'a@b.com' }),
        expect.any(Object),
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com' }),
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
      verificationTokenRepository.find.mockResolvedValue([]);

      await expect(service.verifyOtp('a@b.com', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns a resetToken when OTP is valid', async () => {
      const otp = '123456';
      const tokenHash = await bcrypt.hash(otp, 10);
      users.findByEmail.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      verificationTokenRepository.find.mockResolvedValue([
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

      const result = await service.resetPassword('good-token', 'new-pass-123');

      expect(result.message).toContain('Ä‘áº·t láº¡i');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(dataSource.manager.update).toHaveBeenCalledWith(
        User,
        { id: 'user-1' },
        expect.objectContaining<Record<string, unknown>>({
          passwordHash: expect.any(String),
        }),
      );
      expect(dataSource.manager.update).toHaveBeenCalledWith(
        VerificationToken,
        { id: 'reset-1' },
        expect.objectContaining<Record<string, unknown>>({
          usedAt: expect.any(Date),
        }),
      );
      expect(dataSource.manager.update).toHaveBeenCalledWith(
        RefreshToken,
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining<Record<string, unknown>>({
          revokedAt: expect.any(Date),
        }),
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
        } as unknown as LoginTicket);
      jwt.signAsync.mockResolvedValue('signed-token');
      membershipRepository.find.mockResolvedValue([
        {
          id: 'membership-1',
          organizationId: 'org-1',
          organization: { name: "User's Organization" },
          role: { name: 'Admin' },
        },
      ]);
    });

    afterEach(() => {
      verifySpy.mockRestore();
    });

    it('throws UnauthorizedException for an invalid Google token', async () => {
      verifySpy.mockRejectedValue(new Error('invalid token'));

      await expect(service.loginWithGoogle('bad-id-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns tokens and links googleId for an existing user', async () => {
      users.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'google@example.com',
        fullName: 'Google User',
        status: 'ACTIVE',
        avatarUrl: null,
      });
      users.findById.mockResolvedValue({
        id: 'user-1',
        email: 'google@example.com',
        fullName: 'Google User',
        avatarUrl: null,
        status: 'ACTIVE',
        googleId: 'google-sub-1',
      });

      const result = await service.loginWithGoogle('good-id-token');

      expect(result.accessToken).toBe('signed-token');
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { googleId: 'google-sub-1' },
      );
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });

    it('creates a new user with org, role and membership when email is new', async () => {
      users.findByEmail.mockResolvedValue(null);

      const result = await service.loginWithGoogle('good-id-token');

      expect(result.accessToken).toBe('signed-token');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'google@example.com',
          googleId: 'google-sub-1',
        }),
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining<Record<string, unknown>>({
          name: expect.stringMatching(/'s Organization$/),
        }),
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Admin' }),
      );
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        expect.objectContaining<Record<string, unknown>>({
          roleId: expect.any(String),
        }),
      );
    });
  });
});
