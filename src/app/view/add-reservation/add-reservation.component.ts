import { SelectionModel } from '@angular/cdk/collections';
import { Component, ViewChild, TemplateRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator,PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { ParseTreeResult } from '@angular/compiler';
import { ToastrService } from 'ngx-toastr';
import { DeviceService } from '../../auth/services/device.service'
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatBottomSheet, MatBottomSheetConfig, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MeterReadTableComponent } from '../meter-read/meter-read-table/meter-read-table.component'
import { Observable,Subscription,debounceTime  } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import {DeviceDetailsComponent} from '../device/device-details/device-details.component'
@Component({
  selector: 'app-add-reservation',
  templateUrl: './add-reservation.component.html',
  styleUrls: ['./add-reservation.component.scss']
})

export class AddReservationComponent {
  displayedColumns = [
    'select',
    'onboarding_date',
    'projectName',
    'externalId',
    'countryCode',
    'fuelCode',
    'status',
    'viewread'

  ];
  bottomSheetRef = {} as MatBottomSheetRef<MeterReadTableComponent>
  @ViewChild('mypopupDialog') popupDialog = {} as TemplateRef<any>;
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
  loading: boolean = false;
  selection = new SelectionModel<any>(true, []);
  reservationForm: FormGroup;
  filteredOptions: Observable<any[]>;
  endminDate = new Date();
  filterendminDate = new Date();
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
  offtaker = ['School', 'Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture']
  frequency = ['hourly', 'daily', 'weekly', 'monthly']
  dialogRef: any;
  sdgblist:any;
  totalPages: number;
  subscription: Subscription;
  isAnyFieldFilled: boolean = false;
  showerror:boolean=false;
  reservationbollean = { continewwithunavilableonedevice: true, continueWithTCLessDTC: true };
  constructor(private authService: AuthbaseService, private router: Router,
    public dialog: MatDialog, private bottomSheet: MatBottomSheet,
    private formBuilder: FormBuilder, private toastrService: ToastrService, private deviceservice: DeviceService) {
    this.loginuser = sessionStorage.getItem('loginuser');
    this.reservationForm = this.formBuilder.group({
      name: [null, Validators.required],
      deviceIds: [Validators.required],
      targetCapacityInMegaWattHour: [null],
      reservationStartDate: [null, Validators.required],
      reservationEndDate: [null, Validators.required],
      continueWithReservationIfOneOrMoreDevicesUnavailableForReservation: [true],
      continueWithReservationIfTargetCapacityIsLessThanDeviceTotalCapacityBetweenDuration: [true],
      authorityToExceed: [true],
      frequency: [null, Validators.required],
      blockchainAddress: [null]
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
      // pagenumber: [this.p]
    });

    this.FilterForm.valueChanges.subscribe(() => {
      this.isAnyFieldFilled = Object.values(this.FilterForm.value).some(value => value !== null);
    });
  }
  ngOnInit() {
    this.authService.GetMethod('device/fuel-type').subscribe(
      (data1: any) => {

        this.fuellist = data1;
        this.fuellistLoaded = true;
      });
    this.authService.GetMethod('device/device-type').subscribe(
      (data2: any) => {
        this.devicetypelist = data2;
        this.devicetypeLoded = true;
      }
    );
    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data) => {
        // display list in the console 
        this.sdgblist = data;
      }
    )
    this.authService.GetMethod('countrycode/list').subscribe(
      (data3: any) => {
        this.countrylist = data3;
        this.countrycodeLoded = true;
      }
    )
   // this.getcountryListData();
  
    console.log("myreservation");
    setTimeout(() => {
      this.applycountryFilter();
      this.displayList(this.p);
      
    }, 1000)
    
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
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
     
    } else {
      this.showerror = false;
    }
      return this.countrylist.filter((option: any) => option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);
  
    }
  selectCountry(event: any) {  
    this.subscription =  this.filteredOptions.subscribe(options => {
    const selectedCountry = options.find(option => option.country === event.option.value);
    if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(selectedCountry.alpha3);
      }
    });
  }
  checkFormValidity(): void {
    let isUserInteraction = true; // Flag to track user interaction
    this.FilterForm.valueChanges.pipe(
      debounceTime(500) // Debounce the stream for 500 milliseconds
    ).subscribe((formValues) => {
      if (isUserInteraction) {
        const countryValue = formValues.countryname;
        console.log(countryValue)
        if (countryValue === undefined) {
          console.log('234')
          this.FilterForm.controls['countryname'].setValue(null);
          this.FilterForm.controls['countryCode'].setValue(null);
         
        }
        const fuelCodeValue = formValues.fuelCode;
        if (fuelCodeValue != null && fuelCodeValue === undefined) {
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
console.log(this.FilterForm.value)
    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some((value) => !!value);
      this.isAnyFieldFilled = isAllValuesNull;
    }, 500);

    // Other code...
  }
  openBottomSheet(device: any) {
    if (this.reservationForm.value.reservationStartDate != null && this.reservationForm.value.reservationEndDate != null) {
      let requestreaddata: any = { devicename: device.externalId, rexternalid: device.id, reservationStartDate: this.reservationForm.value.reservationStartDate, reservationEndDate: this.reservationForm.value.reservationEndDate }
      const config: MatBottomSheetConfig = { data: requestreaddata };
      this.bottomSheetRef = this.bottomSheet.open(MeterReadTableComponent, config);
      this.bottomSheetRef.afterOpened().subscribe(() => {
        console.log('Bottom sheet is open.');
      });
      this.bottomSheetRef.afterDismissed().subscribe(data => {
        console.log('Return value: ', data);
      });
    } else {
      this.toastrService.error('Validation!', 'Please add start and end date');
    }

  }
  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.p=1;
    this.selection.clear();
    this.displayList(this.p);
   this.isAnyFieldFilled=false;
    
  }

  isAllSelected() {
    console.log("125")
    console.log(this.selection.selected);
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }
  masterToggle() {
    console.log("131")
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }
  onEndChangeEvent(event: any) {
    console.log(event);
    this.endminDate = event;
  }
  onfilterEndChangeEvent(event: any) {
    console.log(event);
    this.filterendminDate = event;
  }
  // getcountryListData() {

    
  // }

  applyFilter(){
    this.loading = true;
    this.p=1;
    console.log(this.p);
    this.displayList(this.p);
  }
  displayList(page:number) {
    // this.data=this.selection.selected;
    console.log(this.FilterForm.value);
    console.log(this.p);
  //  this.FilterForm.controls['pagenumber'].setValue(page);
    this.deviceservice.getfilterData(this.FilterForm.value,page).subscribe(
      (data) => {
        this.loading = false;
        if (this.selection.selected.length > 0) {
          this.selection.selected.forEach((ele) => {

            const selectedIndex = data.devices.findIndex((row: any) => row.id === ele.id);

            if (selectedIndex !== -1) {
              // The selected ID exists, so remove it from the data list
              data.devices.splice(selectedIndex, 1);
              data.devices.push(ele);
            } else {
              // The selected ID doesn't exist, so add it to the data list
              data.devices.push(ele);
            }
          }
          );
        }

        this.data = data.devices;
        console.log(this.data)
        //@ts-ignore
        this.data.forEach(ele => {
          //@ts-ignore
          ele['fuelname'] = this.fuellist.find((fuelType) => fuelType.code === ele.fuelCode,)?.name;
          //@ts-ignore
          ele['devicetypename'] = this.devicetypelist.find(devicetype => devicetype.code == ele.deviceTypeCode)?.name;
          //@ts-ignore
          ele['countryname'] = this.countrylist.find(countrycode => countrycode.alpha3 == ele.countryCode)?.country;
        })
        console.log(this.data)
        this.dataSource = new MatTableDataSource(this.data);
        this.totalRows = data.totalCount
        console.log(this.totalRows);
        this.totalPages = data.totalPages
        //this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;   
        //@ts-ignore
      }
    )
  }
  onSubmit(): void {
    console.log(this.reservationForm.value)

    if (this.selection.selected.length > 0) {

      let deviceId: any = []
      this.selection.selected.forEach(ele => {
        deviceId.push(ele.id)
      })
      this.reservationForm.controls['deviceIds'].setValue(deviceId)
      console.log(this.reservationForm);
      this.openpopupDialog(this.reservationForm)
    } else {
      this.toastrService.error('Please select at least one device', 'Validation Error!');
    }
  }


  openpopupDialog(reservationForm: any) {
    console.log("reservationForm");
    this.dialogRef = this.dialog.open(this.popupDialog,
      { data: this.reservationbollean, height: '300px', width: '500px' });
    console.log(this.reservationForm)
    this.dialogRef.afterClosed().subscribe((result: any) => {
      this.onContinue(result);
    });
  }
  onContinue(result: any) {
    this.reservationForm.controls['continueWithReservationIfOneOrMoreDevicesUnavailableForReservation'].setValue(result.continewwithunavilableonedevice);
    this.reservationForm.controls['continueWithReservationIfTargetCapacityIsLessThanDeviceTotalCapacityBetweenDuration'].setValue(result.continueWithTCLessDTC);
    this.authService.PostAuth('device-group', this.reservationForm.value).subscribe({
      next: data => {
        console.log(data)
        this.reservationForm.reset();
        this.selection.clear();
        this.FilterForm.reset();
        //  this.getDeviceListData();
        this.toastrService.success('Successfully!!', 'Reservation Added');
        this.dialogRef.close(); 
        this.router.navigate(['/myreservation']);
      },
      error: err => {                          //Error callback
        console.error('error caught in component', err)
        this.toastrService.error('error!', err.error.message);
      }
    });

  }
  
  // pageChangeEvent(event: PageEvent) {
  //   console.log(event);
  //   this.p = event.pageIndex + 1;
  //   this.displayList();
  // }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.displayList(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.displayList(this.p);;
    }
  }
  alertDialog(deviceId:number): void {
    const dialogRef = this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
     height: '400px',
    });
  }
}
