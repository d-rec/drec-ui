import {
  Component,
  ViewChild,
  ElementRef,
  TemplateRef,
  Input,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BlockchainDrecService } from '../../auth/services/blockchain-drec.service';
import { BlockchainProperties } from '../../models/blockchain-properties.model';
import { ToastrService } from 'ngx-toastr';
import {
  ReservationService,
  OrganizationService,
  MeterReadService,
  DeviceService,
  CertificateService,
} from '../../auth/services';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceDetailsComponent } from '../device/device-details/device-details.component';
import { MatDialog } from '@angular/material/dialog';
@Component({
  selector: 'app-certificate-details',
  templateUrl: './certificate-details.component.html',
  styleUrls: ['./certificate-details.component.scss'],
})
export class CertificateDetailsComponent {
  @Input() dataFromComponentA: any;
  @ViewChild('templateBottomSheet') TemplateBottomSheet: TemplateRef<any>;
  displayedColumns = [
    'serialno',
    'certificateStartDate',
    'certificateEndDate',
    'owners',
  ];
  innerDisplayedColumns = [
    'certificate_issuance_startdate',
    'certificate_issuance_enddate',
    'externalId',
    'readvalue_watthour',
    'Action',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('startThumb') startThumb: ElementRef<HTMLInputElement>;
  @ViewChild('endThumb') endThumb: ElementRef<HTMLInputElement>;
  loginuser: any;
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
  devicesId: any;
  alldevicescertifiedlogdatrange: any = [];
  intervalId: any;
  reservationstatus: boolean;
  totalRows = 0;
  pageSize: number = 10;
  totalPages: number;
  p: number = 1;
  FilterForm: FormGroup;
  offtaker = [
    'School',
    'Education',
    'Health Facility',
    'Residential',
    'Commercial',
    'Industrial',
    'Public Sector',
    'Agriculture',
    'Utility',
    'Off-Grid Community',
  ];
  endminDate = new Date();
  sdgblist: any;
  fuellist: any;
  devicetypelist: any;
  subscription: Subscription;
  showerror: boolean = false;
  countrycodeLoded: boolean = false;
  startvalue: number = 1000;
  endvalue: number = 5000001;
  orgname: string;
  orgId: number;
  orglist: any;
  filteredOrgList: Observable<any[]>;
  showorgerror: boolean = false;
  oldlog: boolean = false;
  oldcertificatelog: boolean;
  constructor(
    private blockchainDRECService: BlockchainDrecService,
    private authService: AuthbaseService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService,
    private bottomSheet: MatBottomSheet,
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private readService: MeterReadService,
    private deviceService: DeviceService,
    private certificateService: CertificateService,
    private formBuilder: FormBuilder,
    private dialog: MatDialog,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
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
    if (this.loginuser.role === 'ApiUser') {
      this.FilterForm.addControl(
        'organizationname',
        this.formBuilder.control(''),
      );
      this.FilterForm.addControl(
        'organizationId',
        this.formBuilder.control(''),
      );
    }
    this.authService.GetMethod('device/fuel-type').subscribe((data1) => {
      // display list in the console
      this.fuellist = data1;
      // this.fuellistLoaded = true;
    });
    this.authService.GetMethod('device/device-type').subscribe((data2) => {
      // display list in the console
      this.devicetypelist = data2;
      // this.devicetypeLoded = true;
    });
    this.authService.GetMethod('countrycode/list').subscribe((data3) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      // display list in the console
      this.sdgblist = data;
    });
    setTimeout(() => {
      if (this.countrycodeLoded) {
        this.applycountryFilter();
      }

      this.DisplayList(this.p);
    }, 1500);
    this.getBlockchainProperties();
    this.selectAccountAddressFromMetamask();
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  showorglist(event: any) {
    this.orgService.GetApiUserAllOrganization().subscribe((data) => {
      if (event === 'Developer') {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.applyorgFilter();
      } else {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Developer',
        );
        this.applyorgFilter();
      }
    });
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationname'];
    this.filteredOrgList = this.FilterForm.controls[
      'organizationname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.orglist.filter((option: any) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showorgerror = true;
    } else {
      this.showorgerror = false;
    }
    return this.orglist.filter(
      (option: any) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }
  selectorg(event: any) {
    this.subscription = this.filteredOrgList.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }
  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }

