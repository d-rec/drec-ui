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
import { AdminService } from '../../../auth/services/admin.service';
import { Router,ActivatedRoute } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
// import { DeviceDetailsComponent } from '../device-details/device-details.component'
@Component({
  selector: 'app-admin-organization',
  templateUrl: './admin-organization.component.html',
  styleUrls: ['./admin-organization.component.scss']
})
export class AdminOrganizationComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = [
    'name',
    'orgemail',
    'type',
    'status',
    'no of users',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  loginuser: any
  deviceurl: any;
  pageSize: number = 20;
  countrylist: any;
  fuellist: any;
  devicetypelist: any;
  fuellistLoaded: boolean = false;
  devicetypeLoded: boolean = false;
  countrycodeLoded: boolean = false;
  loading: boolean = true;
  public sdgblist: any;
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
  filteredOptions: Observable<any[]>;
  offtaker = ['School','Education','Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture','Utility','Off-Grid Community']
  endminDate = new Date();
  totalPages: number;
  subscription: Subscription;
  selectedCountry: any;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  showlist:boolean=false;
  constructor(private authService: AuthbaseService, private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.activatedRoute.queryParams.subscribe(params => {
      console.log(params)
      // if (params['token'] != undefined) {
      //   this.accesstoken =params['token'];
      //   console.log(this.accesstoken);
      //   this.fromregister = false;
      //   this.getConfirmemail(this.accesstoken)
      // }
    });
    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      deviceTypeCode: [],
      capacity: [],
      offTaker: [],
      SDGBenefits: [],
      start_date: [null],
      end_date: [null],
      //pagenumber: [this.p]
    });
  }
  ngOnInit(): void {
   
    console.log("myreservation");
    // setTimeout(() => {
      
     
      this.getAllOrganization(this.p);
    // },1000)
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  getAllOrganization(page: number) {
    //this.FilterForm.controls['pagenumber'].setValue(page);
    this.adminService.GetAllOrganization().subscribe(
      (data) => {
        console.log(data)
        this.showlist=true
        this.loading = false;
        //@ts-ignore
      this.data = data;//.filter(ele => ele.organizationType === 'Developer');
        console.log(this.data);
        this.dataSource = new MatTableDataSource(this.data);
        this.totalRows = this.data.totalCount
        console.log(this.totalRows);
        this.totalPages = this.data.totalPages
        // this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      }, error => {
        console.log(error);
        this.data = [];
        this.showlist=false
      }
    )
  }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getAllOrganization(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getAllOrganization(this.p);;
    }
  }

}
