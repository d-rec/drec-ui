import { Component, ViewChild, OnInit, Inject } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { MeterReadService, DeviceService, AdminService, OrganizationService } from '../../../auth/services';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MeterReadTableComponent } from '../meter-read-table/meter-read-table.component'
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
@Component({
  selector: 'app-all-metereads',
  templateUrl: './all-metereads.component.html',
  styleUrls: ['./all-metereads.component.scss']
})
export class AllMetereadsComponent implements OnInit {
  @ViewChild(MeterReadTableComponent)
  public counterComponent: MeterReadTableComponent;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  displayedColumns: string[] = ['startdate', 'enddate', 'value'];//... set columns here

  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  readdata: any;

  devicedata: any;
  p: number = 1;
  total: number = 0;
  externalId: any;
  FilterForm: FormGroup;
  endminDate = new Date();
  showfilterform: boolean = true;
  totalRows = 0;
  pageSize = 5;
  currentPage = 0;
  pageSizeOptions: number[] = [5];
  filter: boolean = false;
  loginuser: any
  selectedResult: any;
  filteredOptions: Observable<any[]>;
  autocompleteResults: any[] = [];
  // searchControl: FormControl = new FormControl();
  filteredResults: Observable<any[]>;
  filteredOrgList: any[] = [];
  //public color: ThemePalette = 'primary';
  orgname: any;
  orgId: any;
  orglist: any;
  showerrorexternalid: boolean = false;
  showerror: boolean;
  filteredexternalIdOptions: Observable<any[]>;
  devicelist: any = [];
  constructor(private service: MeterReadService, private formBuilder: FormBuilder,
    private deviceservice: DeviceService,
    private adminService: AdminService,
    private orgService: OrganizationService

  ) {

    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {

    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe(
        (data) => {
          //@ts-ignore
          this.orglist = data.organizations.filter(org => org.organizationType != "Buyer");
          this.filteredOrgList = this.orglist;
        })
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe(
        (data) => {
          //@ts-ignore
          this.orglist = data.organizations.filter(org => org.organizationType != "Buyer");

          // const buyerOrganizations = data.filter(org => org.organizationType === "Buyer");
          this.filteredOrgList = this.orglist;
          // Once data is loaded, call any other functions that depend on it

          // this.date = new Date();
        }
      );
    }
    else {
      this.gedevicefororg();
    }
    this.DisplayList();

    this.FilterForm = this.formBuilder.group({
      externalId: [null, Validators.required],
      start: [null, Validators.required],
      end: [null, Validators.required],
      pagenumber: [this.p]
    });

    setTimeout(() => {
      if (this.loginuser.role != 'Admin') {
        this.FilterForm.controls['externalId'];
        this.filteredexternalIdOptions = this.FilterForm.controls['externalId'].valueChanges.pipe(
          startWith(''),
          map(value => this._externalIdfilter(value || '')),
        );
      }
      //  this.getDeviceinfo();
    }, 2000);
  }
  filterOrgList() {
    console.log("99")
    this.filteredOrgList = this.orglist.filter((org: any) => {

      return org.name.toLowerCase().includes(this.orgname.toLowerCase());



    });
  }
  selectOrg(event: any) {
    //@ts-ignore
    const selectedCountry = this.orglist.find(option => option.name === event.option.value);
    if (selectedCountry) {
      this.filteredexternalIdOptions = of([]);
      this.FilterForm.reset();
      this.filter = false;
      this.externalId = null;
      this.orgId = selectedCountry.id;
      if (this.loginuser.role === 'ApiUser') {
        this.FilterForm.addControl('organizationId', this.formBuilder.control(''));
        this.gedevicefororg();
      } else {
        this.gedeviceforadmin(this.orgId);
      }

    }

  }
  gedeviceforadmin(orgid: number) {
    const deviceurl = 'device?OrganizationId=' + orgid;
    this.deviceservice.GetMyDevices(deviceurl).subscribe({
      next: data => {
        this.devicelist = data.devices
        this.FilterForm.controls['externalId'];
        this.filteredexternalIdOptions = this.FilterForm.controls['externalId'].valueChanges.pipe(
          startWith(''),
          map(value => this._externalIdfilterbyAdmin(value || '')),
        );
   

      }
    })
  }
  gedevicefororg() {
    if (this.loginuser.role === 'ApiUser') {
      const deviceurl = 'device/my?';
      const FilterForm = { organizationId: this.orgId }
      this.deviceservice.GetMyDevices(deviceurl, FilterForm).subscribe({
        next: data => {
          this.devicelist = data.devices;
          this.FilterForm.controls['externalId'];
          this.filteredexternalIdOptions = this.FilterForm.controls['externalId'].valueChanges.pipe(
            startWith(''),
            map(value => this._externalIdfilter(value || '')),
          );
        
        }
      })
    } else {
      const deviceurl = 'device/my';
      this.deviceservice.GetMyDevices(deviceurl).subscribe({
        next: data => {
          this.devicelist = data;
        }
      })
    }
  }

