import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OtpPurpose {
  PASSWORD_RESET = 'password_reset',
  REGISTRATION = 'registration',
}

@Entity('verification_tokens')
export class VerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', unique: true })
  tokenHash!: string;

  @Column({
    type: 'enum',
    enum: OtpPurpose,
    enumName: 'OtpPurpose',
    default: OtpPurpose.PASSWORD_RESET,
  })
  purpose!: OtpPurpose;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt!: Date;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
