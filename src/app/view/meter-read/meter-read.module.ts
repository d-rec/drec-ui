import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MeterReadRoutingModule } from './meter-read-routing.module';
import { AddreadComponent } from './addread/addread.component';
import { AllMetereadsComponent } from './all-metereads/all-metereads.component';

import { MeterReadTableComponent } from './meter-read-table/meter-read-table.component';
import { PipesModule } from '../../pipes.module';
import { AddBulkReadsComponent } from './add-bulk-reads/add-bulk-reads.component';

@NgModule({
  declarations: [
    AllMetereadsComponent,
    AddreadComponent,
    AddBulkReadsComponent,
    MeterReadTableComponent,
  ],
  imports: [
    CommonModule,
    MeterReadRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    PipesModule,
  ],
})
export class MeterReadModule {}
