import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService } from '../../../auth/services/device.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CountryInfo, fulecodeType, devicecodeType } from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MapComponent } from '../../map/map.component';
import { DocumentType, OperatingConfiguration, SourceAccessMode } from '../../../utils/drec.enum';
import {
  getEvidenceRequirements,
  getHint,
  EvidenceRequirements,
  RequirementLevel,
} from '../../../utils/evidence-requirements';
import {
  validateAndAppendFiles,
  shortenFileName,
} from '../../../utils/file-upload.helper';
import { DOCUMENTS_EXTENSIONS } from '../../../constants/documents-extensions';

type FileType =
  | DocumentType.FORM_SF_02
  | DocumentType.SF_02C
  | DocumentType.METERING_EVIDENCE
  | DocumentType.SINGLE_LINE_DIAGRAM
  | DocumentType.PROJECT_PHOTOS
  | DocumentType.SCREENSHOTS
  | DocumentType.COD_PROOF;

@Component({
  standalone: false,
  selector: 'app-edit-device',
  templateUrl: './edit-device.component.html',
  styleUrls: ['./edit-device.component.scss'],
})
export class EditDeviceComponent implements OnInit, OnDestroy {
  @ViewChild('errorDialog') errorDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('previewDialog') previewDialogTemplate = {} as TemplateRef<any>;
  previewDialogRef: any;
  previewData: { url: any; type: string; name: string } | null = null;
  currentPreviewFile: File | null = null;
  loginuser: any;
  updateDeviceForm: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  numberregex: RegExp = /[0-9]+(\.[0-9]*){0,1}/;
  maxDate = new Date();
  public date: any;
  addmoredetals: any;
  shownomore: any;
  showaddmore: any;
  public sdgblist: any;
  id: number;
  externalid: any;
  showinput: boolean = true;
  serialNumber: any;
  status: any;
  siteName: any;
  address: any;
  latitude: any;
  longitude: any;
  countryCode: any;
  fuelCode: any;
  deviceTypeCode: any;
  capacity: any;
  SDGBenefits: any = [];
  commissioningDate: any;
  qualityLabels: any;
  offTaker: any;
  gridInterconnection: any;
  operatingConfiguration: any;
  operatingConfigurations = Object.values(OperatingConfiguration);
  sourceAccessMode: any;
  sourceAccessModes = Object.values(SourceAccessMode);
  evidenceReqs: EvidenceRequirements = getEvidenceRequirements(null);
  impactStory: any;
  showerror: boolean = false;
  deviceDescription: any;
  energyStorage: boolean = true;
  energyStorageCapacity: any;
  stateProvince: any;
  postcode: any;
  frommydevice: boolean = false;
  frombulk: boolean = false;
  filteredCountryList: Observable<any[]>;
  organizationId: any;

  // Document upload support
  DocumentType = DocumentType;
  files: { [key: string]: File[] } = {};
  filePreviews: { [key: string]: { url: SafeResourceUrl; type: 'image' | 'pdf' | 'other'; name: string } } = {};
  existingDocs: { [type: string]: { url: string; name: string }[] } = {};
  brokenDocs: { [type: string]: boolean } = {};

