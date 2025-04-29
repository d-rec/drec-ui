import { FormControl } from '@angular/forms';

export const postalCodeValidator = () => {
  return (control: FormControl) => {
    if (!control.value) {
      return null;
    }

    const postalCodeRegex = /^[a-zA-Z0-9\s-]+$/;

    if (!postalCodeRegex.test(control.value)) {
      return { invalidPostalCode: true };
    }

    return null;
  };
};