  applycountryFilter() {
    this.FilterForm.controls['countryname'];
    this.filteredOptions = this.FilterForm.controls[
      'countryname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }
  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.countrylist.filter((option: any) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter((option: { country: string }) =>
      option.country.toLowerCase().includes(filterValue),
    );
  }

  selectCountry(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedCountry = options.find(
        (option: any) => option.country === event.option.value,
      );

      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(
          selectedCountry.alpha3,
        );
      }
    });
  }
  getcertificatelog(event: any) {
    this.loading = true;
    this.data = [];
    if (event === 'old') {
      this.oldlog = true;
      this.DisplayList(1);
    }
    if (event === 'new') {
      this.oldlog = false;
      this.DisplayList(1);
    }
  }

  // ngAfterViewInit() {
  //   this.dataSource.paginator = this.paginator;
  //   this.dataSource.sort = this.sort;
  // }

  blockchainProperties: BlockchainProperties;
  getBlockchainProperties() {
    this.blockchainDRECService
      .getBlockchainProperties()
      .subscribe((response: BlockchainProperties) => {
        this.blockchainProperties = response;
      });
  }
  isAnyFieldFilled: boolean = false;

  checkFormValidity(): void {
    const isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges
      .pipe(
        debounceTime(500), // Debounce the stream for 500 milliseconds
      )
      .subscribe((formValues) => {
        if (isUserInteraction) {
          if (
            formValues.organizationId === undefined ||
            formValues.organizationId === ''
          ) {
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
          if (formValues.offTaker[0] === undefined) {
            this.FilterForm.controls['offTaker'].setValue(null);
          }
          if (
            formValues.SDGBenefits != null &&
            formValues.SDGBenefits[0] === undefined
          ) {
            this.FilterForm.controls['SDGBenefits'].setValue(null);
          }
          // Other code...
        }
      });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some(
        (value) => !!value,
      );
      this.isAnyFieldFilled = isAllValuesNull;
      if (!this.isAnyFieldFilled) {
        this.DisplayList(this.p);
      }
    }, 500);

    // Other code...
  }

  onstartreadChangeEvent(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    // Additional logic here
    this.FilterForm.controls['fromAmountread'].setValue(value);
    this.checkFormValidity();
  }
  onendreadChangeEvent(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    //this.endminDate = event;
    this.FilterForm.controls['toAmountread'].setValue(value);
    this.checkFormValidity();
  }
  // onSliderChange(event: any): void {
  //   const startValue = this.startThumb.nativeElement.value;
  //   const endValue = this.endThumb.nativeElement.value;
  // }
  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.FilterForm.controls['fromAmountread'].setValue(null);
    this.FilterForm.controls['toAmountread'].setValue(null);
    this.startvalue = 1000;
    this.endvalue = 5000001;
    this.loading = false;
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
    this.certificateService
      .GetDevoloperCertificateMethod(this.FilterForm.value, page, this.oldlog)
      .subscribe({
        next: (data: any) => {
          this.loading = false;
          // display list in the console
          this.oldcertificatelog = data.oldcertificatelog;
          if (data.certificatelog.length > 0) {
            this.data = data.certificatelog.filter((ele: any) => ele !== null);

            this.data.forEach((ele: any) => {
              ele['generationStartTimeinUTC'] = new Date(
                ele.generationStartTime * 1000,
              ).toISOString();
              ele['generationEndTimeinUTC'] = new Date(
                ele.generationEndTime * 1000,
              ).toISOString();
              //converting blockchain address to lower case
              if (ele.claims != null && ele.claims.length > 0) {
                ele['CertificateClaimed'] = true;
              }
              for (const key in ele.owners) {
                if (key !== key.toLowerCase()) {
                  ele.owners[key.toLowerCase()] = ele.owners[key];
                  delete ele.owners[key];
                }
              }

              if (ele.creationBlockHash != '') {
                ele.creationBlockHash;
                ele['energyurl'] =
                  environment.Explorer_URL +
                  '/token/' +
                  this.blockchainProperties.registry +
                  '/instance/' +
                  ele.id +
                  '/token-transfers';
              } else if (
                ele.transactions.find(
                  (ele1: any) => ele1.eventType == 'IssuancePersisted',
                )
              ) {
                ele.creationBlockHash = ele.transactions.find(
                  (ele1: any) => ele1.eventType == 'IssuancePersisted',
                ).transactionHash;

                ele['energyurl'] =
                  environment.Explorer_URL +
                  '/token/' +
                  this.blockchainProperties.registry +
                  '/instance/' +
                  ele.blockchainCertificateId +
                  '/token-transfers';
              }
            });

            this.dataSource = new MatTableDataSource(this.data);
            this.obs = this.dataSource.connect();
            this.totalRows = data.totalCount;
            this.totalPages = data.totalPages;
          } else {
            this.loading = false;
            this.data = [];
            this.dataSource = new MatTableDataSource(this.data);
            this.obs = this.dataSource.connect();
          }
        },
        error: (err) => {
          this.loading = false;

          if (err.error.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to access the certificate page.",
              'Access Denied',
            );
          } else {
            this.toastrService.error('Error', err.error.message);
          }
        },
      });
  }

  getWindowEthereumObject() {
    return window.ethereum;
  }

  selectedCertificateForClaim: {
    id: number;
    deviceId: string; // groupId or reservation id
    generationStartTime: number;
    generationEndTime: number;
    owners: { [key: string]: string };
  };

  formattedClaimAmount: {
    hex: string;
    type: string;
  };

  selectedBlockchainAccount: string = '';

  checkMetamaskConnected() {
    return (
      typeof window !== 'undefined' &&
      typeof this.getWindowEthereumObject() !== 'undefined'
    );
  }
  getWindowEthereumProperty(): Ethereum | undefined {
    return window.ethereum;
  }
  async connectWallet() {
    if (
      typeof window != 'undefined' &&
      typeof this.getWindowEthereumProperty() != 'undefined'
    ) {
      const ethereum = this.getWindowEthereumProperty();
      if (ethereum) {
        try {
          /* MetaMask is installed */
          const accounts = await ethereum.request({
            method: 'eth_requestAccounts',
          });
          console.log('Connected accounts:', accounts);
        } catch (err) {
          console.error('Error connecting to MetaMask:', err);
        }
      } else {
        console.error('MetaMask not found');
      }
    }
  }

  selectAccountAddressFromMetamask() {
    if (
      typeof window !== 'undefined' &&
      typeof window.ethereum !== 'undefined'
    ) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then((response) => {
          this.selectedBlockchainAccount =
            response && response[0] ? response[0] : '';
          this.selectedBlockchainAccount =
            this.selectedBlockchainAccount.toLowerCase();
          if (this.selectedBlockchainAccount === '') {
            this.toastrService.error(
              'No Blockchain account selected please connect metamask account',
            );
          }
        })
        .catch((error: any) => {
          console.log(
            'Metamask is not connected, please first connect metamask then click this button to select account',
          );
          console.log(error);
          this.toastrService.error(
            'Metamask is not connected, please first connect metamask then click this button to select account',
          );
        });
    } else {
      this.toastrService.error(
        'Metamask is not connected, please first connect metamask then click this button to select account',
      );
    }
  }
  pageChangeEvent(event: PageEvent) {
    this.p = event.pageIndex + 1;
    this.DisplayList(this.p);
  }

  previousPage(): void {
    this.data = [];
    this.loading = true;
    if (this.p > 1) {
      this.p--;
      this.DisplayList(this.p);
    }
  }

  nextPage(): void {
    this.data = [];
    this.loading = true;
    if (this.p < this.totalPages) {
      this.p++;
      this.DisplayList(this.p);
    }
  }
  deviceDetaileDialog(deviceId: number): void {
    this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
      height: '400px',
    });
  }
}
