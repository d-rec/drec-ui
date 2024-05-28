import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { YieldconfigurationRoutingModule } from './yieldconfiguration-routing.module';
import { AddCountryYieldvalueComponent } from './add-country-yieldvalue/add-country-yieldvalue.component';
import { AllCountryYieldvalueComponent } from './all-country-yieldvalue/all-country-yieldvalue.component';
import { EditCountryYieldvalueComponent } from './edit-country-yieldvalue/edit-country-yieldvalue.component';

@NgModule({
  declarations: [
    AddCountryYieldvalueComponent,
    AllCountryYieldvalueComponent,
    EditCountryYieldvalueComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    YieldconfigurationRoutingModule,
  ],
})
export class YieldconfigurationModule {}
