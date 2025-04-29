import { FormControl } from '@angular/forms';

export const postcodeValidator = () => {
  return (control: FormControl) => {
    if (!control.value) {
      return null;
    }

    const postcodeRegex = /^[a-zA-Z0-9\s-]+$/;

    if (!postcodeRegex.test(control.value)) {
      return { invalidPostcode: true };
    }

    return null;
  };
};
