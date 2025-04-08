import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhoneFormatDirective } from './shared/directives/phone-number-formatter.directive';

@NgModule({
  declarations: [PhoneFormatDirective],
  imports: [CommonModule],
  exports: [PhoneFormatDirective],
})
export class SharedModule {}
