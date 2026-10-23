import { BadRequestException } from '@nestjs/common';

export interface ReferralFields {
  hasReferralSheet?: boolean | null;
  referredTo?: string | null;
  referredHealthCenterId?: string | null;
  referralNotProvidedReason?: string | null;
}

export function normalizeReferralFields<T extends ReferralFields>(input: T): T {
  if (input.hasReferralSheet === true) {
    if (!input.referredTo?.trim() && !input.referredHealthCenterId)
      throw new BadRequestException(
        'referredHealthCenterId or referredTo is required when a referral sheet was provided',
      );
    return { ...input, referralNotProvidedReason: null };
  }
  if (input.hasReferralSheet === false) {
    return { ...input, referredTo: null, referredHealthCenterId: null };
  }
  return input;
}
