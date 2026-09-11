import { IsDateString, IsNotEmpty } from 'class-validator';

export class GenerateSessionsDto {
  @IsDateString({}, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  @IsNotEmpty()
  startDate!: string;

  @IsDateString({}, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  @IsNotEmpty()
  endDate!: string;
}