  existingDocLabel(type: string): string {
    const docs = this.existingDocs[type];
    if (!docs?.length) return '';
    if (docs.length === 1) return docs[0].name;
    return docs.length + ' files uploaded';
  }
  fileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.SCREENSHOTS,
    DocumentType.COD_PROOF,
  ];

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
  devicediscription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  @ViewChild('streetMap') mapComponent: MapComponent;
  @ViewChild('satelliteMap') satelliteMapComponent: MapComponent;

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['fromdevices'] != undefined) {
        this.frommydevice = params['fromdevices'];
      }
      if (params['frombulk'] != undefined) {
        this.frombulk = params['frombulk'];
      }
    });
    this.externalid = this.activatedRoute.snapshot.params['id'];
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();

    this.date = new Date();
    this.updateDeviceForm = this.fb.group({
      serialNumber: [null, [Validators.pattern(/^[a-zA-Z0-9_;-]+$/)]],
      siteName: [null],
      address: [null, [Validators.required]],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCode: [null, Validators.required],
      fuelCode: ['ES100', [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [],
      energyStorageCapacity: [null],
      stateProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [new FormControl([])],
      version: ['1.0'],
      organizationId: [null],
      postcode: [null, [postcodeValidator()]],
    });
    this.showinput = true;
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
    this.updateDeviceForm.valueChanges.subscribe();
    this.updateDeviceForm
      .get('latitude')
      ?.valueChanges.subscribe((v) => {
        const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
        if (stripped !== v) this.updateDeviceForm.get('latitude')?.setValue(stripped, { emitEvent: false });
        const longitude = this.updateDeviceForm.get('longitude')?.value;
        this.updateMapMarkers(stripped, longitude);
      });
    this.updateDeviceForm
      .get('longitude')
      ?.valueChanges.subscribe((v) => {
        const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
        if (stripped !== v) this.updateDeviceForm.get('longitude')?.setValue(stripped, { emitEvent: false });
        const latitude = this.updateDeviceForm.get('latitude')?.value;
        this.updateMapMarkers(latitude, stripped);
      });
    setTimeout(() => {
      this.filteredCountryList = this.updateDeviceForm.controls[
        'countryCode'
      ].valueChanges.pipe(
        startWith(''),
        map((value) => this._filter(value || '')),
      );
      this.getDeviceinfo();
    }, 1000);
  }
  private _filter(value: string): CountryInfo[] {
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
    return this.countrylist.filter((code) =>
      code.country.toLowerCase().includes(filterValue),
    );
  }
  getCountryCodeControl(): FormControl {
    return this.updateDeviceForm.get('countryCode') as FormControl;
  }
  checkValidation(input: string) {
    const validation =
      this.updateDeviceForm.get(input)?.invalid &&
      (this.updateDeviceForm.get(input)?.dirty ||
        this.updateDeviceForm.get(input)?.touched);
    return validation;
  }
  serialNumberErrors() {
    return this.updateDeviceForm.get('serialNumber')?.hasError('required')
      ? 'This field is required'
      : this.updateDeviceForm.get('serialNumber')?.hasError('pattern')
        ? 'Serial number(s) must contain only letters, numbers, underscores, hyphens, or semicolons'
        : '';
  }
  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data1: any) => {
      this.countrylist = data1;
    });
  }
  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data2) => {
      this.sdgblist = data2;
    });
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data3: any) => {
      this.fuellist = data3;
    });
  }
  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data4: any) => {
      this.devicetypelist = data4;
    });
  }
  private initSerialNumber: string | null = null;
  addmore() {
    this.addmoredetals = true;
    this.shownomore = true;
    this.showaddmore = false;
  }
  nomore() {
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
  }
  showenergycapacity_input(event: any) {
    if (event) {
      this.showinput = true;
    } else {
      this.showinput = false;
    }
  }
  onEnergyStorageCapacityChange(value: any) {
    const num = Number(value);
    this.energyStorage = !!num && num > 0;
    this.updateDeviceForm.get('energyStorage')?.setValue(this.energyStorage, { emitEvent: false });
  }
  getDeviceinfo() {
    this.deviceService
      .getDeviceInfoBYexternalId(this.externalid)
      .subscribe((data) => {
        this.id = data.id;
        this.serialNumber = data.serialNumber;
        this.status = data.status;
        this.siteName = data.siteName;
        this.address = data.address;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.countryCode = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == data.countryCode,
        )?.country;
        this.fuelCode = data.fuelCode;
        this.deviceTypeCode = data.deviceTypeCode;
        this.capacity = data.capacity;
        this.postcode = data.postcode;
        data.SDGBenefits.forEach((sdgbname: string, index: number) => {
          const foundEle = this.sdgblist.find(
            (ele: any) =>
              ele.value.toLowerCase() === sdgbname.toString().toLowerCase(),
          );
          data.SDGBenefits[index] = foundEle.name;
        });
        this.SDGBenefits = data.SDGBenefits;
        this.commissioningDate = data.commissioningDate;
        this.offTaker = data.offTaker;
        this.qualityLabels = data.qualityLabels;
        this.impactStory = data.impactStory;
        this.gridInterconnection = data.gridInterconnection;
        this.operatingConfiguration = data.operatingConfiguration || null;
        this.sourceAccessMode = data.sourceAccessMode || null;
        this.evidenceReqs = getEvidenceRequirements(this.operatingConfiguration);
        this.deviceDescription = data.deviceDescription;
        if (data.energyStorage != null) {
          this.energyStorage = data.energyStorage;
        } else {
          this.energyStorage = false;
        }

        this.energyStorageCapacity = data.energyStorageCapacity;
        this.stateProvince = data.stateProvince;
        this.organizationId = data.organizationId;
        this.updateDeviceForm.patchValue({
          serialNumber: data.serialNumber,
        });
        this.initSerialNumber = data.serialNumber;

        // Load existing documents
        this.deviceService.getDocuments(data.id).subscribe((docs) => {
          this.existingDocs = {};
          for (const doc of docs) {
            if (!this.existingDocs[doc.type]) this.existingDocs[doc.type] = [];
            let name = doc.url.split('/').pop()?.split('?')[0] || doc.type;
            // Decode + as space, then repeatedly decodeURIComponent for double-encoded keys
            name = name.replace(/\+/g, ' ');
            let prev = '';
            while (name !== prev) {
              prev = name;
              try { name = decodeURIComponent(name); } catch { break; }
            }
            // Strip embedded UUIDs
            name = name.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
            // Strip upload timestamp+index suffix (e.g. _1752226304295_1.pdf → .pdf)
            name = name.replace(/_\d{10,}_\d+\./, '.');
            this.existingDocs[doc.type].push({ url: doc.url, name });
          }
          // Check each document URL for 404s (GET + abort, since HEAD may be blocked by CORS)
          this.brokenDocs = {};
          for (const type of Object.keys(this.existingDocs)) {
            for (const doc of this.existingDocs[type]) {
              if (!doc.url) { this.brokenDocs[type] = true; continue; }
              const ctrl = new AbortController();
              fetch(doc.url, { method: 'GET', mode: 'cors', signal: ctrl.signal }).then(
                (res) => { ctrl.abort(); if (!res.ok) this.brokenDocs[type] = true; },
                (err) => { if (err?.name !== 'AbortError') this.brokenDocs[type] = true; },
              );
            }
          }
        });
      });
  }
  ngOnDestroy() {
    for (const key of Object.keys(this.filePreviews)) {
      const preview = this.filePreviews[key];
      if (preview?.url) {
        URL.revokeObjectURL(preview.url as unknown as string);
      }
    }
  }

  onFileChange(event: Event, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.files[fileType] = Array.from(input.files);

    const file = input.files[0];
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[fileType] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : 'other',
      name: file.name,
    };
  }

  openPreview(fileType: string) {
    const preview = this.filePreviews[fileType];
    if (!preview) return;
    this.previewData = preview;
    this.currentPreviewFile = this.files[fileType]?.[0] ?? null;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  shortenFileName(fileName: string, maxLength: number = 20): string {
    return shortenFileName(fileName, maxLength);
  }

  onSubmit() {
    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === this.updateDeviceForm.value.countryCode,
    );
    this.updateDeviceForm.controls['organizationId'].setValue(
      this.organizationId ?? this.loginuser?.organizationId,
    );
    if (this.updateDeviceForm.controls['serialNumber'].value == null) {
      this.updateDeviceForm.controls['serialNumber'].setValue(this.serialNumber);
    }
    this.updateDeviceForm.controls['countryCode'].setValue(selectedCountry?.alpha3);

    // Capture the form value once — .value returns a new snapshot each call
    const formValue = this.updateDeviceForm.value;

    // Truncate lat/long to 9 decimal places (backend regex limit)
    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng ? `${intLng}.${decLng.slice(0, 20)}` : intLng;
    }

    // Check if any files were selected
    const hasFiles = this.fileTypes.some(
      (ft) => this.files[ft]?.length > 0,
    );

    let payload: FormData | Record<string, any>;

    if (hasFiles) {
      // Send as multipart FormData (requires updated backend with FileFieldsInterceptor)
      const formData = new FormData();
      formData.append('deviceToUpdate', JSON.stringify(formValue));

      const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
      const maxSizeInMB = 20;
      let allErrors: Record<string, string[]> = {};

      this.fileTypes.forEach((fileType: FileType) => {
        const files = this.files[fileType];
        if (files?.length) {
          const { errors } = validateAndAppendFiles(
            formData,
            files,
            fileType,
            allowedExtensions,
            maxSizeInMB,
            this.toastrService,
          );
          if (Object.keys(errors).length > 0) {
            allErrors = { ...allErrors, ...errors };
          }
        }
      });

      if (Object.keys(allErrors).length > 0) {
        console.error('One or more files are invalid.', allErrors);
        return;
      }
      payload = formData;
    } else {
      // No files — send as plain JSON (compatible with current backend)
      payload = formValue;
    }

    this.deviceService
      .update(
        this.externalid,
        payload,
        this.updateDeviceForm.controls['serialNumber'].value !== this.initSerialNumber,
      )
      .subscribe({
        next: (data: any) => {
          this.toastrService.success(
            'Updated Successfully !!',
            'Device! ' + data.serialNumber,
          );
          if (this.loginuser.role === 'Admin') {
            this.router.navigate(['/admin/All_devices']);
          } else if (this.loginuser.role === 'Registrant') {
            this.router.navigate(['/registrant/All_devices']);
          } else {
            this.router.navigate(['/device/AllList']);
          }
        },
        error: (err: any): void => {
          console.error('error caught in component', err.error.message);
          const message =
            err.error?.message || err.message || 'Failed to update device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else {
            this.toastrService.error(message, 'Device ' + this.externalid);
          }
        },
      });
  }
  reset() {
    if (this.frombulk) {
      this.router.navigate(['/device/bulk_upload']);
    } else {
      this.router.navigate(['/device/AllList']);
    }
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (latitude && longitude) {
      const markers = [
        {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      ];

      if (this.mapComponent) {
        this.mapComponent.markers = [...markers];
        if (this.mapComponent.isMapInitialized) {
          this.mapComponent.update();
        }
      }
      if (this.satelliteMapComponent) {
        this.satelliteMapComponent.markers = [...markers];
        if (this.satelliteMapComponent.isMapInitialized) {
          this.satelliteMapComponent.update();
        }
      }
    }
  }

  onOperatingConfigChange(config: string | null): void {
    this.evidenceReqs = getEvidenceRequirements(config);
  }

  getDocRequirement(docType: string): RequirementLevel {
    return (this.evidenceReqs as any)[docType] ?? 'optional';
  }

  getDocHint(docType: string): string | null {
    return getHint(this.operatingConfiguration, docType);
  }
}
