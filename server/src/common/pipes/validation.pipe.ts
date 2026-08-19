import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

type ValidationIssue = {
  property: string;
  message: string;
};

export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const property = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const firstMessage = error.constraints
      ? Object.values(error.constraints)[0]
      : undefined;
    const ownIssue = firstMessage ? [{ property, message: firstMessage }] : [];
    const childIssues = error.children?.length
      ? formatValidationErrors(error.children, property)
      : [];

    return [...ownIssue, ...childIssues];
  });
}

export const GlobalValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) => {
    return new BadRequestException(formatValidationErrors(errors));
  },
});
