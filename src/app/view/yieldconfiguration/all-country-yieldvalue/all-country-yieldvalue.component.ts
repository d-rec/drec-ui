
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { YieldConfigurationService } from '../../../auth/services/yieldConfiguration.service';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { YieldConfig } from '../../../models/yieldvalue.model';
@Component({
  selector: 'app-all-country-yieldvalue',
  templateUrl: './all-country-yieldvalue.component.html',
  styleUrls: ['./all-country-yieldvalue.component.scss']
})
export class AllCountryYieldvalueComponent {
  countrylist: any;
  countrycodeLoded: boolean = false;
  data:YieldConfig[];
  displayedColumns = [
    'country',
    'value',
    'status',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  loading: boolean = true;
  pageSize:number=20;
  totalRows:number;
  constructor(private authService: AuthbaseService, private yieldService: YieldConfigurationService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog) {

  }
  ngOnInit(): void {

    this.authService.GetMethod('countrycode/list').subscribe(
      (data3) => {

        this.countrylist = data3;
        this.countrycodeLoded = true;
      }
    )

    setTimeout(() => {
      // if (this.countrycodeLoded) { 
      //   this.applycountryFilter(); 
      // }
      this.loading = false;
      this.getCountryyieldListData();
    }, 1000)
  }
  // applycountryFilter() {
  //   this.FilterForm.controls['countryname'];
  //   this.filteredOptions = this.FilterForm.controls['countryname'].valueChanges.pipe(
  //     startWith(''),
  //     map(value => this._filter(value || '')),
  //   );
  // }

  // private _filter(value: any): string[] {

  //   const filterValue = value.toLowerCase();
  //   if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
  //     this.showerror = true;

  //   } else {
  //     this.showerror = false;
  //   }
  //   return this.countrylist.filter((option: any) => option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  // }
  getCountryyieldListData() {
    //this.FilterForm.controls['pagenumber'].setValue(page);
    this.yieldService.getyieldList().subscribe(
      (data) => {
        console.log(data)
        //@ts-ignore
        this.data=data;
          this.dataSource = new MatTableDataSource(this.data);
           this.totalRows = this.data.length
          // console.log(this.totalRows);
          // this.totalPages = this.data.totalPages
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;

        }
      
    );
  }
  UpdateYield(id:number) {
    this.router.navigate(['/admin/yield/edit/' + id]);
  }
}
