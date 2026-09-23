import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiPropertyOptional({
    description: 'Stable machine-readable error code when one is known',
  })
  code?: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}
