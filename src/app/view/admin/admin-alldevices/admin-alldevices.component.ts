

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
import { DeviceService, AdminService } from '../../../auth/services';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DeviceDetailsComponent } from '../../device/device-details/device-details.component'
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-admin-alldevices',
  templateUrl: './admin-alldevices.component.html',
  styleUrls: ['./admin-alldevices.component.scss']
})
export class AdminAlldevicesComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = [
    //'onboarding_date',
    // 'projectName',
    'organization',
    'developerExternalId',
    'externalId',
    'countryCode',
    'fuelCode',
    // 'commissioningDate',
    'capacity',
    'IREC_Status',
    'IREC_ID',
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
  filteredOptions1: Observable<any[]>;
  offtaker = ['School','Education','Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture','Utility','Off-Grid Community']
  endminDate = new Date();
  totalPages: number;
  subscription: Subscription;
  selectedCountry: any;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  showorgerror:boolean=false;
  showlist: boolean = false;
  orglist:any;
  constructor(private authService: AuthbaseService, private deviceService: DeviceService, private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private toastrService: ToastrService) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.FilterForm = this.formBuilder.group({
      organizationname:[],
      organizationId: [],
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
    this.adminService.GetAllOrganization().subscribe(
      (data) => {
        this.orglist = data;
      })
    this.authService.GetMethod('device/fuel-type').subscribe(
      (data1) => {

        this.fuellist = data1;
        this.fuellistLoaded = true;
      });
    this.authService.GetMethod('device/device-type').subscribe(
      (data2) => {

        this.devicetypelist = data2;
        this.devicetypeLoded = true;
      }
    );
    this.authService.GetMethod('countrycode/list').subscribe(
      (data3) => {

        this.countrylist = data3;
        this.countrycodeLoded = true;
      }
    )
    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data) => {
        this.sdgblist = data;
      }
    )

    console.log("myreservation");
    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }
      this.applyorgFilter()
      this.loading = false;
      this.getDeviceListData(this.p);
    }, 2000)
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  // checkFormValidity(): void {
  //   console.log("115");
  //   const formValues = this.FilterForm.value;
  //   console.log(formValues)
  //   this.isAnyFieldFilled = Object.values(formValues).some(value => !!value);

  // }

  applyorgFilter() {
    this.FilterForm.controls['organizationname'];
    this.filteredOptions1 = this.FilterForm.controls['organizationname'].valueChanges.pipe(
      startWith(''),
      map(value => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): string[] {

    const filterValue = value.toLowerCase();
    if (!(this.orglist.filter((option: any) => option.name.toLowerCase().includes(filterValue)).length > 0)) {
      this.showorgerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      this.showorgerror = false;
    }
    return this.orglist.filter((option: any) => option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  }
  applycountryFilter() {
    this.FilterForm.controls['countryname'];
    this.filteredOptions = this.FilterForm.controls['countryname'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
  }

  private _filter(value: any): string[] {

    const filterValue = value.toLowerCase();
    if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter((option: any) => option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  }

  checkFormValidity(): void {
    let isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges.pipe(
      debounceTime(500) // Debounce the stream for 500 milliseconds
    ).subscribe((formValues) => {
      if (isUserInteraction) {
        if (formValues.organizationId === undefined || formValues.organizationId === '') {
          this.FilterForm.controls['organizationname'].setValue(null);
          this.FilterForm.controls['organizationId'].setValue(null);
        }
        const countryValue = formValues.countryname;
        if (countryValue === undefined || countryValue === '') {
          this.FilterForm.controls['countryname'].setValue(null);
          this.FilterForm.controls['countryCode'].setValue(null);
        }
        const fuelCodeValue = formValues.fuelCode;
        if (fuelCodeValue === undefined) {
          this.FilterForm.controls['fuelCode'].setValue(null);
        }
        console.log(formValues.deviceTypeCode);
        if (formValues.offTaker != null && formValues.offTaker[0] === undefined) {
          this.FilterForm.controls['offTaker'].setValue(null);
        }
        console.log(formValues.deviceTypeCode);
        if (formValues.deviceTypeCode != null && formValues.deviceTypeCode[0] === undefined) {
          this.FilterForm.controls['deviceTypeCode'].setValue(null);
        }
        if (formValues.SDGBenefits != null && formValues.SDGBenefits[0] === undefined) {
          this.FilterForm.controls['SDGBenefits'].setValue(null);
        }
        // Other code...
      }
    });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some((value) => !!value);
      this.isAnyFieldFilled = isAllValuesNull;
      if (!this.isAnyFieldFilled) {
        this.getDeviceListData(this.p)
      }
    }, 500);

    // Other code...
  }
  selectCountry(event: any) {
    console.log(event)

    this.subscription = this.filteredOptions.subscribe(options => {

      const selectedCountry = options.find(option => option.country === event.option.value);
      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(selectedCountry.alpha3);
      }
    });
  }
  selectorg(event: any) {
    console.log(event)

    this.subscription = this.filteredOptions1.subscribe(options => {

      const selectedorg = options.find(option => option.name === event.option.value);
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }

  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  onEndChangeEvent(event: any) {
    console.log(event);
    this.endminDate = event;
  }

  DisplayListFilter() {
    this.p = 1;
    this.getDeviceListData(this.p);
  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  getDeviceListData(page: number) {

    this.deviceurl = 'device?';

    //this.FilterForm.controls['pagenumber'].setValue(page);
    this.deviceService.GetMyDevices(this.deviceurl, this.FilterForm.value, page).subscribe(
      (data) => {
        console.log(data)
        this.showlist = true
        //@ts-ignore
        if (data.devices) {
          this.loading = false;
          //@ts-ignore
          this.data = data;
          this.DisplayList()
        }
      }, error => {
        console.log(error);
        this.data = [];
        this.showlist = false
      }
    )
  }

  DisplayList() {
    if (this.fuellistLoaded == true && this.devicetypeLoded == true && this.countrycodeLoded === true) {

      //@ts-ignore
      this.data.devices.forEach(ele => {
        //@ts-ignore
        ele['fuelname'] = this.fuellist.find((fuelType) => fuelType.code === ele.fuelCode,)?.name;
        //@ts-ignore
        ele['devicetypename'] = this.devicetypelist.find(devicetype => devicetype.code == ele.deviceTypeCode)?.name;
        //@ts-ignore
        ele['countryname'] = this.countrylist.find(countrycode => countrycode.alpha3 == ele.countryCode)?.country;
      })

      this.dataSource = new MatTableDataSource(this.data.devices);
      this.totalRows = this.data.totalCount
      console.log(this.totalRows);
      this.totalPages = this.data.totalPages
      // this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

    }

  }
  UpdateDevice(externalId: any) {
    this.router.navigate(['/device/edit/' + externalId], { queryParams: { fromdevices: true } });
  }
  // pageChangeEvent(event: PageEvent) {
  //   console.log(event);
  //   this.p = event.pageIndex + 1;

  //   this.getDeviceListData();
  // }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getDeviceListData(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getDeviceListData(this.p);;
    }
  }
  // showPrompt(deviceId:number): void {
  //   const dialogRef = this.dialog.open(DeviceDetailsComponent, {
  //     width: '500px',
  //     height: '400px',
  //   });

  //   dialogRef.afterClosed().subscribe((data) => {
  //     this.dataFromDialog = data.form;
  //     if (data.clicked === 'submit') {
  //       console.log('Sumbit button clicked');
  //     }
  //   });
  // }
  alertDialog(deviceId: number): void {
    const dialogRef = this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId
      },
      width: '900px',
      height: '400px',
    });
  }

  DeviceregistationI_REC(deviceid: number) {
    this.adminService.AddIrecDevice(deviceid).subscribe({
      next: (data: any) => {

        if (data.status) {
          this.toastrService.success(data.message, 'I-REC ID-' + data.IREC_ID);
          this.getDeviceListData(this.p);

        } else {
          this.toastrService.warning('Failure', data.message);
        }

      }, error: err => {
        this.toastrService.error('Failure', err);
      }
    });
    ;

  }
}
