
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { ReservationService } from '../../auth/services/reservation.service';
import { Router,NavigationEnd  } from '@angular/router';
import { Observable, Subscription, take,debounceTime  } from 'rxjs';
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
  offtaker = ['School', 'Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture']
  filteredOptions: Observable<any[]>;
  endminDate = new Date();
  group_info: any;
  reservationsstatus: any;
  reservationstart: any;
  subscription: Subscription;
  totalPages: number;
  isAnyFieldFilled: boolean = false;
  showerror:boolean=false;
  constructor(private authService: AuthbaseService,
    private reservationService: ReservationService,
    private router: Router, private formBuilder: FormBuilder,
    private toastrService: ToastrService,

  ) { }
  ngOnInit() {
    
    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      offTaker: [],
      SDGBenefits: [],
      reservationStartDate: [null],
      reservationEndDate: [null],
      reservationActive: [],
      // pagenumber: [this.p]
    });

    console.log("myreservation");
    this.DisplaycountryList();
    this.DisplayfuelList();
    this.DisplaytypeList();
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
        if (countryValue === undefined) {
          console.log('234')
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
      const isAllValuesNull = Object.values(updatedFormValues).some((value) => !!value);
      this.isAnyFieldFilled = isAllValuesNull;
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
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.isLoadingResults = true;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.DisplayList(this.p)
  }
  DisplayList(page: number) {
    console.log(this.FilterForm.value)
  //  this.FilterForm.controls['pagenumber'].setValue(page);
    if (this.FilterForm.value.reservationActive === "All") {
      this.FilterForm.removeControl('reservationActive');
    }
    if (!(this.FilterForm.value.reservationStartDate != null && this.FilterForm.value.reservationEndDate === null)) {

      this.reservationService.getReservationData(this.FilterForm.value,page).subscribe(
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
      this.toastrService.error("Filter error", "End date should be if in filter query you used with Start date");
    }
  }


  DisplayCertificatepage(reservation_row: any) {
    console.log(typeof reservation_row.deviceIds);
    let changedeviceId = JSON.stringify(reservation_row.deviceIds)
    console.log(typeof changedeviceId);
    this.router.navigate(['/certificate'], { queryParams: { id: reservation_row.id } });

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
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