  _externalIdfilter(value: string): string[] {
 
    let filterValue:any;
    if(typeof value ==='string'){
      filterValue = value.toLowerCase();
    }else{
      //@ts-ignore
      filterValue = value.externalId.toLowerCase();
    }
    
    //  console.log(filterValue)
    // console.log(this.timezonedata.filter((option: any) => option.name.toLowerCase().includes(filterValue)));
    if ((!(this.devicelist.filter((option: any) => option.externalId.toLowerCase().includes(filterValue)).length > 0) && filterValue != '')) {
      this.showerror = true;
      this.showerrorexternalid = true;
    } else {
      this.showerror = false;
      this.showerrorexternalid = false;
    }
    //  this.endmaxdate = new Date();
    return this.devicelist.filter((option: any) => option.externalId.toLowerCase().includes(filterValue))

  }

  _externalIdfilterbyAdmin(value: any): string[] {
   
    const filterValue = value.toLowerCase();
    //  console.log(filterValue)
    // console.log(this.timezonedata.filter((option: any) => option.name.toLowerCase().includes(filterValue)));
    if ((!(this.devicelist.filter((option: any) => option.developerExternalId.toLowerCase().includes(filterValue)).length > 0) && filterValue != '')) {
      this.showerror = true;
      this.showerrorexternalid = true;
    } else {
      this.showerror = false;
      this.showerrorexternalid = false;
    }
    //  this.endmaxdate = new Date();
    return this.devicelist.filter((option: any) => option.developerExternalId.toLowerCase().includes(filterValue))

  }
  search(): void {
    const input = this.FilterForm.controls['externalId'].value;
    if (input) {
      if (this.loginuser.role === 'Admin') {
        this.adminService.GetDeviceAutocomplete(input, this.orgId).subscribe(
          (response) => {
            this.autocompleteResults = response;
            this.showerrorexternalid = false;
          },
          (error) => {
            console.error('Error fetching autocomplete results:', error);
          }
        );
      } else {
        this.deviceservice.GetDeviceAutocomplete(input,).subscribe(
          (response) => {
            this.showerrorexternalid = false;
            this.autocompleteResults = response;
          },
          (error) => {
            console.error('Error fetching autocomplete results:', error);
          }
        );
      }

    } else {
      this.autocompleteResults = [];
      this.showerrorexternalid = true;
    }
  }
  displayFn(result: any): string {

    return result;
  }
  lastreadvalue: number;
  lastreaddate: any;
  // onSelect(result: any): void {
  //   console.log(result)
  //   this.selectedResult = result;
  //   console.log(this.selectedResult);
  //   console.log(result);
  //   this.FilterForm.controls['externalId'].setValue(result.externalId);
  //   if(this.loginuser.role==='Admin'){
  //     this.externalId = result.id;
  //   }else{
  //     this.externalId = result.exterenalId;
  //   }

  // }
  onSelect(result: any): void {
    this.selectedResult = result;
  
    if (this.loginuser.role === 'Admin') {
      this.FilterForm.controls['externalId'].setValue(result.developerExternalId);
      this.externalId = result.id;
    }
    //else if (this.loginuser.role === 'ApiUser') {

    //   this.FilterForm.controls['externalId'].setValue(result.externalId);
    //   this.externalId = result.id;
    // }
    else {
      this.FilterForm.controls['externalId'].setValue(result.externalId);
      this.externalId = result.externalId;

    }

    this.FilterForm.controls['start'].setValue(result.commissioningDate);
    this.FilterForm.controls['end'].setValue(new Date());

    this.getPagedData();
  }
  reset() {
    this.FilterForm.reset();
    this.filter = false;
    this.externalId = null;
    this.orgname = null;
    this.orgId = null;
    this.counterComponent.start(this.FilterForm, this.externalId, this.filter);
    this.autocompleteResults = [];
  }
  DisplayList() {
    if (this.loginuser.role === 'Buyer') {
      this.deviceservice.GetUnreserveDevices().subscribe(
        (data) => {
          
          this.devicedata = data;
        }
      )
    } else if (this.loginuser.role === 'OrganizationAdmin') {
      const deviceurl = 'device/my';
      this.deviceservice.GetMyDevices(deviceurl).subscribe(
        (data) => {
        
          this.devicedata = data;
        }
      )
    } else {
      this.deviceservice.GetDevicesForAdmin().subscribe(
        (data) => {
          
          this.devicedata = data;
        }
      )
    }

  }
  onEndChangeEvent(event: any) {
   
    this.endminDate = event;
  }
  getPagedData() {
    this.filter = true;
    
    this.FilterForm.controls['pagenumber'].setValue(this.p);
    if (this.loginuser.role === 'ApiUser') {
      this.FilterForm.controls['organizationId'].setValue(this.orgId);
    }
    this.counterComponent.start(this.FilterForm, this.externalId, this.filter);
  }

  pageChangeEvent(event: PageEvent) {
 
    this.p = event.pageIndex + 1;
    this.getPagedData();
  }
}
