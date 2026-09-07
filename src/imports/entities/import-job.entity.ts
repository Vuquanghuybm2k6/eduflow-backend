import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ImportJobRow } from './import-job-row.entity';

export enum ImportJobStatus {
  PREVIEW = 'PREVIEW',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('import_jobs')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  entityType!: string;

  @Column({ type: 'text' })
  fileName!: string;

  @Column({
    type: 'enum',
    enum: ImportJobStatus,
    enumName: 'ImportJobStatus',
    default: ImportJobStatus.PREVIEW,
  })
  status!: ImportJobStatus;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  successRows!: number;

  @Column({ type: 'int', default: 0 })
  failedRows!: number;

  @Index()
  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => ImportJobRow, (row) => row.importJob)
  rows!: ImportJobRow[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
