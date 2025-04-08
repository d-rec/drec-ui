import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function phoneNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    if (!value.startsWith('+')) {
      return { invalidFormat: true };
    }

    try {
      if (!isValidPhoneNumber(value)) {
        return { invalidNumber: true };
      }

      const phoneNumber = parsePhoneNumber(value);

      if (!phoneNumber.isValid()) {
        if (phoneNumber.country && phoneNumber.nationalNumber.length < 5) {
          return { tooShort: true };
        }
        if (phoneNumber.country && phoneNumber.nationalNumber.length > 15) {
          return { tooLong: true };
        }
        return { invalidNumber: true };
      }

      return null;
    } catch (e) {
      return { invalidNumber: true };
    }
  };
}

export function getPhoneNumberErrorMessage(
  control: AbstractControl | null,
): string {
  if (!control) return '';

  if (control.hasError('required')) {
    return 'This field is required';
  }
  if (control.hasError('invalidFormat')) {
    return 'Phone number must start with + followed by country code (e.g., +1, +91)';
  }
  if (control.hasError('tooShort')) {
    return 'Phone number is too short for the specified country code';
  }
  if (control.hasError('tooLong')) {
    return 'Phone number is too long for the specified country code';
  }
  if (control.hasError('invalidNumber')) {
    return 'Please enter a valid international phone number (e.g., +91 9876543210, +1 234 567 8901)';
  }
  return '';
}
