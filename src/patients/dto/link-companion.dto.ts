import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
export class LinkCompanionDto {
  @IsUUID() existingCompanionId!: string;
  @IsOptional() @IsBoolean() isPrimaryInformant?: boolean;
}
