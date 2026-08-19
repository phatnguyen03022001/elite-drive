import { ValidationError } from 'class-validator';
import { formatValidationErrors } from './validation.pipe';

describe('formatValidationErrors', () => {
  it('keeps the first constraint message for a field', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: {
          isEmail: 'Email không hợp lệ',
          maxLength: 'Email quá dài',
        },
        children: [],
      },
    ];

    expect(formatValidationErrors(errors)).toEqual([
      { property: 'email', message: 'Email không hợp lệ' },
    ]);
  });

  it('formats nested validation errors when a parent has no constraints', () => {
    const errors: ValidationError[] = [
      {
        property: 'profile',
        children: [
          {
            property: 'email',
            constraints: { isEmail: 'Email không hợp lệ' },
            children: [],
          },
        ],
      },
    ];

    expect(formatValidationErrors(errors)).toEqual([
      { property: 'profile.email', message: 'Email không hợp lệ' },
    ]);
  });
});
