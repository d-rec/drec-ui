import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AddCountryYieldvalueComponent} from './add-country-yieldvalue/add-country-yieldvalue.component';
import {AllCountryYieldvalueComponent} from './all-country-yieldvalue/all-country-yieldvalue.component'
import {EditCountryYieldvalueComponent  } from './edit-country-yieldvalue/edit-country-yieldvalue.component';
const routes: Routes = [

  { path: '', redirectTo: 'add', pathMatch: 'full' },
  { path: 'add', component: AddCountryYieldvalueComponent }, 
  { path: 'list', component: AllCountryYieldvalueComponent }, 
  { path: 'edit/:id', component: EditCountryYieldvalueComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class YieldconfigurationRoutingModule { }
