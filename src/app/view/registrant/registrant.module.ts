import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { RegistrantRoutingModule } from './registrant-routing.module';
import { AllRegistrantComponent } from './all-registrant/all-registrant.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [AllRegistrantComponent],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    RegistrantRoutingModule,
  ],
})
export class RegistrantModule {}
