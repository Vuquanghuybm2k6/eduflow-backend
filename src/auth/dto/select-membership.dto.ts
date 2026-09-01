import { IsString, IsNotEmpty } from 'class-validator';

export class SelectMembershipDto {
  @IsString()
  @IsNotEmpty()
  membershipId!: string;
}
