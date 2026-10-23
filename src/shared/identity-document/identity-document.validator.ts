import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { IdentityDocumentType } from '../../database/entities/identity-document-type.enum';

export const IDENTITY_DOCUMENT_DIGITS: Record<IdentityDocumentType, number> = {
  [IdentityDocumentType.DNI]: 8,
  [IdentityDocumentType.CE]: 9,
  [IdentityDocumentType.CPP]: 9,
};

export function isValidIdentityDocument(
  type: IdentityDocumentType,
  value: string,
): boolean {
  return new RegExp(`^\\d{${IDENTITY_DOCUMENT_DIGITS[type]}}$`).test(value);
}

/**
 * Checks the document number against `documentType` on the same object.
 * Without a type (older clients) the number is accepted as is.
 */
export function MatchesIdentityDocumentType(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'matchesIdentityDocumentType',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const type = (args.object as { documentType?: unknown }).documentType;
          if (typeof value !== 'string' || !value.trim()) return true;
          if (
            !Object.values(IdentityDocumentType).includes(
              type as IdentityDocumentType,
            )
          )
            return true;
          return isValidIdentityDocument(
            type as IdentityDocumentType,
            value.trim(),
          );
        },
        defaultMessage(args: ValidationArguments) {
          const type = (args.object as { documentType: IdentityDocumentType })
            .documentType;
          return `El ${type} debe tener ${IDENTITY_DOCUMENT_DIGITS[type]} dígitos`;
        },
      },
    });
}
