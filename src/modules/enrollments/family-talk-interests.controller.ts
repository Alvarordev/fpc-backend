import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { FindFamilyTalkInterestsDto } from './dto/list-family-talk-interests.dto';
import {
  FamilyTalkInterestListResponseDto,
  FamilyTalkInterestResponseDto,
} from './dto/family-talk-interest-response.dto';
import { EnrollmentsService } from './enrollments.service';

const READ = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('family-talk-interests')
@ApiTags('family-talk-interests')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class FamilyTalkInterestsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get()
  @Roles(...READ)
  @ApiOperation({
    summary: 'List family members interested in cancer prevention talks',
    description:
      'Returns interests collected during enrollment, with the related patient.',
  })
  @ApiOkResponse({ type: FamilyTalkInterestListResponseDto })
  @ApiForbiddenResponse()
  async findAll(
    @Query() filters: FindFamilyTalkInterestsDto,
  ): Promise<FamilyTalkInterestListResponseDto> {
    const { data, total } = await this.service.findFamilyTalkInterests(filters);
    return {
      data: data.map((interest) =>
        FamilyTalkInterestResponseDto.from(interest),
      ),
      total,
    };
  }
}
