import { IsString, IsOptional, IsEmail } from 'class-validator';

export class AuthenticateDto {
  @IsString()
  authConnectionId: string; // From Web3Auth Dashboard

  @IsString()
  idToken: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
