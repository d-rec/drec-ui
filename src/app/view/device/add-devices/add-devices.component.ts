import {
  Component,
  TemplateRef,
  ViewChild,
  EventEmitter,
  Output,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MatDialog } from '@angular/material/dialog';
import { OrganizationType } from 'src/app/utils/drec.enum';
import { MapComponent } from '../../map/map.component';

type DeviceFiles = {
  productionFacilityRegistration?: File[]; // Optional array of files
  ownershipProof?: File[]; // Optional array of files
  meteringEvidence?: File[]; // Optional array of files
  singleLineDiagram?: File[]; // Optional array of files
  projectPhotos?: File[]; // Optional array of files
};

// Define the FileType as a union of the keys of DeviceFiles
type FileType = keyof DeviceFiles
@Component({
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss'],
})
export class AddDevicesComponent {
  @ViewChild('popupDialog') popupDialog = {} as TemplateRef<any>;
  dialogRef: any;
  user: any;
  myform: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  hide = true;
  addmoredetals: any[] = [];
  shownomore: any[] = [];
  showaddmore: any[] = [];
  showerror: any[] = [];
  maxDate = new Date();
  public date: any;
  public sdgblist: any;
  public disabled = false;
  public showSpinners = true;
  public showSeconds = false;
  public touchUi = false;
  public enableMeridian = false;
  organizationList: OrganizationInformation[] = [];
  currentOrganization: OrganizationInformation | undefined;

