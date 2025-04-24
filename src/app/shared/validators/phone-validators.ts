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
    if (!control.value) return null;
    if (!control.value.startsWith('+')) return { missingPlus: true };

    try {
      const phoneNumber = parsePhoneNumberFromString(control.value);
      if (!phoneNumber) return { invalidNumber: true };
      if (!phoneNumber.country) return { invalidCountryCode: true };

      const nationalLength = phoneNumber.nationalNumber.length;
      if (!phoneNumber.isValid()) {
        return nationalLength < 5
          ? { tooShort: true }
          : nationalLength > 15
            ? { tooLong: true }
            : { invalidNumber: true };
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

  const errorMap: Record<string, string> = {
    required: 'This field is required',
    missingPlus: 'Phone number must start with + symbol',
    invalidCountryCode: 'Invalid or missing country code',
    tooShort: 'Phone number is too short for the specified country code',
    tooLong: 'Phone number is too long for the specified country code',
    invalidNumber:
      'Please enter a valid international phone number (e.g., +1 234 567 8901)',
  };

  const errorKey = Object.keys(errorMap).find((key) => control.hasError(key));
  return errorKey ? errorMap[errorKey] : '';
}

export const getPhoneMetadata = (
  control: AbstractControl,
): PhoneMetadata | null =>
  (control as AbstractControlWithPhone).phoneMetadata || null;

export function formatPhoneInput(
  value: string,
  defaultCountry?: CountryCode,
): string {
  if (!value) return '';

  const formatWithCountry = (val: string, country?: CountryCode) => {
    try {
      const phoneNumber = parsePhoneNumberFromString(val, country);
      return phoneNumber?.isValid() ? phoneNumber.formatInternational() : null;
    } catch (error) {
      console.warn('Phone formatting error:', error);
      return null;
    }
  };

  if (value.startsWith('+')) {
    return formatWithCountry(value) || value;
  }

  if (defaultCountry) {
    const formatted = formatWithCountry(value, defaultCountry);
    if (formatted) return formatted;

    try {
      const dummyPhone = parsePhoneNumberFromString('1', defaultCountry);
      const countryCode = dummyPhone?.formatInternational().split(' ')[0];
      return value ? `${countryCode} ${value}` : countryCode || `+${value}`;
    } catch (error) {
      console.warn('Country code formatting error:', error);
    }
  }

  return `+${value}`;
}
