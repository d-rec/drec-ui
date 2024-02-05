
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { ReservationService,OrganizationService,CertificateService  } from '../../auth/services';
import { Router, NavigationEnd } from '@angular/router';
import { Observable, Subscription, take, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AnyCatcher } from 'rxjs/internal/AnyCatcher';

@Component({
  selector: 'app-myreservation',
  templateUrl: './myreservation.component.html',
  styleUrls: ['./myreservation.component.scss']
})



export class MyreservationComponent implements OnInit {
  displayedColumns = [
    'actions',
    'name',
    'aggregatedCapacity',
    'reservationActive',
    'frequency',
    'reservationStartDate',
    'reservationEndDate',
    'targetVolumeInMegaWattHour',
    //'fuelCode',
    'number Of Devices',
    'SDGBenefits',

  ];
  displayedColumns1 = [
    'createdAt',
    'projectName',
    'Name',
    'countryCode',
    'capacity',
    'offTaker',
    'deviceTypeCode',
    // 'fuelCode',
    'commissioningDate',
    'SDGBenefits',

  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator1: MatPaginator;
  @ViewChild(MatSort) sort1: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  pageSize: number = 10;
  showdevicesinfo: boolean = false;
  DevicesList: any;
  isLoadingResults: boolean = true;
  countrylist: any;
  fuellist: any;
  devicetypelist: any;
  FilterForm: FormGroup;
  public sdgblist: any;
  p: number = 1;
  totalRows = 0;
  offtaker = ['School', 'Education', 'Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture', 'Utility', 'Off-Grid Community']
  filteredOptions: Observable<any[]>;
  endminDate = new Date();
  group_info: any;
  reservationsstatus: any;
  reservationstart: any;
  subscription: Subscription;
  totalPages: number;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  loginuser: any;
  orgId: number;
  orglist: any;
  filteredOrgList: Observable<any[]>;
  showorgerror: boolean = false;
  constructor(private authService: AuthbaseService,
    private reservationService: ReservationService,
    private orgService: OrganizationService,
    private router: Router, private formBuilder: FormBuilder,
    private toastrService: ToastrService,
    private certificateService: CertificateService
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {

    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      offTaker: [],
      SDGBenefits: [],
      reservationStartDate: [null],
      reservationEndDate: [null],
      reservationActive: [null],

      // pagenumber: [this.p]
    });

    console.log("myreservation");
    this.DisplaycountryList();
    this.DisplayfuelList();
    this.DisplaytypeList();
    if (this.loginuser.role === 'ApiUser') {
      this.FilterForm.addControl('organizationname', this.formBuilder.control(''));
      this.FilterForm.addControl('organizationId', this.formBuilder.control(''));
      this.orgService.GetApiUserAllOrganization().subscribe(
        (data) => {

          //@ts-ignore
          this.orglist = data.organizations.filter(org => org.organizationType != "Developer");
          if (this.orglist.length > 0) {
            this.applyorgFilter();
          }
        }
      );
    }
    this.DisplaySDGBList()
    this.DisplayList(this.p)
    // this.getcountryListData();

    console.log("myreservation");
    setTimeout(() => {
      //  this.loading=false;
      this.applycountryFilter();
    }, 2000)
  }

