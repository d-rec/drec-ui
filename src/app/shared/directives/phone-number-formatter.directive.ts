import { Directive, HostListener, ElementRef } from '@angular/core';
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';

@Directive({
  standalone: false,
  selector: '[phoneFormat]',
})
export class PhoneFormatDirective {
  private previousValue = '';

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (value.length < this.previousValue.length) {
      this.previousValue = value;
      return;
    }

    if (value.startsWith('+')) {
      const formatter = new AsYouType();
      const formattedValue = formatter?.input(value) || value;

      if (formattedValue !== input.value) {
        const cursorPos = input.selectionStart || 0;
        const diff = formattedValue.length - value.length;

        input.value = formattedValue;
        input.setSelectionRange(cursorPos + diff, cursorPos + diff);
      }
    } else if (value.length > 0) {
      const digitsOnly = value.replace(/\D/g, '');
      let formattedValue = digitsOnly;

      if (digitsOnly.length > 3) {
        formattedValue =
          digitsOnly.slice(0, 3) +
          ' ' +
          (digitsOnly.length > 6
            ? digitsOnly.slice(3, 6) + ' ' + digitsOnly.slice(6)
            : digitsOnly.slice(3));
      }

      input.value = formattedValue;
    }

    this.previousValue = input.value;
  }

  @HostListener('blur')
  onBlur() {
    const input = this.el.nativeElement as HTMLInputElement;
    const value = input.value;

    if (value && value.startsWith('+')) {
      const phoneNumber = parsePhoneNumberFromString(value);
      if (phoneNumber?.isValid()) {
        input.dataset['originalValue'] = phoneNumber.number.toString();
      }
    }
  }
}