  public stepHour = 1;
  public stepMinute = 1;
  public stepSecond = 1;
  numberregex: RegExp = /^-?[0-9]+(\.[0-9]*)?$/;
  filteredCountryList: Observable<any[]>[] = [];
  subscription: Subscription;
  filteredOrganizationList: OrganizationInformation[] = [];
  organizationName: string;
  organizationId: number;
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
  devicedescription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  files: {
    [index: number]: DeviceFiles; // This will hold the files for each device
  } = {};
  @ViewChild(MapComponent) mapComponent: MapComponent;
  @Output() zoom = new EventEmitter<number>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    public dialog: MatDialog,
  ) {
    this.user = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.loadData();
    this.initializeForm();
    this.showinput[0] = true;
    this.addmoredetals[0] = false;
    this.showaddmore[0] = true;
    this.showerror[0] = false;
    this.shownomore[0] = false;
    // this.adddevice();

    setTimeout(() => {
      this.setupCountryAutocomplete(0);
    }, 1500);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  private fetchOrganizationList() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      this.currentOrganization = data;
      if (
        ![OrganizationType.ApiUser, OrganizationType.Admin].includes(
          this.user.role,
        )
      ) {
        this.organizationName = this.currentOrganization?.name;
        this.organizationId = this.currentOrganization?.id;
      }
    });
  }

  private loadData() {
    this.fetchOrganizationList();
    if (this.user.role === OrganizationType.Admin) {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrganizationList = this.organizationList;
        // Once data is loaded, call any other functions that depend on it

        this.date = new Date();
      });
    } else if (this.user.role === OrganizationType.ApiUser) {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        // const buyerOrganizations = data.filter(org => org.organizationType === "Buyer");
        this.filteredOrganizationList = this.organizationList;
      });
    }

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();
    // Load other data as needed
  }
  filterOrgList() {
    this.filteredOrganizationList = this.organizationList.filter((org: any) => {
      return org.name
        .toLowerCase()
        .includes(this.organizationName.toLowerCase());
    });
  }
  selectOrg(event: any) {
    const selectedOrganization = this.organizationList.find(
      (option) => option.name === event.option.value,
    );
    if (selectedOrganization) {
      this.organizationId = selectedOrganization.id;
    }
  }
  private initializeForm() {
    this.myform = this.fb.group({
      devices: this.fb.array([]),
    });
    this.myform.valueChanges.subscribe();
    const device = this.fb.group({
      externalId: [
        null,
        [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)],
      ],
      projectName: [null],
      address: [null, [Validators.required]],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCodename: [null, Validators.required],
      fuelCode: [null, [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [true],
      energyStorageCapacity: [null],
      stateProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      productionFacilityRegistration: [null],
      ownershipProof: [null],
      meteringEvidence: [null],
      singleLineDiagram: [null],
      projectPhotos: [null],
    });

    device.get('latitude')?.valueChanges.subscribe((latitude) => {
      const longitude = device.get('longitude')?.value;
      this.updateMapMarkers(latitude, longitude);
    });
    device.get('longitude')?.valueChanges.subscribe((longitude) => {
      const latitude = device.get('latitude')?.value;
      this.updateMapMarkers(latitude, longitude);
    });
    this.deviceForms.push(device);

    // Other form initialization code
  }

  private setupCountryAutocomplete(index: number) {
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );
  }

  get deviceForms() {
    return this.myform.get('devices') as FormArray;
  }

  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      // display list in the console
      this.countrylist = data;
    });
  }
  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      // display list in the console

      this.sdgblist = data;
    });
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data: any) => {
      this.fuellist = data;
    });
  }
  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data: any) => {
      this.devicetypelist = data;
    });
  }

  onSDGBRemoved(topping: string, i: number) {
    const toppings: any = this.myform.get('devices') as FormArray;
    const sdgb = toppings[i].SDGBenefits.value as string[];
    this.removeFirst(sdgb, topping);
    toppings[i].SDGBenefits.setValue(sdgb); // To trigger change detection
  }

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }
  adddevice() {
    const device = this.fb.group({
      externalId: [
        null,
        [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)],
      ],
      projectName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null, Validators.required],
      fuelCode: [null],
      deviceTypeCode: [null],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: true,
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: true,
      energyStorageCapacity: [null],
      stateOrProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      productionFacilityRegistration: [null],
      ownershipProof: [null],
      meteringEvidence: [null],
      singleLineDiagram: [null],
      projectPhotos: [null],
    });
    this.deviceForms.push(device);
    this.showaddmore[this.deviceForms.length - 1] = true;
    this.showinput[this.deviceForms.length - 1] = true;
    const index = this.deviceForms.length - 1;
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );
  }

  private _filter(value: string, i: number): CountryInfo[] {
    const filterValue = value?.toLowerCase() || '';

    if (!filterValue) {
      this.showerror[i] = false;
      return this.countrylist;
    }

    const filteredCountries = this.countrylist.filter((option: CountryInfo) =>
      option?.country?.toLowerCase().includes(filterValue),
    );

    this.showerror[i] = filteredCountries.length === 0;

    return filteredCountries;
  }

  addmore(i: number) {
    this.addmoredetals[i] = true;
    this.shownomore[i] = true;
    this.showaddmore[i] = false;
  }
  nomore(i: number) {
    this.addmoredetals[i] = false;
    this.showaddmore[i] = true;
    this.shownomore[i] = false;
  }
  showinput: any[] = [];
  showenergycapacity_input(i: number, event: any) {
    if (event) {
      this.showinput[i] = true;
    } else {
      this.showinput[i] = false;
    }
  }
  deleteDevice(i: number) {
    this.deviceForms.removeAt(i);
  }
  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCodename') as FormControl;
  }

  onFileChange(event: Event, deviceIndex: number, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
  
    const files: FileList = input.files;
  
    // Initialize files object for this device if it doesn't exist
    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = {};
    }
  
    // Store the files - convert FileList to array for better handling
    this.files[deviceIndex][fileType] = Array.from(files);
  
    // Update the form control with the selected file reference (for UI display)
    const fileControl = this.deviceForms.at(deviceIndex).get(fileType);
    if (fileControl) {
      fileControl.setValue(input.files[0]); // Store the first file for display
      fileControl.markAsDirty(); // Mark as dirty to trigger validation
    }
  
    console.log(`Files for device ${deviceIndex} and type ${fileType}:`, this.files[deviceIndex][fileType]);
  }

  onSubmit() {
    if (this.myform.valid) {
      this.openPopupDialog();
    }
    console.log(this.myform.value);
  }

  submitForm() {
    console.log(this.myform.value);
    const deviceArray = this.myform.value.devices;

    deviceArray.forEach((element: any, index: number) => {
        // Create a FormData object for this device
        const formData = new FormData();

        // Find the country code based on the country codename
        const selectedCountry = this.countrylist.find(
            (option: CountryInfo) => option.country === element.countryCodename,
        );

        // Append the country code to the element
        element['countryCode'] = selectedCountry?.alpha3;

        // Log the country code for debugging
        console.log("Country code:", element.countryCode);

        // Append the modified device object to FormData
        formData.append('deviceToRegister', JSON.stringify(element));

        // Append organization ID if it exists
        if (this.organizationName != null) {
            element['organizationId'] = this.organizationId;
        }

        // Append the country code to FormData
        if (element.countryCode) {
            formData.append('countryCode', element.countryCode);
        } else {
            console.error('Country code is missing for device:', element);
        }

        const fileFields: FileType[] = [
            'productionFacilityRegistration',
            'ownershipProof',
            'meteringEvidence',
            'singleLineDiagram',
            'projectPhotos'
        ];

        // Define allowed extensions and max size
        const allowedExtensions = [
            'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 
            'tif', 'tiff', 'webp', 'pdf', 'doc', 'xls', 'docx', 
            'xlsx', 'pptx', 'gsheet', 'gdoc', 'txt', 'csv'
        ];
        const maxSizeInMB = 20;

        let allFilesValid = true; // Flag to track file validity

        fileFields.forEach((fileType: FileType) => {
            const files = this.files[index]?.[fileType]; // Use index defined in the outer loop
            if (files && files.length > 0) {
                // Validate each file
                for (const file of files) {
                    const extension = file.name.split('.').pop()?.toLowerCase();
                    const sizeInMB = file.size / (1024 * 1024);

                    // Check file extension
                    if (!extension || !allowedExtensions.includes(extension)) {
                        this.toastrService.error(
                            `${file.name} has unsupported file type: .${extension}`,
                            'Invalid File Type'
                        );
                        allFilesValid = false; // Mark as invalid
                        break; // Exit the loop for this file type
                    }

                    // Check file size
                    if (sizeInMB > maxSizeInMB) {
                        this.toastrService.error(
                            `${file.name} exceeds max file size of ${maxSizeInMB}MB`,
                            'File Size Exceeded'
                        );
                        allFilesValid = false; // Mark as invalid
                        break; // Exit the loop for this file type
                    }

                    // If valid, append the file to FormData
                    formData.append(fileType, file, file.name);
                }
                if (!allFilesValid) {
                    return; // Skip appending files if any are invalid
                }
                console.log(`Appending ${files.length} files for ${fileType} of device ${index}`);
            } else {
                console.log(`No files found for ${fileType} of device ${index}`);
            }
        });

        // If any files are invalid, do not send the request
        if (!allFilesValid) {
            console.error('One or more files are invalid. Request will not be sent.');
            return; // Exit the submitForm method
        }

        // Now use the FormData to send to the backend
        this.deviceService.Postdevices(formData).subscribe({
            next: () => {
                this.toastrService.success(
                    'Added Successfully !!',
                    'Device! ' + element.externalId
                );

                const idx = deviceArray.indexOf(element);
                deviceArray.splice(idx, 1);

                // Check if deviceArray is empty
                if (deviceArray.length === 0) {
                    // Navigate to the list UI page
                    if (this.user.role === OrganizationType.Admin) {
                        this.router.navigate(['/admin/All_devices']);
                    } else if (this.user.role === OrganizationType.ApiUser) {
                        this.router.navigate(['/apiuser/All_devices']);
                    } else {
                        this.router.navigate(['/device/AllList']);
                    }
                }
            },
            error: (err) => {
                // Error callback
                console.error('error caught in component', err.error.message);
                if (err.error.statusCode === 403) {
                    this.toastrService.error(
                        "You don't have the permissions to add a device.",
                        'Access Denied'
                    );
                } else {
                    this.toastrService.error(
                        'Some error occurred due to ' + err.error.message,
                        'Device!' + element.externalId
                    );
                }
            },
        });
    });
}
  openPopupDialog() {
    this.dialogRef = this.dialog.open(this.popupDialog, {
      width: '700px',
    });
    this.dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.submitForm();
      }
    });
  }
  updateMapMarkers(latitude: any, longitude: any) {
    if (this.mapComponent && latitude && longitude) {
      const device = [
        {
          latitude: latitude,
          longitude: longitude,
        },
      ];
      const markers = device.map((device) => ({
        latitude: parseFloat(device.latitude),
        longitude: parseFloat(device.longitude),
      }));

      // Set the markers on the map component
      this.mapComponent.markers = [...markers];

      // If the map is already initialized, update it directly
      if (this.mapComponent.isMapInitialized) {
        this.mapComponent.update();
      }
    }
  }
}
