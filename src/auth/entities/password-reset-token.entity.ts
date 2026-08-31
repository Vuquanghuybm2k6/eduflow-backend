import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt!: Date;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
