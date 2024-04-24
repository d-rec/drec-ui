

import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, ViewChild, TemplateRef, ElementRef, ViewChildren, QueryList, ChangeDetectorRef, OnInit, Input, OnDestroy } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, group, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BlockchainDrecService } from '../../auth/services/blockchain-drec.service';
import { BlockchainProperties } from '../../models/blockchain-properties.model';
import { errors, ethers } from 'ethers';
import { ToastrService } from 'ngx-toastr';
import { ReservationService } from '../../auth/services/reservation.service';

import { MeterReadService } from '../../auth/services/meter-read.service'
export interface Student {
  firstName: string;
  lastName: string;
  studentEmail: string;
  course: string;
  yearOfStudy: number;

}
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import * as moment from 'moment';
import { DateAdapter } from '@angular/material/core';
import { DeviceService } from '../../auth/services/device.service';
import { CertificateService } from '../../auth/services/certificate.service'
import { DeviceDetailsComponent } from '../device/device-details/device-details.component'
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatDateRangePicker } from '@angular/material/datepicker';

@Component({
  selector: 'app-certified-devices-developer',
  templateUrl: './certified-devices-developer.component.html',
  styleUrls: ['./certified-devices-developer.component.scss']
})
export class CertifiedDevicesDeveloperComponent {
  startDate: Date;
  endDate: Date;
  @Input() dataFromComponentA: any;
  @ViewChild('templateBottomSheet') TemplateBottomSheet: TemplateRef<any>;
  displayedColumns = ['serialno', 'certificateStartDate', 'certificateEndDate', 'owners'];
  innerDisplayedColumns = ['certificate_issuance_startdate', 'certificate_issuance_enddate', 'externalId', 'readvalue_watthour',
    'Action'
  ];
  //@ViewChild(MatDateRangePicker) picker: MatDateRangePicker<Date>;
  @ViewChild('startThumb') startThumb: ElementRef<HTMLInputElement>;
  @ViewChild('endThumb') endThumb: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  obs: Observable<any>;
  data: any;
  group_id: string;
  group_uid: string;
  energyurl: any;
  group_name: any;
  panelOpenState = false;
  claimData: FormGroup;
  countrylist: any;
  maxDate = new Date();
  filteredOptions: Observable<any>;
  loading: boolean = true;
  history_nextissuanclist: any;
  ongoingnextissuance: any;
  devicesId: any
  alldevicescertifiedlogdatrange: any = [];
  intervalId: any;
  reservationstatus: boolean;
  totalRows = 0;
  pageSize: number = 10;
  totalPages: number;
  p: number = 1;
  FilterForm: FormGroup;
  offtaker = ['School','Education','Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture','Utility','Off-Grid Community']
  endminDate = new Date();
  sdgblist: any;
  fuellist: any;
  devicetypelist: any;
  subscription: Subscription;
  showerror: boolean = false;
  countrycodeLoded: boolean = false;
  startValueControl: FormControl;
  endValueControl: FormControl;
  startvalue: number = 1000;
  endvalue: number = 5000001;
  constructor(private blockchainDRECService: BlockchainDrecService, private authService: AuthbaseService, private router: Router, private activatedRoute: ActivatedRoute, private toastrService: ToastrService, private bottomSheet: MatBottomSheet,
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private readService: MeterReadService,
    private deviceService: DeviceService,
    private certificateService: CertificateService,
    private formBuilder: FormBuilder,
    private dialog: MatDialog
  ) {
    this.startValueControl = new FormControl(25); // Set initial start value
    this.endValueControl = new FormControl(75);
    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      // deviceTypeCode: [],
      capacity: [],
      offTaker: [],
      SDGBenefits: [],
      start_date: [null],
      end_date: [null],
      // fromAmountread: [null],
      // toAmountread: [null],
      // pagenumber: [this.p]
    });

  }
  ngOnInit() {

    this.energyurl = environment.Explorer_URL + '/block/';

    this.authService.GetMethod('device/fuel-type').subscribe(
      (data1) => {
        this.fuellist = data1;
        // this.fuellistLoaded = true;
      });
    this.authService.GetMethod('device/device-type').subscribe(
      (data2) => {
        this.devicetypelist = data2;
      }
    );
    this.authService.GetMethod('countrycode/list').subscribe(
      (data3) => {
        this.countrylist = data3;
        this.countrycodeLoded = true;
        this.applycountryFilter();
      }
    )
    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data) => {
        // display list in the console 
        this.sdgblist = data;
      }
    )
    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }
      this.DisplayList(this.p);
    }, 1000);
    this.getBlockchainProperties();

    this.selectAccountAddressFromMetamask();

  }
  // formatLabel(value: number): string {
  //   if (value >= 1000) {
  //     return Math.round(value / 1000) + 'MWh';
  //   }

  //   return `${value}`;
  // }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }
  applycountryFilter() {
    this.FilterForm.controls['countryname'];
    this.filteredOptions = this.FilterForm.controls['countryname'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );

  }
  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;

    } else {
      this.showerror = false;
    }
    return this.countrylist.filter((option: { country: string; }) => option.country.toLowerCase().includes(filterValue));
  }

  selectCountry(event: any) {

    this.subscription = this.filteredOptions.subscribe(options => {
      const selectedCountry = options.find((option: any) => option.country === event.option.value);
      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(selectedCountry.alpha3);
      }
    });
  }

  // ngAfterViewInit() {
  //   this.dataSource.paginator = this.paginator;
  //   this.dataSource.sort = this.sort;
  // }

  blockchainProperties: BlockchainProperties;
  getBlockchainProperties() {
    this.blockchainDRECService.getBlockchainProperties().subscribe((response: BlockchainProperties) => {
      this.blockchainProperties = response;
    })
  }
  isAnyFieldFilled: boolean = false;

  // checkFormValidity(): void {
  //   const formValues = this.FilterForm.value;
  //   this.isAnyFieldFilled = Object.values(formValues).some(value => !!value);
  // }
  // onstartreadChangeEvent(event: Event): void {
  //   const inputElement = event.target as HTMLInputElement;
  //   const value = inputElement.value;
  //   // Additional logic here
  //   this.FilterForm.controls['fromAmountread'].setValue(value);
  //   this.checkFormValidity();
  // }
  // onendreadChangeEvent(event: Event) {
  //   const inputElement = event.target as HTMLInputElement;
  //   const value = inputElement.value;
  //   //this.endminDate = event;
  //   this.FilterForm.controls['toAmountread'].setValue(value);
  //   this.checkFormValidity();
  // }
  onSliderChange(event: any): void {
    const startValue = this.startThumb.nativeElement.value;
    const endValue = this.endThumb.nativeElement.value;
    // Additional logic here
  }
  formatLabel(value: number): string {
    if (value >= 1000) {
      return Math.round(value / 1000) + 'k';
    }

    return `${value}`;
  }
  checkFormValidity(): void {
    let isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges.pipe(
      debounceTime(1000) // Debounce the stream for 500 milliseconds
    ).subscribe((formValues) => {
      if (isUserInteraction) {
        const countryValue = formValues.countryname;

        if (countryValue === undefined || countryValue === '') {

          this.FilterForm.controls['countryname'].setValue(null);
          this.FilterForm.controls['countryCode'].setValue(null);

        }
        const fuelCodeValue = formValues.fuelCode;
        if (fuelCodeValue === undefined) {
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
      if (!this.isAnyFieldFilled) {
        this.p = 1;
        this.DisplayList(this.p)
      }
    }, 1000);

    // Other code...
  }
  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.FilterForm.controls['fromAmountread'].setValue(null);
    this.FilterForm.controls['toAmountread'].setValue(null);
    this.startvalue = 1000;
    this.endvalue = 5000001;
    // this.loading = false;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.DisplayList(this.p);

  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  DisplayListFilter() {
    this.loading = true;
    this.p = 1;
    this.DisplayList(this.p);
  }
  // CertificateClaimed:boolean=false;
  DisplayList(page: number) {

    this.certificateService.GetDevoloperCertificateMethod(this.FilterForm.value, page).subscribe(
      (data: any) => {

        this.loading = false;
        // display list in the console 

        // this.data = data;

        if (data.certificatelog.length > 0) {
          //@ts-ignore
          this.data = data.certificatelog.filter(ele => ele !== null)
          //@ts-ignore
          this.data.forEach(ele => {

            ele['generationStartTimeinUTC'] = new Date(ele.generationStartTime * 1000).toISOString();
            ele['generationEndTimeinUTC'] = new Date(ele.generationEndTime * 1000).toISOString();
            //converting blockchain address to lower case
            if (ele.claims != null && (ele.claims.length > 0)) {
              ele['CertificateClaimed'] = true;
            }
            for (let key in ele.owners) {
              if (key !== key.toLowerCase()) {
                ele.owners[key.toLowerCase()] = ele.owners[key];
                delete ele.owners[key];
                // if(ele.owner[key].value=0){

                // }
              }
            }

            // if (ele.creationBlockHash != "") {
            //   ele.creationBlockHash
            //   ele['energyurl'] = environment.Explorer_URL + '/token/' + this.blockchainProperties.registry + '/instance/' + ele.id + '/token-transfers'
            // }
            // //@ts-ignore
            // else if (ele.transactions.find(ele1 => ele1.eventType == "IssuancePersisted")) {

            //   //@ts-ignore
            //   ele.creationBlockHash = ele.transactions.find(ele1 => ele1.eventType == "IssuancePersisted").transactionHash

            //   ele['energyurl'] = environment.Explorer_URL + '/token/' + this.blockchainProperties.registry + '/instance/' + ele.blockchainCertificateId + '/token-transfers'
            // }
          })

          this.dataSource = new MatTableDataSource(this.data);
          this.obs = this.dataSource.connect();
          this.totalRows = data.totalCount;
          this.totalPages = data.totalPages;
        } else {
          this.data = [];
          this.dataSource = new MatTableDataSource(this.data);
          this.obs = this.dataSource.connect();
        }

      }, errors => {
        this.data = [];
      }

    )
  }

  getWindowEthereumObject() {
    //@ts-ignore
    return window.ethereum;
  }

  selectedCertificateForClaim: {
    id: number,
    deviceId: string, // groupId or reservation id
    generationStartTime: number,
    generationEndTime: number,
    owners: { [key: string]: string }
  }

  formattedClaimAmount: {
    hex: string,
    type: string
  }

  selectedBlockchainAccount: string = '';

  checkMetamaskConnected() {
    return typeof window !== 'undefined' && typeof this.getWindowEthereumObject() !== 'undefined';
  }

  connectWallet() {
    //@ts-ignore   
    if (typeof window !== 'undefined' && typeof window.ethereum! == 'undefined') {
      try {
        //@ts-ignore
        window.ethereum.request({ method: 'eth_requestAccounts' })

      }
      catch (e) {
        console.error("some error occures", e);
      }
    }
  }

  selectAccountAddressFromMetamask() {
    //@ts-ignore
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      //@ts-ignore
      window.ethereum.request({ method: 'eth_requestAccounts' }).then(response => {
        this.selectedBlockchainAccount = (response && response[0]) ? response[0] : '';
        this.selectedBlockchainAccount = this.selectedBlockchainAccount.toLowerCase();
        if (this.selectedBlockchainAccount === '') {
          this.toastrService.error('No Blockchain account selected please connect metamask account')
        }
      }).catch((error: any) => {
        console.log('Metamask is not connected, please first connect metamask then click this button to select account');
        console.log(error);
        this.toastrService.error('Metamask is not connected, please first connect metamask then click this button to select account');
      });
    }
    else {
      this.toastrService.error('Metamask is not connected, please first connect metamask then click this button to select account');
    }
  }
  pageChangeEvent(event: PageEvent) {
    this.p = event.pageIndex + 1;
    this.DisplayList(this.p);
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

  deviceDetaileDialog(deviceId: number): void {
    const dialogRef = this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId
      },
      width: '900px',
      height: '400px',
    });
  }
}
