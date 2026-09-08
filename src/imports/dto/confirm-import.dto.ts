import { IsUUID } from 'class-validator';

export class ConfirmImportDto {
  @IsUUID()
  importJobId!: string;
}
