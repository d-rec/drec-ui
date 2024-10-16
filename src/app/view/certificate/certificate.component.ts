import {
  Component,
  ViewChild,
  TemplateRef,
  Input,
  OnDestroy,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BlockchainProperties } from '../../models/blockchain-properties.model';
import { ethers } from 'ethers';
import { ToastrService } from 'ngx-toastr';
import { registryABI } from './registery-abi';
import {
  MeterReadService,
  ReservationService,
  BlockchainDrecService,
  CertificateService,
} from '../../auth/services';
export interface Student {
  firstName: string;
  lastName: string;
  studentEmail: string;
  course: string;
  yearOfStudy: number;
}
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceService } from '../../auth/services/device.service';
@Component({
  selector: 'app-certificate',
  templateUrl: './certificate.component.html',
  styleUrls: ['./certificate.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
})
export class CertificateComponent implements OnDestroy {
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
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
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
  p: number = 1;
  totalRows = 0;
  pageSize: number = 10;
  totalPages: number;
  historyp: number = 1;
  historynextissuance_total: number;
  certifiedp: number = 1;
  certified_total: number;
  constructor(
    private blockchainDRECService: BlockchainDrecService,
    private authService: AuthbaseService,
    private certificateauthService: CertificateService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService,
    private bottomSheet: MatBottomSheet,
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private readService: MeterReadService,
    private deviceService: DeviceService,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      this.group_id = params['id'];
      this.group_uid = params['group_uid'];
    });
  }
  ngOnInit() {
    this.claimData = this.fb.group({
      beneficiary: [null, Validators.required], //"claim from angular smart contract", // ui text field
      location: [null, Validators.required], //"angular chrome", // ui text field
      countryCode: [null, Validators.required], //"IND", // country code drodpown
      periodStartDate: [new Date(), Validators.required], // date picker
      periodEndDate: [new Date(), Validators.required], // date picker
      purpose: [null, Validators.required], //"claim testing from new UI" // ui text field
    });
    this.reservationService
      .GetMethodById(this.group_id)
      .subscribe((data: any) => {
        this.group_name = data.name;
        this.devicesId = data.deviceIds;
        this.reservationstatus = data.reservationActive;
      });
    this.energyurl = environment.Explorer_URL + '/block/';
    setTimeout(() => {
      if (this.group_uid != undefined) {
        this.DisplayList(this.p);
      }
    }, 2000);
    this.getBlockchainProperties();
    this.AllCountryList();
    this.claimData.controls['countryCode'];
    this.filteredOptions = this.claimData.controls[
      'countryCode'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
    this.selectAccountAddressFromMetamask();

    this.intervalId = setInterval(() => {
      if (this.reservationstatus) {
        this.getnextissuancinfo(this.historyp);
        this.getlastreadofdevices();
        this.getcertifiedlogdaterange(this.certifiedp);
      }
    }, 100000);
  }
  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
  getnextissuancinfo(historyp: number) {
    this.reservationService
      .GetnextissuanceCycleinfo(this.group_uid, historyp)
      .subscribe((data: any) => {
        this.history_nextissuanclist =
          data.historynextissuansinfo.AllDeviceshistnextissuansinfo;
        this.historynextissuance_total = data.historynextissuansinfo.totalPages;

        this.ongoingnextissuance = data.ongoing_next_issuance;
      });
  }
  histroynextIssuancepreviousPage(): void {
    if (this.historyp > 1) {
      this.historyp--;
      this.getnextissuancinfo(this.historyp);
    }
  }

  histroynextIssuancenextPage(): void {
    if (this.historyp < this.totalPages) {
      this.historyp++;
      this.getnextissuancinfo(this.historyp);
    }
  }
  alldevicesread: any = [];
  getlastreadofdevices() {
    this.alldevicesread = [];
    if (typeof this.devicesId === 'string') {
      this.readService.Getlastread(this.devicesId).subscribe({
        next: (data) => {
          this.alldevicesread.push(data);
        },
        error: (err) => {
          //Error callback
          console.error('error caught in component', err);
          //.toastrService.error('device id has been updated', 'current external id not found!!');
        },
      });
    } else {
      this.devicesId.forEach((elemant: any) => {
        this.readService.Getlastread(elemant).subscribe({
          next: (data) => {
            this.alldevicesread.push(data);
          },
          error: (err) => {
            //Error callback
            console.error('error caught in component', err);
            //.toastrService.error('device id has been updated', 'current external id not found!!');
          },
        });
      });
    }
  }

  getcertifiedlogdaterange(certifiedp: number) {
    // if (typeof this.devicesId === 'string') {
    this.deviceService
      .getcertifieddevicelogdate(this.group_uid, certifiedp)
      .subscribe({
        next: (data) => {
          this.alldevicescertifiedlogdatrange =
            data.certifieddevices_startToend;
          this.certified_total = data.totalPages;
          // if (data.firstcertifiedstartdate != null && data.lastcertifiedenddate != null) {
          //   this.alldevicescertifiedlogdatrange.push(data)
          // }
        },
        error: (err) => {
          //Error callback
          console.error('error caught in component', err);
          //.toastrService.error('device id has been updated', 'current external id not found!!');
        },
      });
    // } else {
    //   this.alldevicescertifiedlogdatrange = [];
    //   this.devicesId.forEach((elemant: any) => {
    //     this.deviceService.getcertifieddevicelogdate(elemant, this.group_uid).subscribe({
    //       next: data => {

    //         if (data.firstcertifiedstartdate != null && data.lastcertifiedenddate != null) {
    //           this.alldevicescertifiedlogdatrange.push(data)
    //         }
    //       },
    //       error: err => {                               //Error callback
    //         console.error('error caught in component', err)
    //         //.toastrService.error('device id has been updated', 'current external id not found!!');

    //       }
    //     });

    //   })
    // }
  }
  certifiedDevicepreviousPage(): void {
    if (this.certifiedp > 1) {
      this.certifiedp--;
      this.getcertifiedlogdaterange(this.certifiedp);
    }
  }

  certifiedDevicenextPage(): void {
    if (this.certifiedp < this.totalPages) {
      this.certifiedp++;
      this.getcertifiedlogdaterange(this.certifiedp);
    }
  }
  openTemplateSheetMenu() {
    this.bottomSheet.open(this.TemplateBottomSheet);
  }

  closeTemplateSheetMenu() {
    this.bottomSheet.dismiss();
  }
  AllCountryList() {
    this.authService.GetMethod('countrycode/list').subscribe((data) => {
      this.countrylist = data;
    });
  }
  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    //((u) => isRole(u.role, Role.DeviceOwner));
    return this.countrylist.filter((option: { country: string }) =>
      option.country.toLowerCase().includes(filterValue),
    );
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

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  // CertificateClaimed:boolean=false;
  DisplayList(p: number) {
    this.certificateauthService
      .getcertifiedlogByGooupUid(this.group_uid, p)
      .subscribe({
        next: (data: any) => {
          this.loading = false;
          this.data = data.certificatelog.filter((ele: any) => ele !== null);
          this.totalPages = data.totalPages;

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
        },
        error: (err) => {
          if (err.error.statusCode === 403) {
            this.toastrService.error(
              'Error:' + err.error.message,
              'Unauthorized',
            );
          } else {
            this.toastrService.error('Error:' + err.error.message, 'Fail');
          }
        },
      });
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
      this.DisplayList(this.p);
    }
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

  selectCertificateForClaim(certificate: any) {
    if (this.selectedBlockchainAccount === '') {
      this.openTemplateSheetMenu();
      this.toastrService.error(
        'No account is connected currently, please connect metamask account',
      );
      return;
    }
    this.selectedCertificateForClaim = certificate;
    this.getAmountForClaim(this.selectedBlockchainAccount);
  }
  getAmountForClaim(blockchainAccountAddress: string) {
    // this.selectedCertificateForClaim.owners[blockchainAccountAddress]="10998";
    if (
      this.selectedCertificateForClaim.owners[blockchainAccountAddress] &&
      parseFloat(
        this.selectedCertificateForClaim.owners[blockchainAccountAddress],
      ) > 0
    ) {
      const convertingWattsToKiloWatts = Math.floor(
        parseFloat(
          this.selectedCertificateForClaim.owners[blockchainAccountAddress],
        ) / 1000,
      );
      this.blockchainDRECService
        .convertClaimAmountToHex(convertingWattsToKiloWatts)
        .subscribe(
          (response) => {
            this.formattedClaimAmount = response;
            // this.claimUsingEtherJS();
            this.openTemplateSheetMenu();
          },
          (error) => {
            this.toastrService.error(
              `Some error occured while requesting for claim+ ${JSON.stringify(error)}`,
            );
          },
        );
    } else {
      this.toastrService.error(
        `Currently connected blockchain address does not own anything in this certificate, ${this.selectedBlockchainAccount}`,
      );
      let owners = '';
      for (const key in this.selectedCertificateForClaim.owners) {
        owners =
          key + ' : ' + this.selectedCertificateForClaim.owners[key] + '; ';
      }
      this.toastrService.info(`Current Owners ${owners}`);
    }
  }

  claimUsingEtherJS() {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);

        const daiContract = new ethers.Contract(
          this.blockchainProperties.registry,
          registryABI,
          provider,
        );
        const signer = provider.getSigner();
        const daiWithSigner = daiContract.connect(signer);

        const claimData = {
          beneficiary: 'Beneficiary: ' + this.claimData.value.beneficiary,
          location: 'Location: ' + this.claimData.value.location,
          countryCode: 'Country Code: ' + this.claimData.value.countryCode,
          periodStartDate:
            'Period Start Date: ' +
            new Date(
              this.selectedCertificateForClaim.generationStartTime * 1000,
            ).toISOString(),
          periodEndDate:
            'Period End Date: ' +
            new Date(
              this.selectedCertificateForClaim.generationEndTime * 1000,
            ).toISOString(),
          purpose: 'Purpose: ' + this.claimData.value.purpose,
        };
        daiWithSigner.functions['safeTransferAndClaimFrom'](
          this.selectedBlockchainAccount,
          this.selectedBlockchainAccount,
          this.selectedCertificateForClaim.id,
          this.formattedClaimAmount,
          this.encodeClaimData(claimData),
          this.encodeClaimData(claimData),
        );

        setTimeout(() => {
          this.toastrService.info(
            `Please check metamask for success or failure of claim of this certificate`,
          );
          this.closeTemplateSheetMenu();
        }, 1000);
      } catch (error) {
        console.error('Error during the claim process:', error);
        this.toastrService.error(
          'An error occurred during the claim process. Please try again.',
        );
      } finally {
        this.closeTemplateSheetMenu();
      }
    } else {
      console.error('window.ethereum is not available');
      this.toastrService.error(
        'Ethereum provider is not available. Please install MetaMask.',
      );
    }
  }

  encodeClaimData = (claimData: any) => {
    const {
      beneficiary,
      location,
      countryCode,
      periodStartDate,
      periodEndDate,
      purpose,
    } = claimData;
    console.log(
      "ethers.utils.defaultAbiCoder.encode(['string', 'string', 'string', 'string', 'string', 'string'], [beneficiary, location, countryCode, periodStartDate, periodEndDate, purpose]);",
      ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'string', 'string', 'string', 'string'],
        [
          beneficiary,
          location,
          countryCode,
          periodStartDate,
          periodEndDate,
          purpose,
        ],
      ),
    );
    return ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'string', 'string', 'string', 'string'],
      [
        beneficiary,
        location,
        countryCode,
        periodStartDate,
        periodEndDate,
        purpose,
      ],
    );
  };

  goback() {
    this.router.navigate(['/myreservation']);
  }
}
