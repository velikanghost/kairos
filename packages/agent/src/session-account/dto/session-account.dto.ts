import { IsString, IsNotEmpty } from 'class-validator';

export class GetOrCreateSessionAccountDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SessionAccountResponseDto {
  address: string;
  implementation: string;
}
