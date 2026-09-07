import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ImportJob } from './import-job.entity';

export enum ImportJobRowStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('import_job_rows')
@Index(['importJobId', 'rowNumber'])
export class ImportJobRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  importJobId!: string;

  @Column({ type: 'int' })
  rowNumber!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  rawData!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  normalizedData!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ImportJobRowStatus,
    enumName: 'ImportJobRowStatus',
    default: ImportJobRowStatus.PENDING,
  })
  status!: ImportJobRowStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors!: Array<{ field: string; message: string }>;

  @ManyToOne(() => ImportJob, (job) => job.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'importJobId' })
  importJob!: ImportJob;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
