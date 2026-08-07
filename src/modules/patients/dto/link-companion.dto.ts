import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class LinkCompanionDto {
  @IsUUID() existingCompanionId!: string;
  @IsOptional() @IsBoolean() isPrimaryInformant?: boolean;
  @IsOptional() @IsString() @MaxLength(50) relationship?: string;
}
