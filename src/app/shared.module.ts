import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhoneFormatDirective } from './shared/directives/phone-number-formatter.directive';
import { ThemeSwitcherComponent } from './shared/components/theme-switcher/theme-switcher.component';
import { MaterialModule } from './material/material.module';

@NgModule({
  declarations: [PhoneFormatDirective, ThemeSwitcherComponent],
  imports: [CommonModule, MaterialModule],
  exports: [PhoneFormatDirective, ThemeSwitcherComponent],
})
export class SharedModule {}
