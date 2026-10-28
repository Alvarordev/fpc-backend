import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReassignFollowUpsDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  followUpIds!: string[];
  @ApiProperty({ format: 'uuid' }) @IsUUID() agentId!: string;
}

export class ReassignFollowUpsResponseDto {
  @ApiProperty() reassigned!: number;
}