  DisplaycountryList() {

    this.authService.GetMethod('countrycode/list').subscribe(
      (data) => {
        // display list in the console 
        // console.log(data)
        this.countrylist = data;

      }
    )
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe(
      (data) => {
        // display list in the console 
        this.fuellist = data;
      }
    )
  }
  DisplaytypeList() {

    this.authService.GetMethod('device/device-type').subscribe(
      (data) => {
        // display list in the console 

        this.devicetypelist = data;
      }
    )
  }

  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data) => {
        // display list in the console 
        console.log(data)
        this.sdgblist = data;
      }
    )
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationname'];
    this.filteredOrgList = this.FilterForm.controls['organizationname'].valueChanges.pipe(
      startWith(''),
      map(value => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): string[] {

    const filterValue = value.toLowerCase();
    if (!(this.orglist.filter((option: any) => option.name.toLowerCase().includes(filterValue)).length > 0)) {
      this.showorgerror = true;

    } else {
      this.showorgerror = false;
    }
    return this.orglist.filter((option: any) => option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  }
  selectorg(event: any) {
    console.log(event)

    this.subscription = this.filteredOrgList.subscribe(options => {

      const selectedorg = options.find(option => option.name === event.option.value);
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }
  applycountryFilter() {
    this.FilterForm.controls['countryname'];
    console.log(this.FilterForm.controls['countryname']);
    this.filteredOptions = this.FilterForm.controls['countryname'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
    console.log(this.filteredOptions);
  }
  private _filter(value: any): string[] {
    console.log(value)
    const filterValue = value.toLowerCase();
    if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;

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
        const countryValue = formValues.countryname;
        if (countryValue === undefined || countryValue === '') {
          this.FilterForm.controls['countryname'].setValue(null);
          this.FilterForm.controls['countryCode'].setValue(null);
        }
        const fuelCodeValue = formValues.fuelCode;
        if (fuelCodeValue != null && fuelCodeValue[0] === undefined) {
          this.FilterForm.controls['fuelCode'].setValue(null);
        }
        if (formValues.offTaker != null && formValues.offTaker[0] === undefined) {
          this.FilterForm.controls['offTaker'].setValue(null);
        }
        if (formValues.SDGBenefits != null && formValues.SDGBenefits[0] === undefined) {
          this.FilterForm.controls['SDGBenefits'].setValue(null);
        }
        // Other code...
      }
    });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      console.log(updatedFormValues);
      const isAllValuesNull = Object.values(updatedFormValues).some((value) => !!value);
      this.isAnyFieldFilled = isAllValuesNull;
      console.log(this.isAnyFieldFilled);
      if (!this.isAnyFieldFilled) {
        this.DisplayList(this.p)
      }

    }, 500);

    // Other code...
  }
  onEndChangeEvent(event: any) {
    console.log(event);
    this.endminDate = event;
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

  formfilter() {
    this.p = 1;
    this.DisplayList(this.p)
  }

  reset() {
    this.FilterForm.addControl('reservationActive', new FormControl())
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.FilterForm.controls['reservationActive'].setValue(null);
    if (this.loginuser.role === 'ApiUser') {
      this.FilterForm.controls['organizationname'].setValue(null);
      this.FilterForm.controls['organizationId'].setValue(null);
    }


    console.log(this.FilterForm.value)
    this.isLoadingResults = true;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.DisplayList(this.p)
  }
  DisplayList(page: number) {
    console.log(this.FilterForm.value)
    //  this.FilterForm.controls['pagenumber'].setValue(page);
    if (this.loginuser.role === 'ApiUser') {
      if (this.FilterForm.value.reservationActive === "All") {
        this.FilterForm.removeControl('reservationActive');
        //this.FilterForm.controls['reservationActive'].setValue(null);
      }
      if (!(this.FilterForm.value.reservationStartDate != null && this.FilterForm.value.reservationEndDate === null)) {

        this.reservationService.getReservationDataByadmin(this.FilterForm.value, page).subscribe(
          (data) => {
            this.showdevicesinfo = false;

            this.data = data.groupedData;
            //@ts-ignore
            this.data.forEach(ele => {

              if (ele.deviceIds != null) {
                ele['numberOfdevices'] = ele.deviceIds.length;
              } else {
                ele['numberOfdevices'] = 0;
              }
            })
            this.isLoadingResults = false;
            this.dataSource = new MatTableDataSource(this.data);
            console.log(this.dataSource);
            this.totalRows = data.totalCount;
            console.log(this.totalRows);
            this.totalPages = data.totalPages
            this.dataSource.sort = this.sort;
          }
        )
      } else {
        this.toastrService.error("Filter error", "End date should be required");
      }
    } else {
      if (this.FilterForm.value.reservationActive === "All") {
        this.FilterForm.removeControl('reservationActive');
        //this.FilterForm.controls['reservationActive'].setValue(null);
      }
      if (!(this.FilterForm.value.reservationStartDate != null && this.FilterForm.value.reservationEndDate === null)) {

        this.reservationService.getReservationData(this.FilterForm.value, page).subscribe(
          (data) => {
            this.showdevicesinfo = false;

            this.data = data.groupedData;
            //@ts-ignore
            this.data.forEach(ele => {

              if (ele.deviceIds != null) {
                ele['numberOfdevices'] = ele.deviceIds.length;
              } else {
                ele['numberOfdevices'] = 0;
              }
            })
            this.isLoadingResults = false;
            this.dataSource = new MatTableDataSource(this.data);
            console.log(this.dataSource);
            this.totalRows = data.totalCount;
            console.log(this.totalRows);
            this.totalPages = data.totalPages
            this.dataSource.sort = this.sort;
          }
        )
      } else {
        this.toastrService.error("Filter error", "End date should be required");
      }
    }

  }


  DisplayCertificatepage(reservation_row: any) {
    console.log(typeof reservation_row.deviceIds);
    let changedeviceId = JSON.stringify(reservation_row.deviceIds)
    console.log(typeof changedeviceId);
    this.router.navigate(['/certificate'], { queryParams: { id: reservation_row.id, group_uid: reservation_row.devicegroup_uid } });

  }
  DisplayDeviceList(row: any) {
    //this.FilterForm.reset();
    this.showdevicesinfo = true;

    this.group_info = row;
    //  this.reservationsstatus=row.reservationActivethis, 

    // this.reservationstart= "start from "+row.reservationStartDate+ " To "+row. reservationEndDate 
    this.DevicesList = [];
    //@ts-ignore
    row.deviceIds.forEach(ele => {
      this.authService.GetMethod('device/' + ele).subscribe(
        (data) => {

          this.data = data;
          // this.data.forEach(ele => {
          //@ts-ignore
          this.data['fuelname'] = this.fuellist.find((fuelType) => fuelType.code === this.data.fuelCode)?.name;
          //@ts-ignore
          this.data['devicetypename'] = this.devicetypelist.find(devicetype => devicetype.code == this.data.deviceTypeCode)?.name;
          //@ts-ignore
          this.data['countryname'] = this.countrylist.find(countrycode => countrycode.alpha3 == this.data.countryCode)?.country;
          // })
          this.DevicesList.push(data)
          this.dataSource1 = new MatTableDataSource(this.DevicesList);
        })

    });

  }

  Gobacklist(): void {
    window.scrollTo(0, 0);
    this.showdevicesinfo = false;
    this.p = 1;
    this.DisplayList(this.p)
  }
  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.DisplayList(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.DisplayList(this.p);;
    }
  }
  ExpoertPerDevice_csv(row: any) {
    this.certificateService.getcertifiedlogPerDevice(row.devicegroup_uid).subscribe({
      next: (data: any) => {
       // console.log(data.headers.keys());  // Log all headers
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const a = document.createElement('a');
        a.href = url;
        a.download = `${row.name}_${currentDate}.csv`; // Replace with the desired file name
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);//
      }, error: err => {
        console.log(err)
        if(err.status===404){
          this.toastrService.error('Download fail', 'Devices log Not found')
        }else{
          this.toastrService.error('Download fail', err.error.message)
        }
        
      }
    })
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
