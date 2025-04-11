import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

interface PhoneMetadata {
  countryCode: string | undefined;
  nationalNumber: string;
  formattedNumber: string;
  numberType: string | undefined;
}

interface AbstractControlWithPhone extends AbstractControl {
  phoneMetadata?: PhoneMetadata;
}

export function phoneNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    if (!value.startsWith('+')) {
      return { missingPlus: true };
    }

    try {
      const phoneNumber = parsePhoneNumberFromString(value);

      if (!phoneNumber) {
        return { invalidNumber: true };
      }

      if (!phoneNumber.country) {
        return { invalidCountryCode: true };
      }

      if (!phoneNumber.isValid()) {
        if (phoneNumber.nationalNumber.length < 5) {
          return { tooShort: true };
        }
        if (phoneNumber.nationalNumber.length > 15) {
          return { tooLong: true };
        }
        return { invalidNumber: true };
      }

      (control as AbstractControlWithPhone).phoneMetadata = {
        countryCode: phoneNumber.country,
        nationalNumber: phoneNumber.nationalNumber,
        formattedNumber: phoneNumber.formatInternational(),
        numberType: phoneNumber.getType(),
      };

      return null;
    } catch (error) {
      console.error('Phone validation error:', error);
      return {
        invalidNumber: true,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid phone number format',
      };
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
  if (control.hasError('missingPlus')) {
    return 'Phone number must start with + symbol';
  }
  if (control.hasError('invalidCountryCode')) {
    return 'Invalid or missing country code';
  }
  if (control.hasError('tooShort')) {
    return 'Phone number is too short for the specified country code';
  }
  if (control.hasError('tooLong')) {
    return 'Phone number is too long for the specified country code';
  }
  if (control.hasError('invalidNumber')) {
    return 'Please enter a valid international phone number (e.g., +1 234 567 8901)';
  }
  return '';
}

/**
 * Retrieves phone metadata that was stored during validation
 */
export function getPhoneMetadata(
  control: AbstractControl,
): PhoneMetadata | null {
  return (control as AbstractControlWithPhone).phoneMetadata || null;
}

/**
 * Automatically tries to format a phone input value
 * @param value The input value to format
 * @param defaultCountry Optional default country to use if no country code is provided
 * @returns Formatted phone number starting with +
 */
export function formatPhoneInput(
  value: string,
  defaultCountry?: CountryCode,
): string {
  if (!value) return '';

  if (value.startsWith('+')) {
    try {
      const phoneNumber = parsePhoneNumberFromString(value);
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.formatInternational();
      }
    } catch (error) {
      console.warn('Phone formatting error:', error);
      return value.startsWith('+') ? value : '+' + value;
    }
  } else if (defaultCountry) {
    try {
      const phoneNumber = parsePhoneNumberFromString(value, defaultCountry);
      if (phoneNumber && phoneNumber.isValid()) {
        return phoneNumber.formatInternational();
      }
    } catch (error) {
      console.warn('Phone parsing error with default country:', error);
    }

    if (value && !value.startsWith('+')) {
      try {
        const dummyPhone = parsePhoneNumberFromString('1', defaultCountry);
        if (dummyPhone) {
          const countryCodePart = dummyPhone
            .formatInternational()
            .split(' ')[0];

          if (value.length > 0) {
            return `${countryCodePart} ${value}`;
          } else {
            return countryCodePart;
          }
        }
      } catch (error) {
        console.warn('Country code formatting error:', error);
        return '+' + value;
      }
    }
  }

  return value.startsWith('+') ? value : '+' + value;
}
