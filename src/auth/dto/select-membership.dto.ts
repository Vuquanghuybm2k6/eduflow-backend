import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SelectMembershipDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  membershipId!: string;
}
