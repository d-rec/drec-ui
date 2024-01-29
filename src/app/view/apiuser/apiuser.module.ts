import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { ApiuserRoutingModule } from './apiuser-routing.module';
import { AllApiuserComponent } from './all-apiuser/all-apiuser.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    AllApiuserComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    ApiuserRoutingModule
  ]
})
export class ApiuserModule { }
