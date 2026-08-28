import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

    if (!emailUser || !emailPassword) {
      this.logger.error(
        'Missing EMAIL_USER or EMAIL_PASSWORD. Set them in the backend .env file and restart the backend.',
      );
    } else {
      this.logger.log(
        `Mail configured for ${emailUser} (password set: ${emailPassword.length > 0})`,
      );
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #333;">Đặt lại mật khẩu EduFlow</h2>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p>Mã xác nhận (OTP) của bạn là:</p>
        <p style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; padding: 16px 32px; background-color: #f3f4f6; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; border-radius: 8px;">
            ${otp}
          </span>
        </p>
        <p>Mã này có hiệu lực trong <strong>3 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <p style="font-size: 13px; color: #777;">
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này và giữ nguyên mật khẩu hiện tại của bạn.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_USER'),
        to: email,
        subject: 'Mã xác nhận đặt lại mật khẩu EduFlow',
        html,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send OTP email to ${email}`,
        error?.stack ?? error,
      );
      throw error;
    }
  }
}
