import {
  Component,
  TemplateRef,
  ViewChild,
  ElementRef,
  EventEmitter,
  Output,
  OnDestroy,
  NgZone,
  HostListener,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import {
  AbstractControl,
  FormGroup,
  FormBuilder,
  FormArray,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { ImageZoomPanDirective } from '../../../shared/directives/image-zoom-pan.directive';
import {
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, Subject, combineLatest } from 'rxjs';
import {
  startWith,
  map,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs/operators';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  DocumentType,
  DataSourceTypes,
  OrganizationType,
  OperatingConfiguration,
  SourceAccessMode,
  RegistrationType,
  VolumeEvidenceType,
  LABELLING_SCHEMES,
} from '../../../utils/drec.enum';
import { MapComponent } from '../../map/map.component';
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
import { environment } from '../../../../environments/environment';
import { ChatService, ChatMessage } from '../../../chat/chat.service';
import { MeterReadService } from '../../../auth/services/meter-read.service';
import {
  CodExtractedFields,
  DocumentClassifierService,
  MeterIdsExtractedFields,
  Sf02ExtractedFields,
  Sf02cExtractedFields,
  SldExtractedFields,
} from '../../../utils/document-classifier.service';
import {
  ClassificationResult,
  DOCUMENT_TYPE_LABELS,
} from '../../../utils/document-keywords';

export type DeviceFiles = {
  [DocumentType.FORM_SF_02]: File[];
  [DocumentType.SF_02C]: File[];
  [DocumentType.PROOF_OF_OWNERSHIP]: File[];
  [DocumentType.METERING_EVIDENCE]: File[];
  [DocumentType.SINGLE_LINE_DIAGRAM]: File[];
  [DocumentType.PROJECT_PHOTOS]: File[];
  [DocumentType.COD_PROOF]: File[];
  [DocumentType.OTHER_DOCUMENTS]: File[];
};
type FileType = keyof DeviceFiles;

@Component({
  standalone: false,
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss'],
})
export class AddDevicesComponent implements OnDestroy {
  @ViewChild('popupDialog') popupDialog = {} as TemplateRef<any>;
  @ViewChild('previewDialog') previewDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('errorDialog') errorDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('renameDialog') renameDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('imageFullView') imageFullViewTemplate = {} as TemplateRef<any>;
  imageFullViewUrl: any = null;
  imageFullViewName: string = '';
  imageFullViewRef: any = null;
  previewDialogRef: any;
  previewData: { url: any; type: string; name: string } | null = null;
  currentPreviewFile: File | null = null;
  currentPreviewDocType: string | null = null;
  DataSourceTypes = DataSourceTypes;
  DocumentType = DocumentType;
  operatingConfigurations = Object.values(OperatingConfiguration);
  sourceAccessModes = Object.values(SourceAccessMode);
  labellingSchemes = LABELLING_SCHEMES;
  registrationTypes = Object.values(RegistrationType);
  volumeEvidenceTypes = Object.values(VolumeEvidenceType);
  evidenceReqs: EvidenceRequirements = getEvidenceRequirements(null);

  /** AI document classification suggestions per device/fileType. */
  classificationSuggestions: {
    [deviceIndex: number]: { [fileType: string]: ClassificationResult | null };
  } = {};
  classifying: { [deviceIndex: number]: { [fileType: string]: boolean } } = {};
  DOCUMENT_TYPE_LABELS = DOCUMENT_TYPE_LABELS;

  /** SLD vision extraction state per device. */
  sldExtractions: { [deviceIndex: number]: SldExtractedFields | null } = {};
  sldExtracting: { [deviceIndex: number]: boolean } = {};

  /** SF-02c text/vision extraction state per device. */
  sf02cExtractions: { [deviceIndex: number]: Sf02cExtractedFields | null } = {};
  sf02cExtracting: { [deviceIndex: number]: boolean } = {};

  /** COD proof extraction state per device. */
  codExtractions: { [deviceIndex: number]: CodExtractedFields | null } = {};
  codExtracting: { [deviceIndex: number]: boolean } = {};

  /** SF-02 (registration form) extraction state per device. */
  sf02Extractions: { [deviceIndex: number]: Sf02ExtractedFields | null } = {};
  sf02Extracting: { [deviceIndex: number]: boolean } = {};

  /** Aggregated measurement IDs harvested from any number of metering
   *  screenshots / nameplate photos / COD proofs. Each upload appends
   *  its results so the user sees the running list. */
  meterIdsExtractions: { [deviceIndex: number]: string[] } = {};
  meterIdsBrands: { [deviceIndex: number]: string } = {};
  meterIdsExtracting: { [deviceIndex: number]: boolean } = {};

  /** Source-doc identity for each extraction state map above. Set
   *  when an extraction runs so the apply* path can record which
   *  specific file contributed each value into recordProvenance —
   *  the bare source type ("SLD", "SF-02c", "Meter IDs") doesn't
   *  identify the file when a device has multiple docs of the same
   *  type. For meter IDs we keep a per-ID map because each upload
   *  appends, so different IDs can come from different docs in the
   *  same batch. */
  sldExtractionDoc: { [deviceIndex: number]: { id?: number; name: string } | null } = {};
  sf02cExtractionDoc: { [deviceIndex: number]: { id?: number; name: string } | null } = {};
  codExtractionDoc: { [deviceIndex: number]: { id?: number; name: string } | null } = {};
  sf02ExtractionDoc: { [deviceIndex: number]: { id?: number; name: string } | null } = {};
  /** Cached File objects from the most recent extraction. Kept so the
   *  user can re-open the verify-source queue without re-uploading. */
  sldExtractionFile: { [deviceIndex: number]: File | null } = {};
  sf02cExtractionFile: { [deviceIndex: number]: File | null } = {};
  codExtractionFile: { [deviceIndex: number]: File | null } = {};
  sf02ExtractionFile: { [deviceIndex: number]: File | null } = {};
  meterIdsExtractionDocs: {
    [deviceIndex: number]: Record<string, { id?: number; name: string; file?: File }>;
  } = {};

  /** Auto-classifier extraction phase. When true, the magic-overlay
   *  dialog shows the consolidated extraction view (running spinner +
   *  preview list + single Apply All button) instead of the
   *  classification table. Set by "OK + Extract", cleared on Apply
   *  All / Cancel. */
  magicExtractMode: { [deviceIndex: number]: boolean } = {};

  /** When multiple sources claim different values for the same form
   *  field, the user picks one in the dialog. Maps form-control name
   *  → chosen source label. */
  conflictPicks: { [deviceIndex: number]: { [field: string]: string } } = {};

  /** Name of the file currently being processed in Phase 1 (sort).
   *  Surfaced below the progress bar so the user sees liveness. */
  magicCurrentFile: { [deviceIndex: number]: string | null } = {};
  /** Substep within the current file (e.g. "OCR on image (slow)…"). */
  magicCurrentStep: { [deviceIndex: number]: string | null } = {};

  /** Magic auto-sort state. */
  magicRunning: { [deviceIndex: number]: boolean } = {};
  magicDone: { [deviceIndex: number]: number } = {};
  magicTotal: { [deviceIndex: number]: number } = {};
  magicLog: {
    [deviceIndex: number]: Array<{
      filename: string;
      target: string;
      confidence: number | null;
      // 'hit'   = classified successfully into a specific slot
      // 'other' = routed to OTHER_DOCUMENTS catch-all (not an error)
      // 'miss'  = actual classifier failure (network error etc.)
      // 'skip'  = duplicate / explicitly skipped (informational)
      type: 'hit' | 'other' | 'miss' | 'skip';
      file?: File;
      docType?: string; // populated for hit rows so post-sort extraction
                       // can route the file to the right extractor.
    }>;
  } = {};
  private magicBackupFiles: { [deviceIndex: number]: any } = {};
  private magicBackupPreviews: { [deviceIndex: number]: any } = {};

  /** Called when operating configuration changes. Updates evidence requirements. */
  onOperatingConfigChange(config: string | null, formIndex: number): void {
    this.evidenceReqs = getEvidenceRequirements(config);
  }

  getDocRequirement(docType: string): RequirementLevel {
    return (this.evidenceReqs as any)[docType] ?? 'optional';
  }

  getDocHint(docType: string): string | null {
    const devices = this.myform.get('devices') as FormArray;
    if (!devices || devices.length === 0) return null;
    const config = devices.at(0)?.get('operatingConfiguration')?.value;
    return getHint(config, docType);
  }
  dialogRef: any;
  user: any;
  myform: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  hide = true;
  showerror: any[] = [];
  siteNameExists: boolean[] = [];
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
  serialNumberRegex: RegExp = /^[a-zA-Z0-9_;-]+$/;
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
    [index: number]: DeviceFiles;
  } = {};
  // Per-file labels staged locally. Keyed by device index → file type → position in files array.
  fileLabels: {
    [index: number]: { [fileType: string]: string[] };
  } = {};
  // Per-device list of serial/meter IDs, joined with ';' into the serialNumber form control on change.
  serialNumberLists: { [index: number]: string[] } = {};
  // Object URLs created for staged previews in the rename dialog — revoked on dialog close.
  renameObjectUrls: string[] = [];
  renameDialogDeviceIndex: number = 0;
  renameDialogType: string = '';
  renameDialogRef: any = null;
  filePreviews: {
    [index: number]: {
      [key: string]: {
        url: SafeResourceUrl;
        type: 'image' | 'pdf' | 'excel' | 'other';
        name: string;
      };
    };
  } = {};
  allDocumentsUploaded: boolean = false;
  formValid: boolean = false;
  isSubmitting: boolean = false;
  /** 0–100; updated from HttpClient UploadProgress events so the overlay
   *  shows actual upload state instead of an opaque "Uploading…" spinner. */
  uploadProgressPct = 0;
  /** 'uploading' while bytes are flowing, 'processing' once the server is
   *  parsing the multipart body and writing rows. */
  uploadPhase: 'uploading' | 'processing' = 'uploading';
  /** Populated when onSubmit is clicked while invalid — rendered in a
   *  prominent banner above the form so the registrant cannot miss it. */
  submitValidationErrors: string[] = [];

  /** Block tab-close / refresh while the registrant has unresolved
   *  submit-time validation errors. The route's CanDeactivate handles
   *  in-app navigation; this covers the browser-level case. */
  @HostListener('window:beforeunload', ['$event'])
  protectAgainstAccidentalNavigation(e: BeforeUnloadEvent): void {
    if (this.submitValidationErrors.length) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  submitButtonText: string = 'Submit';
  // Per-row state for the Save & Generate SF-02 flow. After a row is
  // saved this way it carries the new device id and the timestamp of
  // the latest auto-generated SF-02; bulk Submit then skips it.
  savedDeviceIdByIndex: Record<number, number> = {};
  isGeneratingSf02ByIndex: Record<number, boolean> = {};
  isGeneratingProvenance: Record<number, boolean> = {};
  provenanceGeneratedAt: Record<number, string> = {};
  /** Per-device, per-source flag: true once the user has clicked
   *  "Apply to form" (whether or not they accepted the conflict
   *  overwrites). Disables the button to prevent redundant re-apply
   *  / re-prompt. Cleared when a fresh extraction lands. */
  extractionApplied: Record<number, Record<string, boolean>> = {};
  sf02GeneratedAtByIndex: Record<number, string> = {};
  requiredFileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.PROOF_OF_OWNERSHIP,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.COD_PROOF,
  ];
  @ViewChild('streetMap') mapComponent: MapComponent;
  @ViewChild('satelliteMap') satelliteMapComponent: MapComponent;
  @Output() zoom = new EventEmitter<number>();

  /** When the route is /device/edit/:id, the same component runs in
   *  edit mode: hydrates the first FormArray row from the existing
   *  device, hides the "+ Add Device" button, switches the submit
   *  path to PATCH. When undefined the component behaves as the
   *  classic multi-row Add flow. */
  editingExternalId: string | null = null;
  /** Numeric id once the device has been loaded — extractors use it
   *  for ai_audit_log per-device tracking. */
  editingDeviceId: number | null = null;

  /** Existing server-saved docs for the device being edited, keyed by
   *  device-row index → docType. Add-flow keeps this empty; edit-flow
   *  populates it for index 0 from getDocuments(). */
  existingDocs: {
    [deviceIndex: number]: {
      [type: string]: {
        url: string;
        name: string;
        id: number;
        label: string | null;
        createdAt?: string;
      }[];
    };
  } = {};
  brokenDocs: { [deviceIndex: number]: { [type: string]: boolean } } = {};
  /** Initial serial number observed at hydration time so we can flag
   *  changes for the PATCH `serialNumberChanged` query param. */
  private initSerialNumber: string | null = null;
  private initSiteName: string | null = null;
  /** Snapshot of every control value at edit-mode load time. Used by
   *  submitEdit to detect explicit clears: if a control was non-empty
   *  on load and is now empty, send `null` so the backend wipes the
   *  column instead of skipMissingProperties keeping the old value. */
  private initialValues: { [name: string]: any } = {};

  get isEditMode(): boolean {
    return this.editingExternalId !== null;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    public dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private documentClassifier: DocumentClassifierService,
    private ngZone: NgZone,
    public chatService: ChatService,
    private meterReadService: MeterReadService,
  ) {
    this.user = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.editingExternalId = this.route.snapshot.paramMap.get('id');
    this.loadData();
    this.initializeForm();
    this.showerror[0] = false;
    this.siteNameExists[0] = false;
    this.installFloatingDialogZoom();
    this.installFloatingDialogResize();

    this.deviceForms.controls.forEach((group, i) => {
      this.setupdataSourceBrandWatcher(group as FormGroup);
      this.setupDataSourceWatcher(group as FormGroup);
      this.setupSiteNameWatcher(group as FormGroup, i);
      this.setupImpactStoryWatcher(group as FormGroup);
      this.setupCoordSanitizer(group as FormGroup);
    });

    if (this.isEditMode) {
      // Defer until country/SDG/fuel/device-type lookups land — the
      // hydration step needs them to translate codes into the form's
      // display values. Poll briefly; loadData() kicks all four off in
      // parallel so they typically resolve in <100ms.
      const start = Date.now();
      const wait = (): void => {
        if (
          this.countrylist?.length &&
          this.sdgblist &&
          this.fuellist?.length &&
          this.devicetypelist?.length
        ) {
          this.loadDeviceForEdit();
        } else if (Date.now() - start < 8000) {
          setTimeout(wait, 100);
        } else {
          // Lookups still missing — try anyway; fields that depend on
          // them will show the raw code instead of the display value.
          this.loadDeviceForEdit();
        }
      };
      wait();
    }
  }

  /**
   * Edit-mode hydration. Pulls the existing device by externalId and
   * patches the first FormArray row with its values, then loads its
   * server-saved documents into existingDocs[0]. Mirrors edit-device's
   * old getDeviceinfo() / getDocuments() flow.
   */
  private loadDeviceForEdit(): void {
    if (!this.editingExternalId) return;
    this.deviceService
      .getDeviceInfoBYexternalId(this.editingExternalId)
      .subscribe({
        next: (data: any) => {
          this.editingDeviceId = data.id;
          // Hydrate any previously-persisted dismissed-serials list
          // BEFORE we hand the device's serialNumber to the form, so
          // we can strip phantom values the user already declined in
          // a prior session.
          this.loadDismissedSerials(0);
          this.loadDismissedFieldValues(0);
          this.loadOcWalkState();
          const dismissed = this.dismissedSerialNumbers[0] ?? new Set();
          const filterDismissed = (s: string | null) => {
            if (!s) return s;
            const kept = String(s)
              .split(';')
              .map((x) => x.trim())
              .filter((x) => x && !dismissed.has(x.toLowerCase()));
            return kept.length ? kept.join(';') : null;
          };
          if (data.serialNumber) {
            const cleaned = filterDismissed(data.serialNumber);
            if (cleaned !== data.serialNumber) {
              data.serialNumber = cleaned;
            }
          }
          // Generic blacklist: for each non-serial field that has a
          // dismissed value matching what the server returned, NULL
          // it on data before patchValue runs. The registrant once
          // declined the value — it stays gone.
          const fieldBlacklist = this.dismissedFieldValues[0] ?? {};
          for (const f of Object.keys(fieldBlacklist)) {
            const v = (data as any)[f];
            if (v != null && fieldBlacklist[f].has(String(v).trim().toLowerCase())) {
              (data as any)[f] = null;
            }
          }
          this.initSerialNumber = data.serialNumber ?? null;
          this.initSiteName = data.siteName ?? null;
          this.initialValues = { ...data };
          // Compute the live-issues sidebar once the hydrated form
          // and provenance are settled.
          setTimeout(() => this.refreshLiveIssues(), 400);

          // Pull reviewer notes for this device's chat so the banner
          // shows them on landing. Notes are kind='note' messages in
          // the device's chat conversation.
          if (data.siteName) {
            this.chatService
              .getConversation(undefined, undefined, data.siteName)
              .subscribe({
                next: (conv) => {
                  if (conv?.headUuid) {
                    this.chatService.getChain(conv.headUuid).subscribe({
                      next: (msgs) =>
                        this.chatService.messages$.next(msgs ?? []),
                      error: () => {/* silent */},
                    });
                  }
                },
                error: () => {/* silent; banner stays empty */},
              });
          }

          const firstRow = this.deviceForms.at(0) as FormGroup;
          if (!firstRow) return;

          // Map alpha3 country code → display name for the autocomplete.
          const countryName = this.countrylist.find(
            (c: any) => c.alpha3 === data.countryCode,
          )?.country ?? data.countryCode;

          // SDGBenefits storage uses the value but the UI binds on name.
          let sdgBenefitNames: string[] = [];
          if (Array.isArray(data.SDGBenefits) && this.sdgblist) {
            sdgBenefitNames = data.SDGBenefits.map((sdgValue: string) => {
              const found = (this.sdgblist as any[]).find(
                (ele: any) =>
                  ele.value?.toString().toLowerCase() ===
                  String(sdgValue).toLowerCase(),
              );
              return found?.name ?? sdgValue;
            });
          }

          // OC#37 labelling-scheme accreditation: stored as '; '-joined string,
          // form expects an array.
          const labellingSchemeArr: string[] = data.labellingSchemeAccreditation
            ? String(data.labellingSchemeAccreditation)
                .split(/\s*;\s*/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

          // Restore extractor provenance saved on prior edits so the
          // conflict block can credit fields to their original source
          // instead of falsely tagging them MANUAL on re-edit.
          this.appliedProvenance[0] = { ...((data as any).fieldProvenance ?? {}) };
          // Hydrate OC# walkthrough recording (if the prior session
          // ran one). Stored under the synthetic key __ocWalkLog so
          // it rides on fieldProvenance — no schema change needed.
          const rec = (this.appliedProvenance[0] as any)?.['__ocWalkLog'];
          this.ocWalkLog = Array.isArray(rec?.value) ? rec.value : [];
          // Filter dismissed serials out of the persisted serialNumber
          // provenance .value (joined chip list) AND its per-id
          // docsByValue / personByValue / verifiedByValue maps. Without
          // this, a phantom serial saved in a prior session would
          // re-attach when the device reloads.
          const snProv = (this.appliedProvenance[0] as any)?.['serialNumber'];
          const dismissedSet = this.dismissedSerialNumbers[0] ?? new Set();
          if (snProv && dismissedSet.size) {
            const filterMap = (m: Record<string, any> | undefined) => {
              if (!m) return m;
              const out: Record<string, any> = {};
              for (const k of Object.keys(m)) {
                if (!dismissedSet.has(k.toLowerCase())) out[k] = m[k];
              }
              return out;
            };
            if (typeof snProv.value === 'string') {
              const kept = snProv.value
                .split(';')
                .map((s: string) => s.trim())
                .filter((s: string) => s && !dismissedSet.has(s.toLowerCase()));
              snProv.value = kept.join(';');
            }
            snProv.docsByValue = filterMap(snProv.docsByValue);
            snProv.personByValue = filterMap(snProv.personByValue);
            snProv.verifiedByValue = filterMap(snProv.verifiedByValue);
            snProv.regionByValue = filterMap(snProv.regionByValue);
          }
          firstRow.patchValue({
            siteName: data.siteName,
            serialNumber: data.serialNumber,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            countryCodename: countryName,
            fuelCode: data.fuelCode,
            deviceTypeCode: data.deviceTypeCode,
            capacity: data.capacity,
            commissioningDate: data.commissioningDate,
            gridInterconnection: data.gridInterconnection,
            operatingConfiguration: data.operatingConfiguration ?? null,
            sourceAccessMode: data.sourceAccessMode ?? null,
            offTaker: data.offTaker,
            impactStory: data.impactStory,
            deviceDescription: data.deviceDescription,
            stateProvince: data.stateProvince,
            postcode: data.postcode,
            SDGBenefits: sdgBenefitNames,
            labellingSchemeAccreditation: labellingSchemeArr,
            version: data.version ?? '1.0',
            defaultAccountCode: data.defaultAccountCode,
            requestedEffectiveRegDate: data.requestedEffectiveRegDate,
            signatoryName: data.signatoryName,
            gridExportType: data.gridExportType,
            hasNetworkMeter: data.hasNetworkMeter,
            meterReadsShareable: data.meterReadsShareable,
            hasCaptiveConsumer: data.hasCaptiveConsumer,
            hasAuxiliaryEnergySources: data.hasAuxiliaryEnergySources,
            auxiliaryEnergySourceDetails: data.auxiliaryEnergySourceDetails,
            nonMeterImportDetails: data.nonMeterImportDetails,
            otherEacSchemeRegistration: data.otherEacSchemeRegistration,
            additionalInfo: data.additionalInfo,
            generatingUnitCount: data.generatingUnitCount,
            networkOwner: data.networkOwner,
            interconnectionVoltage: data.interconnectionVoltage,
            pvSystemOwner: data.pvSystemOwner,
            pvSystemOwnerAddress: data.pvSystemOwnerAddress,
            offTakerName: data.offTakerName,
            offTakerSameCompanyAsOwner: data.offTakerSameCompanyAsOwner,
            hasSubsidy: data.hasSubsidy,
            subsidyTypes: data.subsidyTypes ?? [],
            subsidyOtherDetails: data.subsidyOtherDetails,
            subsidyClaimsEacs: data.subsidyClaimsEacs,
            hasPublicFunding: data.hasPublicFunding,
            publicFundingEndDate: data.publicFundingEndDate,
            registrationType: data.registrationType,
            volumeEvidenceType: data.volumeEvidenceType,
            verificationAgentName: data.verificationAgentName,
            offGridCircumstances: data.offGridCircumstances,
            dataSource: data.dataSource,
            dataSourceBrand: data.dataSourceBrand,
            otherDataSource: data.otherDataSource,
          });

          this.organizationId = data.organizationId ?? this.organizationId;

          // Refresh evidence-requirements off the loaded operating config.
          this.evidenceReqs = getEvidenceRequirements(
            data.operatingConfiguration ?? null,
          );

          // Re-seed serial-number list from joined string.
          this.serialNumberLists[0] = data.serialNumber
            ? String(data.serialNumber).split(/\s*;\s*/)
            : [''];

          // Recenter both maps on the loaded coords so the
          // satellite view doesn't sit at the leaflet default
          // (Sahara) until the user pans / pastes coords.
          // Defer to next tick so the @ViewChild map components
          // have caught up with hydration.
          const lat = parseFloat(String(data.latitude));
          const lng = parseFloat(String(data.longitude));
          if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)) {
            setTimeout(() => {
              this.mapComponent?.recenter(lat, lng);
              this.satelliteMapComponent?.recenter(lat, lng);
            }, 0);
          }

          // Load existing docs for this device (single-row, so always index 0).
          this.deviceService.getDocuments(data.id).subscribe({
            next: (docs) => {
              const docsByType: {
                [type: string]: {
                  url: string;
                  name: string;
                  id: number;
                  label: string | null;
                  createdAt?: string;
                }[];
              } = {};
              for (const doc of docs) {
                if (!docsByType[doc.type]) docsByType[doc.type] = [];
                let name =
                  doc.url.split('/').pop()?.split('?')[0] || doc.type;
                name = name.replace(/\+/g, ' ');
                let prev = '';
                while (name !== prev) {
                  prev = name;
                  try {
                    name = decodeURIComponent(name);
                  } catch {
                    break;
                  }
                }
                name = name.replace(
                  /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
                  '',
                );
                name = name.replace(/_\d{10,}_\d+\./, '.');
                docsByType[doc.type].push({
                  url: doc.url,
                  name: doc.originalFilename || name,
                  id: doc.id,
                  label: doc.label,
                  createdAt: doc.createdAt,
                });
              }
              for (const t of Object.keys(docsByType)) {
                docsByType[t].sort((a, b) =>
                  (a.label || a.name).localeCompare(b.label || b.name, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                  }),
                );
              }
              this.existingDocs[0] = docsByType;
              this.autoSetMeterReadsShareable(0);
              // Re-run extractors on every saved doc so
              // sldExtractions[i] / codExtractions[i] / etc. are
              // populated and the auto-regen provenance report can
              // attribute each form field to its source. Cheap
              // because ai_response_cache short-circuits the Haiku
              // round-trip on a content-hash hit.
              this.replayExtractorsOnExistingDocs(0, docsByType);
              // Auto-regenerate the EVIDENCE_PROVENANCE report if its
              // attached copy is older than the latest fieldProvenance
              // entry. Catches out-of-band updates to field_provenance
              // (server-side backfills, future cron jobs) so the report
              // catches up without requiring a manual Save.
              setTimeout(
                () => this.maybeAutoRegenerateProvenanceReport(0),
                2000,
              );

              // Probe each URL for 404s so the UI can flag broken links.
              this.brokenDocs[0] = {};
              for (const type of Object.keys(docsByType)) {
                for (const doc of docsByType[type]) {
                  if (!doc.url) {
                    this.brokenDocs[0][type] = true;
                    continue;
                  }
                  const ctrl = new AbortController();
                  fetch(doc.url, {
                    method: 'GET',
                    mode: 'cors',
                    signal: ctrl.signal,
                  }).then(
                    (res) => {
                      ctrl.abort();
                      if (!res.ok) this.brokenDocs[0][type] = true;
                    },
                    (err) => {
                      if (err?.name !== 'AbortError')
                        this.brokenDocs[0][type] = true;
                    },
                  );
                }
                // Pre-populate filePreviews so View buttons render for
                // existing docs even before the user touches the file
                // input.
                if (
                  !this.filePreviews[0]?.[type] &&
                  docsByType[type]?.length
                ) {
                  const doc = docsByType[type][0];
                  const ext = doc.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = [
                    'jpg',
                    'jpeg',
                    'png',
                    'gif',
                    'webp',
                    'bmp',
                  ].includes(ext);
                  const isPdf = ext === 'pdf';
                  const isExcel = ext === 'xlsx' || ext === 'xls';
                  if (!this.filePreviews[0]) this.filePreviews[0] = {};
                  this.filePreviews[0][type] = {
                    url: this.sanitizer.bypassSecurityTrustResourceUrl(
                      doc.url,
                    ),
                    type: isImage
                      ? 'image'
                      : isPdf
                        ? 'pdf'
                        : isExcel
                          ? 'excel'
                          : 'other',
                    name: doc.name,
                  };
                }
              }
            },
            error: () => {},
          });
        },
        error: (err: any) => {
          this.toastrService.error(
            err?.error?.message || err?.message || 'Failed to load device',
            'Edit',
          );
        },
      });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Revoke object URLs to prevent memory leaks
    for (const deviceIndex of Object.keys(this.filePreviews)) {
      for (const fileType of Object.keys(this.filePreviews[+deviceIndex])) {
        const preview = this.filePreviews[+deviceIndex][fileType];
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
      }
    }
  }

  private fetchOrganizationList() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      this.currentOrganization = data;
      if (
        ![OrganizationType.Registrant, OrganizationType.Admin].includes(
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
        this.date = new Date();
      });
    } else if (this.user.role === OrganizationType.Registrant) {
      this.orgService.GetRegistrantAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) =>
            org.organizationType === 'Registrant',
        );
        this.filteredOrganizationList = this.organizationList;
      });
    }

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();
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
    this.myform.valueChanges.subscribe(() => this.refreshLiveIssues());

    const device = this.fb.group({
      siteName: [null],
      dataSource: [null],
      serialNumber: [null, Validators.pattern(this.serialNumberRegex)],
      otherDataSource: [''],
      address: [null],
      dataSourceBrand: [''],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null],
      fuelCode: ['ES100'],
      deviceTypeCode: [null],
      capacity: [null],
      commissioningDate: [new Date()],
      gridInterconnection: [null],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      stateProvince: [null],
      SDGBenefits: [[]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      defaultAccountCode: [null],
      requestedEffectiveRegDate: [null],
      signatoryName: [null],
      gridExportType: [null],
      hasNetworkMeter: [null],
      meterReadsShareable: [null],
      hasCaptiveConsumer: [null],
      hasAuxiliaryEnergySources: [null],
      auxiliaryEnergySourceDetails: [null],
      nonMeterImportDetails: [null],
      otherEacSchemeRegistration: [null],
      additionalInfo: [null],
      generatingUnitCount: [null],
      networkOwner: [null],
      interconnectionVoltage: [null],
      pvSystemOwner: [null],
      pvSystemOwnerAddress: [null],
      offTakerName: [null],
      offTakerSameCompanyAsOwner: [null],
      hasSubsidy: [null],
      subsidyTypes: [[]],
      subsidyOtherDetails: [null],
      subsidyClaimsEacs: [null],
      hasPublicFunding: [null],
      publicFundingEndDate: [null],
      registrationType: [null],
      volumeEvidenceType: [null],
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      PROOF_OF_OWNERSHIP: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    device.get('latitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        device.get('latitude')?.setValue(stripped, { emitEvent: false });
      const longitude = device.get('longitude')?.value;
      this.updateMapMarkers(stripped, longitude);
    });
    device.get('longitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        device.get('longitude')?.setValue(stripped, { emitEvent: false });
      const latitude = device.get('latitude')?.value;
      this.updateMapMarkers(latitude, stripped);
    });

    this.deviceForms.push(device);
    this.serialNumberLists[this.deviceForms.length - 1] = [''];
    this.setupDataSourceWatcher(device);
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
      this.countrylist = data;
      this.setupCountryAutocomplete(0);
    });
  }

  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
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
    toppings[i].SDGBenefits.setValue(sdgb);
  }

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }

  adddevice() {
    const device = this.fb.group({
      dataSource: [null],
      dataSourceBrand: [''],
      serialNumber: [null, Validators.pattern(this.serialNumberRegex)],
      otherDataSource: [''],
      siteName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null],
      fuelCode: ['ES100'],
      deviceTypeCode: [null],
      capacity: [null],
      commissioningDate: [new Date()],
      gridInterconnection: [null],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      stateOrProvince: [null],
      SDGBenefits: [[]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      defaultAccountCode: [null],
      requestedEffectiveRegDate: [null],
      signatoryName: [null],
      gridExportType: [null],
      hasNetworkMeter: [null],
      meterReadsShareable: [null],
      hasCaptiveConsumer: [null],
      hasAuxiliaryEnergySources: [null],
      auxiliaryEnergySourceDetails: [null],
      nonMeterImportDetails: [null],
      otherEacSchemeRegistration: [null],
      additionalInfo: [null],
      generatingUnitCount: [null],
      networkOwner: [null],
      interconnectionVoltage: [null],
      pvSystemOwner: [null],
      pvSystemOwnerAddress: [null],
      offTakerName: [null],
      offTakerSameCompanyAsOwner: [null],
      hasSubsidy: [null],
      subsidyTypes: [[]],
      subsidyOtherDetails: [null],
      subsidyClaimsEacs: [null],
      hasPublicFunding: [null],
      publicFundingEndDate: [null],
      registrationType: [null],
      volumeEvidenceType: [null],
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      PROOF_OF_OWNERSHIP: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    this.deviceForms.push(device);
    this.serialNumberLists[this.deviceForms.length - 1] = [''];

    const index = this.deviceForms.length - 1;
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );

    this.setupDataSourceWatcher(device);
    this.siteNameExists[index] = false;
    this.setupSiteNameWatcher(device, index);
    this.setupImpactStoryWatcher(device);
    this.setupCoordSanitizer(device);
  }

  /**
   * Strip ALL whitespace from latitude/longitude inputs as the user
   * types or pastes. Spreadsheet copy-paste regularly drags along
   * leading/trailing spaces or non-breaking spaces, and the backend
   * coord regex rejects them — making the form silently invalid
   * with no red border. Auto-strip avoids the "stray space" trap.
   *
   * Also reverse-geocodes via Nominatim (OSM) once both coords are
   * set + valid, to fill stateProvince + postcode when empty.
   */
  private setupCoordSanitizer(deviceGroup: FormGroup): void {
    for (const name of ['latitude', 'longitude'] as const) {
      const ctl = deviceGroup.get(name);
      if (!ctl) continue;
      ctl.valueChanges.subscribe((v) => {
        if (typeof v !== 'string') return;
        const cleaned = v.replace(/\s+/g, '');
        if (cleaned !== v) {
          ctl.setValue(cleaned, { emitEvent: false });
        }
      });
    }
    const lat$ = deviceGroup.get('latitude')?.valueChanges;
    const lng$ = deviceGroup.get('longitude')?.valueChanges;
    if (lat$ && lng$) {
      // Re-geocode 1.2 s after either coord stops changing — comfortably
      // under Nominatim's 1 req/s recommendation.
      const trigger = combineLatest([
        lat$.pipe(startWith(deviceGroup.get('latitude')?.value)),
        lng$.pipe(startWith(deviceGroup.get('longitude')?.value)),
      ]).pipe(debounceTime(1200), distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1]));
      trigger.subscribe(([lat, lng]) => {
        const flat = parseFloat(String(lat));
        const flng = parseFloat(String(lng));
        if (!isFinite(flat) || !isFinite(flng)) return;
        if (Math.abs(flat) > 90 || Math.abs(flng) > 180) return;
        this.reverseGeocode(deviceGroup, flat, flng);
      });
    }
  }

  private lastGeocodedKey = '';

  private reverseGeocode(
    deviceGroup: FormGroup,
    lat: number,
    lng: number,
  ): void {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === this.lastGeocodedKey) return;
    this.lastGeocodedKey = key;
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
    this.http
      .get<any>(url, {
        headers: { Accept: 'application/json' },
      })
      .subscribe({
        next: (data) => {
          const a = data?.address ?? {};
          const stateLike =
            a.state ||
            a.region ||
            a.state_district ||
            a.county ||
            a.province ||
            null;
          // State + postcode are coord-derived: always overwrite on
          // a coord change — keeping a stale Paris postcode after
          // moving to India would be worse than clearing it (even if
          // Nominatim returns null for rural locations). Only the
          // tracked geocoder fields get cleared this way.
          this.setCoordDerivedField(deviceGroup, 'stateProvince', stateLike);
          this.setCoordDerivedField(deviceGroup, 'postcode', a.postcode ?? null);
          // The geocoder also writes countryCodename — record it
          // separately so the provenance picks up "Geocoder (lat/lng)"
          // even when only the country was filled.
          // Country: geocoder beats extractor when they disagree.
          // Coords are unambiguous; certificate addresses sometimes
          // refer to a head office in another country (e.g. an EPC's
          // Vietnam HQ on a COD for an Indian site). The user's
          // explicit dropdown pick still wins (userPickedCountry).
          if (a.country) {
            const c = this.normalizeCountry(a.country);
            const ctl = deviceGroup.get('countryCodename');
            const idx = this.deviceForms.controls.indexOf(deviceGroup);
            // Only auto-fill the country if the form is empty.
            // Tracking userPickedCountry via the autocomplete pick
            // missed every other write path (extractor apply,
            // conflict picker, direct typing) and the geocoder
            // would keep stomping on the user's choice. Once any
            // country is in the field, the user owns it.
            const cur = ctl?.value;
            const empty = cur == null || cur === '';
            if (ctl && empty) {
              ctl.setValue(c);
              ctl.markAsDirty();
            }
            // Always record the geocoder's reading even when it
            // didn't write — the credit is "Geocoder said X",
            // regardless of whether we applied it. The pre-submit
            // sidebar uses this to surface disagreements.
            this.recordInference(
              idx,
              'countryCodename',
              'Geocoder (lat/lng)',
              c,
            );
          }
        },
        error: () => {
          // Silent — geocoding is best-effort. Leaving the field
          // empty is fine.
        },
      });
  }

  /** Tracks which device-rows have had a coord-derived field
   *  written so we know it's safe to overwrite on the next geocode
   *  (vs. preserving a value the user typed manually). */
  private coordDerivedDirty: Map<FormGroup, Set<string>> = new Map();

  private setCoordDerivedField(
    deviceGroup: FormGroup,
    name: string,
    value: any,
  ): void {
    const ctl = deviceGroup.get(name);
    if (!ctl) return;
    const ours = this.coordDerivedDirty.get(deviceGroup) ?? new Set();
    const cur = ctl.value;
    const isEmpty = cur === null || cur === undefined || cur === '';
    // Overwrite if: empty OR previously set by us (so a stale
    // geocoder value gets replaced when coords change).
    if (isEmpty || ours.has(name)) {
      const next = value ?? '';
      if (cur !== next) {
        ctl.setValue(next);
        ctl.markAsDirty();
      }
      ours.add(name);
      this.coordDerivedDirty.set(deviceGroup, ours);
      const idx = this.deviceForms.controls.indexOf(deviceGroup);
      if (next) {
        this.recordInference(idx, name, 'Geocoder (lat/lng)', next);
      }
    }
  }

  /**
   * Infer (8) Device Description from free-text impactStory keywords.
   * Only patches when the dropdown is empty so a deliberate user
   * choice survives. Vocabulary matches the devicedescription enum.
   */
  private setupImpactStoryWatcher(deviceGroup: FormGroup): void {
    const idx = this.deviceForms.controls.indexOf(deviceGroup);
    const apply = (text: string | null | undefined) => {
      const setIfEmpty = (name: string, val: any) => {
        const ctl = deviceGroup.get(name);
        if (!ctl || ctl.value || val == null) return;
        ctl.setValue(val);
        ctl.markAsDirty();
        this.recordInference(idx, name, 'Impact story', val);
      };
      setIfEmpty('deviceDescription', this.inferDeviceDescription(text));
      setIfEmpty('offTaker', this.inferOffTaker(text));
      const funding = this.inferFundingFlags(text);
      if (funding) {
        setIfEmpty('hasPublicFunding', funding.publicFunding);
        setIfEmpty('hasSubsidy', funding.subsidy);
      }
      // SDG benefits: only patch if currently empty (multi-select).
      const sdgCtl = deviceGroup.get('SDGBenefits');
      const cur = sdgCtl?.value;
      if (sdgCtl && (!Array.isArray(cur) || cur.length === 0)) {
        const inferred = this.inferSdgBenefits(text);
        if (inferred.length) {
          sdgCtl.setValue(inferred);
          sdgCtl.markAsDirty();
          this.recordInference(idx, 'SDGBenefits', 'Impact story', inferred);
        }
      }
    };
    // Run on initial value (covers edit-mode hydration) and on changes.
    apply(deviceGroup.get('impactStory')?.value);
    deviceGroup
      .get('impactStory')
      ?.valueChanges.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(apply);
  }

  /**
   * Infer (off-taker dropdown) from impactStory free text. Strategy:
   *   1. Look for "<count> <category>" patterns ("369 residential
   *      users", "31 commercial customers"). Pick the category with
   *      the highest count — this captures the typical mini-grid
   *      breakdown ("400 connections, 369 residential, 31 commercial"
   *      → Residential).
   *   2. Fall back to keyword presence if no counts are written.
   * Vocabulary mirrors the offtaker enum so the value drops straight
   * into the dropdown.
   */
  /**
   * Infer applicable SDG codes (SDG1..SDG17) from impactStory text.
   * Keyword-driven; permissive — adds an SDG only when an explicit
   * cue is present. Solar generation projects always get SDG7
   * (Affordable & Clean Energy) and SDG13 (Climate Action) since
   * those are baked into the D-REC value proposition.
   */
  private inferSdgBenefits(text: string | null | undefined): string[] {
    if (!text || !text.trim()) return [];
    const t = text.toLowerCase();
    const hits: string[] = [];
    const map: Array<{ sdg: string; re: RegExp }> = [
      { sdg: 'SDG1', re: /\b(poverty|livelihood|income|low[-\s]income|household income)\b/ },
      { sdg: 'SDG2', re: /\b(food security|hunger|agricultur|farm(ing|s)?|crop yield|irrigation)\b/ },
      { sdg: 'SDG3', re: /\b(health|clinic(s)?|hospital(s)?|vaccin|cold chain|maternal|disease)\b/ },
      { sdg: 'SDG4', re: /\b(school(s)?|education|student(s)?|literacy|classroom|teacher(s)?|learning)\b/ },
      { sdg: 'SDG5', re: /\b(gender|women[-\s]?(led|owned)?|female entrepreneur|girls?\b)/ },
      { sdg: 'SDG6', re: /\b(clean water|water pump|sanitation|hygiene|wash\b)/ },
      // SDG7 and SDG13 are baked-in for any solar project — see below.
      { sdg: 'SDG8', re: /\b(jobs?|employ|economic growth|decent work|sme(s)?|smb(s)?|micro[-\s]enterprise)\b/ },
      { sdg: 'SDG9', re: /\b(infrastructur|industr|mini[-\s]?grid|connectivity|digital access|innovation)\b/ },
      { sdg: 'SDG10', re: /\b(rural|underserved|marginalised|marginalized|last[-\s]mile|equity|inclusion|inequality)\b/ },
      { sdg: 'SDG11', re: /\b(community|urban|city|cities|sustainable cities|housing)\b/ },
      { sdg: 'SDG12', re: /\b(responsible consumption|circular|waste reduction|sustainable production)\b/ },
      { sdg: 'SDG14', re: /\b(marine|ocean|coastal|fisheries)\b/ },
      { sdg: 'SDG15', re: /\b(biodiversity|forest(s)?|reforestation|land degradation|wildlife)\b/ },
      { sdg: 'SDG16', re: /\b(governance|peace|justice|institutions|transparency)\b/ },
      { sdg: 'SDG17', re: /\b(partnership(s)?|public[-\s]private|multi[-\s]stakeholder)\b/ },
    ];
    for (const { sdg, re } of map) {
      if (re.test(t)) hits.push(sdg);
    }
    // Always-on for solar generation.
    if (!hits.includes('SDG7')) hits.unshift('SDG7');
    if (!hits.includes('SDG13')) hits.push('SDG13');
    return hits;
  }

  /**
   * Detect explicit mentions of public funding / subsidy in the
   * impact story. Conservative — only fires "Yes" when the text
   * explicitly names a programme/subsidy. Doesn't set "No" because
   * absence of evidence isn't evidence of absence.
   */
  private inferFundingFlags(
    text: string | null | undefined,
  ): { publicFunding: 'Yes' | null; subsidy: 'Yes' | null } | null {
    if (!text) return null;
    const t = text.toLowerCase();
    const publicSignals = [
      // Multilateral / DFI funders
      /\b(world\s*bank|ifc\b|afdb|adb\b|eib\b|undp|usaid|gef\b|green\s*climate\s*fund|gcf\b)/,
      // Bilaterals
      /\b(dfid|fcdo|giz\b|kfw|sida|norad|aecid|jica|gpe\b)/,
      // EU / national grants
      /\b(eu[-\s]funded|european\s*union\s*funded|horizon\s*europe|nepa\b|nigeria\s*electrification\s*project)/,
      // Generic
      /\bgrant[-\s]?funded\b|\bgovernment\s*grant\b|\bpublic\s*funding\b|\bgrant\s*from\b/,
    ];
    const subsidySignals = [
      /\bsubsid(y|ies|ised|ized)\b/,
      /\btariff\s*support\b/,
      /\bresult[-\s]based\s*financing\b|\brbf\b/,
      /\bfeed[-\s]in\s*tariff\b/,
      /\bcapex\s*grant\b|\bcapital\s*subsidy\b/,
    ];
    const hasPub = publicSignals.some((re) => re.test(t));
    const hasSub = subsidySignals.some((re) => re.test(t));
    if (!hasPub && !hasSub) return null;
    return {
      publicFunding: hasPub ? 'Yes' : null,
      subsidy: hasSub ? 'Yes' : null,
    };
  }

  private inferOffTaker(text: string | null | undefined): string | null {
    if (!text) return null;
    const t = text.toLowerCase();
    const cats: Array<{ key: string; re: RegExp; countRe: RegExp }> = [
      { key: 'School', re: /\bschool(s)?\b/, countRe: /(\d[\d,]*)\s*school/g },
      { key: 'Education', re: /\beducation\b/, countRe: /(\d[\d,]*)\s*education/g },
      { key: 'Health Facility', re: /\b(health\s+facilit(y|ies)|clinic(s)?|hospital(s)?)\b/, countRe: /(\d[\d,]*)\s*(health|clinic|hospital)/g },
      { key: 'Residential', re: /\b(resident(ial|s)?|household(s)?|home(s)?)\b/, countRe: /(\d[\d,]*)\s*(resident|household|home|user)/g },
      { key: 'Commercial', re: /\b(commercial|business(es)?|shop(s)?|merchant(s)?)\b/, countRe: /(\d[\d,]*)\s*(commercial|business|shop|merchant)/g },
      { key: 'Industrial', re: /\b(industrial|factor(y|ies)|industry)\b/, countRe: /(\d[\d,]*)\s*(industrial|factor|industry)/g },
      { key: 'Public Sector', re: /\bpublic sector\b|\bgovernment building/, countRe: /(\d[\d,]*)\s*public/g },
      { key: 'Agriculture', re: /\b(agricultur|farm(s|ing)?|irrigation)\b/, countRe: /(\d[\d,]*)\s*(farm|agricultur)/g },
      { key: 'Utility', re: /\butilit(y|ies)\b|\bdisco\b/, countRe: /(\d[\d,]*)\s*utilit/g },
      { key: 'Off-Grid Community', re: /\boff[\s-]?grid\s+communit(y|ies)\b/, countRe: /(\d[\d,]*)\s*off[\s-]?grid/g },
    ];

    // Pass 1: count-based ranking
    const counts: Array<{ key: string; n: number }> = [];
    for (const c of cats) {
      let total = 0;
      for (const m of t.matchAll(c.countRe)) {
        total += parseInt(m[1].replace(/,/g, ''), 10) || 0;
      }
      if (total > 0) counts.push({ key: c.key, n: total });
    }
    if (counts.length) {
      counts.sort((a, b) => b.n - a.n);
      return counts[0].key;
    }

    // Pass 2: presence fallback (no numbers in text)
    for (const c of cats) {
      if (c.re.test(t)) return c.key;
    }
    return null;
  }

  private inferDeviceDescription(text: string | null | undefined): string | null {
    if (!text) return null;
    const t = text.toLowerCase();
    // Check most-specific phrases first so "rooftop mini-grid" wins
    // for mini-grid (the topology) over "rooftop" (the mounting).
    if (/\bmini[\s-]?grid\b/.test(t)) return 'Mini Grid';
    if (/\bsolar home system\b|\bSHS\b/i.test(t)) return 'Solar Home System';
    if (/\bsolar lantern\b/.test(t)) return 'Solar Lantern';
    if (/\bground[\s-]?mount(ed)?\b|\bground[\s-]?based\b/.test(t))
      return 'Ground Mount Solar';
    if (/\brooftop\b|\broof[\s-]?mount(ed)?\b/.test(t)) return 'Rooftop Solar';
    return null;
  }

  private setupSiteNameWatcher(deviceGroup: FormGroup, index: number) {
    deviceGroup
      .get('siteName')
      ?.valueChanges.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((name: string) => {
          const trimmed = (name || '').trim();
          if (!trimmed || trimmed.length < 2) {
            this.siteNameExists[index] = false;
            return [];
          }
          // Edit-mode: don't flag the device's own current name as a
          // collision. The backend exclude-self logic is by-id; doing
          // it here too avoids the brief red flash on dialog open.
          if (this.isEditMode && trimmed === (this.initSiteName ?? '').trim()) {
            this.siteNameExists[index] = false;
            return [];
          }
          return this.deviceService.checkSiteName(trimmed);
        }),
      )
      .subscribe((res) => {
        this.siteNameExists[index] = res?.exists ?? false;
      });
  }

  private setupDataSourceWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const serialNumber = deviceGroup.get('serialNumber');
    const otherDataSource = deviceGroup.get('otherDataSource');

    dataSource?.valueChanges.subscribe((value) => {
      if (value === DataSourceTypes.Other) {
        otherDataSource?.setValidators([Validators.required]);
      } else {
        otherDataSource?.clearValidators();
        otherDataSource?.reset();
      }
      otherDataSource?.updateValueAndValidity();
    });
  }

  getSerialNumberLabel(_index: number): string {
    return '(14) Meter/Measurement ID(s)';
  }
  private setupdataSourceBrandWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const dataSourceBrand = deviceGroup.get('dataSourceBrand');

    dataSource?.valueChanges.subscribe(() => {
      dataSourceBrand?.updateValueAndValidity();
    });
  }

  dataSourceBrandLabel(index: number): string {
    const dataSource = this.deviceForms.at(index).get('dataSource')?.value;
    switch (dataSource) {
      case DataSourceTypes.Inverter:
        return 'Inverter Brand Name ⁽²⁷⁾';
      case DataSourceTypes.DataLogger:
        return 'Data Logger Brand Name ⁽²⁷⁾';
      case DataSourceTypes.Other:
        return 'Data source Brand Name ⁽²⁷⁾';
      default:
        return 'Data Source Brand Name ⁽²⁷⁾';
    }
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

  deleteDevice(i: number) {
    this.deviceForms.removeAt(i);
    // Shift serialNumberLists indices down so they stay aligned with the FormArray.
    const shifted: { [index: number]: string[] } = {};
    const entries = Object.entries(this.serialNumberLists);
    for (const [k, v] of entries) {
      const n = Number(k);
      if (n === i) continue;
      shifted[n > i ? n - 1 : n] = v;
    }
    this.serialNumberLists = shifted;
  }

  getSerialNumbers(deviceIndex: number): string[] {
    if (!this.serialNumberLists[deviceIndex]) {
      this.serialNumberLists[deviceIndex] = [''];
    }
    return this.serialNumberLists[deviceIndex];
  }

  private syncSerialNumberControl(deviceIndex: number): void {
    const joined = (this.serialNumberLists[deviceIndex] || [])
      .map((v) => (v || '').trim())
      .filter((v) => v !== '')
      .join(';');
    const ctrl = this.deviceForms.at(deviceIndex).get('serialNumber');
    if (!ctrl) return;
    ctrl.setValue(joined === '' ? null : joined);
    ctrl.markAsDirty();
  }

  setSerialNumber(deviceIndex: number, rowIndex: number, value: string): void {
    // Strip ALL whitespace — copy/paste from a portal usually drags
    // along trailing spaces or newlines, and the backend
    // serialNumberRegex /^[a-zA-Z0-9_;-]+$/ rejects them. Don't
    // make the user re-type because of an invisible character.
    const cleaned = (value ?? '').replace(/\s+/g, '');
    const list = this.getSerialNumbers(deviceIndex);
    list[rowIndex] = cleaned;
    this.syncSerialNumberControl(deviceIndex);
  }

  addSerialNumber(deviceIndex: number): void {
    this.getSerialNumbers(deviceIndex).push('');
    // Move focus to the newly-added input after Angular renders it
    setTimeout(() => {
      const lists = document.querySelectorAll('.serial-list');
      const list = lists[deviceIndex];
      const inputs = list?.querySelectorAll<HTMLInputElement>('input');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 0);
  }

  /** Serial-number values the user has explicitly removed. Keyed
   *  by device index → lowercased value set. Used by
   *  applyMeterIdsExtraction so the same spurious OCR result
   *  doesn't reappear after the user deletes it. Persisted to
   *  localStorage keyed by deviceId so it survives reloads + re-
   *  uploads (the original phantom-serial bug). */
  private dismissedSerialNumbers: { [deviceIndex: number]: Set<string> } = {};

  /** localStorage key for a device's dismissed-serials list. Uses
   *  the persisted deviceId when known, or a synthetic
   *  "draft:<index>" key for unsaved devices being added fresh. */
  private dismissedSerialsKey(deviceIndex: number): string {
    // Prefer the persisted deviceId for stable persistence across
    // sessions; the URL externalId is the human-readable fallback.
    const id =
      (this as any).editingDeviceId ??
      this.editingExternalId ??
      `draft:${deviceIndex}`;
    return `drec.dismissedSerials.${id}`;
  }
  /** Hydrate dismissedSerialNumbers[deviceIndex] from localStorage. */
  private loadDismissedSerials(deviceIndex: number): void {
    try {
      const raw = localStorage.getItem(this.dismissedSerialsKey(deviceIndex));
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        this.dismissedSerialNumbers[deviceIndex] = new Set(
          arr.map((s) => String(s).toLowerCase()),
        );
      }
    } catch {}
  }
  /** Persist dismissedSerialNumbers[deviceIndex] to localStorage. */
  private saveDismissedSerials(deviceIndex: number): void {
    try {
      const set = this.dismissedSerialNumbers[deviceIndex];
      if (!set || !set.size) {
        localStorage.removeItem(this.dismissedSerialsKey(deviceIndex));
        return;
      }
      localStorage.setItem(
        this.dismissedSerialsKey(deviceIndex),
        JSON.stringify([...set]),
      );
    } catch {}
  }
  /** Generic per-(field, value) blacklist. Mirrors dismissedSerial-
   *  Numbers but for any field — the user declining or removing a
   *  value anywhere writes to this set, and every extractor /
   *  verify-queue / conflict-picker path consults it before showing
   *  the value again. Persisted to localStorage by device so a
   *  blacklisted value stays blacklisted across reloads. */
  private dismissedFieldValues: {
    [deviceIndex: number]: { [field: string]: Set<string> };
  } = {};

  private dismissedFieldValuesKey(deviceIndex: number): string {
    const id =
      (this as any).editingDeviceId ??
      this.editingExternalId ??
      `draft:${deviceIndex}`;
    return `drec.dismissedFieldValues.${id}`;
  }
  private loadDismissedFieldValues(deviceIndex: number): void {
    try {
      const raw = localStorage.getItem(this.dismissedFieldValuesKey(deviceIndex));
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        const out: { [field: string]: Set<string> } = {};
        for (const k of Object.keys(obj)) {
          if (Array.isArray(obj[k])) {
            out[k] = new Set(obj[k].map((v: any) => String(v).toLowerCase()));
          }
        }
        this.dismissedFieldValues[deviceIndex] = out;
      }
    } catch {}
  }
  private saveDismissedFieldValues(deviceIndex: number): void {
    try {
      const m = this.dismissedFieldValues[deviceIndex];
      if (!m || !Object.keys(m).length) {
        localStorage.removeItem(this.dismissedFieldValuesKey(deviceIndex));
        return;
      }
      const obj: Record<string, string[]> = {};
      for (const k of Object.keys(m)) obj[k] = [...m[k]];
      localStorage.setItem(this.dismissedFieldValuesKey(deviceIndex), JSON.stringify(obj));
    } catch {}
  }
  /** Mark a (field, value) pair as blacklisted and persist. Routes
   *  serialNumber:* through the dedicated serial path so the chip-
   *  list filter logic keeps working. */
  private dismissFieldValue(deviceIndex: number, field: string, value: any): void {
    if (value == null || value === '') return;
    const v = String(value).trim();
    if (!v) return;
    if (field === 'serialNumber' || field.startsWith('meterId:')) {
      this.dismissSerial(deviceIndex, v);
      return;
    }
    if (!this.dismissedFieldValues[deviceIndex]) this.dismissedFieldValues[deviceIndex] = {};
    if (!this.dismissedFieldValues[deviceIndex][field]) this.dismissedFieldValues[deviceIndex][field] = new Set();
    this.dismissedFieldValues[deviceIndex][field].add(v.toLowerCase());
    this.saveDismissedFieldValues(deviceIndex);
  }
  /** Check if a (field, value) is blacklisted. */
  private isDismissed(deviceIndex: number, field: string, value: any): boolean {
    if (value == null || value === '') return false;
    if (field === 'serialNumber' || field.startsWith('meterId:')) {
      const set = this.dismissedSerialNumbers[deviceIndex];
      return !!set && set.has(String(value).trim().toLowerCase());
    }
    const set = this.dismissedFieldValues[deviceIndex]?.[field];
    return !!set && set.has(String(value).trim().toLowerCase());
  }

  /** Mark a serial as dismissed for this device + persist. Central
   *  helper so every dismiss path (chip-remove, verifyDecline,
   *  applyMeterIdsExtraction unchecked) goes through one funnel. */
  private dismissSerial(deviceIndex: number, value: string): void {
    const v = (value || '').trim().toLowerCase();
    if (!v) return;
    if (!this.dismissedSerialNumbers[deviceIndex]) {
      this.dismissedSerialNumbers[deviceIndex] = new Set();
    }
    this.dismissedSerialNumbers[deviceIndex].add(v);
    this.saveDismissedSerials(deviceIndex);
    // Belt-and-braces: also strip from the extractor's pending list
    // so the banner / queue / future Apply can't bring it back.
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    this.meterIdsExtractions[deviceIndex] = ids.filter(
      (id) => id.trim().toLowerCase() !== v,
    );
  }

  removeSerialNumber(deviceIndex: number, rowIndex: number): void {
    const list = this.getSerialNumbers(deviceIndex);
    const removed = (list[rowIndex] || '').trim();
    if (removed) this.dismissSerial(deviceIndex, removed);
    if (list.length <= 1) {
      list[0] = '';
    } else {
      list.splice(rowIndex, 1);
    }
    this.syncSerialNumberControl(deviceIndex);
  }

  trackByIndex(i: number) {
    return i;
  }

  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCodename') as FormControl;
  }

  checkDocumentsUploaded() {
    // Edit-mode aware: a slot counts as filled if either a new file
    // is staged in `this.files` OR a server-saved doc is already
    // attached (existingDocs).
    const allDocsUploaded = this.deviceForms.controls.every(
      (group, deviceIndex) => {
        return this.requiredFileTypes.every((fileType) => {
          if (
            fileType === DocumentType.FORM_SF_02 &&
            group.get('sf02EvidenceMode')?.value === 'self'
          ) {
            return true;
          }
          const staged =
            (this.files[deviceIndex]?.[fileType]?.length ?? 0) > 0;
          if (staged) return true;
          const existing = this.existingDocs[deviceIndex]?.[fileType];
          return Array.isArray(existing) && existing.length > 0;
        });
      },
    );

    this.allDocumentsUploaded = allDocsUploaded;
    // Partial submit allowed: docs just influence the warning banner, not formValid
    this.formValid = this.myform.valid;
  }

  /** Check if a file with the same name already exists in any slot for this device. */
  private isDuplicate(deviceIndex: number, file: File): boolean {
    return this.duplicateMatch(deviceIndex, file) !== null;
  }
  /** Returns the slot key where this file is already staged or
   *  already saved on the server, or null. Filename match is enough
   *  on the server side (we don't have the size of an existing-doc
   *  without re-fetching). */
  private duplicateMatch(deviceIndex: number, file: File): string | null {
    const deviceFiles = this.files[deviceIndex];
    if (deviceFiles) {
      for (const [slot, list] of Object.entries(deviceFiles)) {
        if (list?.some((f: File) => f.name === file.name && f.size === file.size)) {
          return slot;
        }
      }
    }
    const existing = this.existingDocs[deviceIndex];
    if (existing) {
      for (const [slot, docs] of Object.entries(existing)) {
        if ((docs as any[])?.some((d) => (d.name || '') === file.name)) {
          return `${slot} (already saved)`;
        }
      }
    }
    return null;
  }

  onFileChange(event: Event, deviceIndex: number, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files: FileList = input.files;

    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }

    const multiTypes: string[] = [
      'PROJECT_PHOTOS',
      'METERING_EVIDENCE',
      'OTHER_DOCUMENTS',
    ];
    const skippedNames: string[] = [];
    const newFiles: File[] = [];
    for (const f of Array.from(files)) {
      const where = this.duplicateMatch(deviceIndex, f);
      if (where) skippedNames.push(`${f.name} (already in ${where})`);
      else newFiles.push(f);
    }
    if (skippedNames.length) {
      this.toastrService.info(
        `Skipped: ${skippedNames.join('; ')}`,
        'Files can only live in one slot',
      );
    }
    if (newFiles.length === 0) return;

    const prevLen = (this.files[deviceIndex][fileType] || []).length;
    if (multiTypes.includes(fileType)) {
      this.files[deviceIndex][fileType] = [
        ...(this.files[deviceIndex][fileType] || []),
        ...newFiles,
      ];
    } else {
      this.files[deviceIndex][fileType] = newFiles;
    }
    // Keep fileLabels aligned with files[] length per type.
    if (!this.fileLabels[deviceIndex]) this.fileLabels[deviceIndex] = {};
    const newLen = this.files[deviceIndex][fileType].length;
    if (multiTypes.includes(fileType)) {
      const existing = this.fileLabels[deviceIndex][fileType] || [];
      const appended = Array(newLen - prevLen).fill('');
      this.fileLabels[deviceIndex][fileType] = [...existing, ...appended];
    } else {
      this.fileLabels[deviceIndex][fileType] = Array(newLen).fill('');
    }

    const fileControl = this.deviceForms.at(deviceIndex).get(fileType);
    if (fileControl) {
      fileControl.setValue(
        this.files[deviceIndex][fileType][0] ?? input.files[0],
      );
      fileControl.markAsDirty();
    }

    // Generate preview
    const file = input.files[0];
    if (!this.filePreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = {};
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[deviceIndex][fileType] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
      name: file.name,
    };

    this.checkDocumentsUploaded();

    // Trigger background AI classification
    this.classifyUploadedFile(input.files[0], deviceIndex, fileType);

    // For SLDs, also trigger field extraction (vision via Haiku)
    if (fileType === DocumentType.SINGLE_LINE_DIAGRAM) {
      this.extractSldFieldsForDevice(input.files[0], deviceIndex);
    }
    // For SF-02c letters, extract owner / address / signing date
    if (fileType === DocumentType.SF_02C) {
      this.extractSf02cFieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.COD_PROOF) {
      this.extractCodFieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.FORM_SF_02) {
      this.extractSf02FieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.METERING_EVIDENCE) {
      // Each metering screenshot is a separate inverter most of the
      // time — extract from every newly-added file.
      for (const f of newFiles) {
        this.extractMeterIdsForDevice(f, deviceIndex);
        // Pile the source-access-mode classifier on the same files —
        // it reads the doc's *shape* (portal vs API vs CSV) to suggest
        // the mode, independent of the meter-ID extraction above.
        this.classifySourceAccessModeForDevice(f, deviceIndex);
      }
      this.autoSetMeterReadsShareable(deviceIndex);
    }
  }

  /**
   * Replay the appropriate extractor against every server-saved doc
   * so the in-memory extraction state is populated for provenance
   * generation. Each doc's content hash is the cache key — repeats
   * are O(1) lookups on the API side.
   */
  private replayExtractorsOnExistingDocs(
    deviceIndex: number,
    docsByType: { [type: string]: Array<{ id: number; name: string }> },
  ): void {
    const fetchAsFile = async (
      docId: number,
      filename: string,
    ): Promise<File> => {
      const resp = await fetch(
        `${environment.API_URL}document-uploads/${docId}/url`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access-token') ?? ''}`,
          },
        },
      );
      const blob = await resp.blob();
      return new File([blob], filename, { type: blob.type });
    };
    const oneOf = async (
      type: string,
      run: (file: File) => void,
    ): Promise<void> => {
      const docs = docsByType[type];
      if (!docs?.length) return;
      const file = await fetchAsFile(docs[0].id, docs[0].name);
      run(file);
    };
    void oneOf(DocumentType.SINGLE_LINE_DIAGRAM, (f) =>
      this.extractSldFieldsForDevice(f, deviceIndex),
    );
    void oneOf(DocumentType.SF_02C, (f) =>
      this.extractSf02cFieldsForDevice(f, deviceIndex),
    );
    void oneOf(DocumentType.COD_PROOF, (f) =>
      this.extractCodFieldsForDevice(f, deviceIndex),
    );
    // SF-02 is platform-generated when sf02EvidenceMode === 'self'
    // — extracting from it would just round-trip our own form values
    // back onto the provenance report (circular). Only treat
    // SF-02 as a source when the registrant uploaded their own.
    const sf02Mode = this.deviceForms
      .at(deviceIndex)
      ?.get('sf02EvidenceMode')?.value;
    if (sf02Mode === 'upload') {
      void oneOf(DocumentType.FORM_SF_02, (f) =>
        this.extractSf02FieldsForDevice(f, deviceIndex),
      );
    }
    // Metering evidence: one extraction per file. The source-access-mode
    // classifier runs on the same files; both calls use the response
    // cache so re-replaying on edit-page load is cheap.
    const meterDocs = docsByType[DocumentType.METERING_EVIDENCE] ?? [];
    for (const d of meterDocs) {
      void fetchAsFile(d.id, d.name).then((f) => {
        this.extractMeterIdsForDevice(f, deviceIndex);
        this.classifySourceAccessModeForDevice(f, deviceIndex);
      });
    }
  }

  /** Default (20) Meter reads shareable via document? to "Yes" once
   *  any METERING_EVIDENCE doc is staged or already saved — those
   *  uploads ARE the shareable document. Only patches when empty so
   *  a deliberate "No" survives. */
  private autoSetMeterReadsShareable(deviceIndex: number): void {
    const ctl = this.deviceForms.at(deviceIndex)?.get('meterReadsShareable');
    if (!ctl || ctl.value) return;
    const staged =
      (this.files[deviceIndex]?.[DocumentType.METERING_EVIDENCE]?.length ?? 0) > 0;
    const existing =
      (this.existingDocs[deviceIndex]?.['METERING_EVIDENCE']?.length ?? 0) > 0;
    if (!staged && !existing) return;
    ctl.setValue('Yes');
    ctl.markAsDirty();
    this.recordInference(
      deviceIndex,
      'meterReadsShareable',
      'Metering-evidence files attached',
      'Yes',
    );
  }

  /** Magic auto-sort: classify multiple files and dispatch them to slots. */
  onMagicUpload(event: Event, deviceIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const filesToProcess = Array.from(input.files);
    input.value = ''; // reset so same files can be re-selected

    this.magicRunning[deviceIndex] = true;
    this.magicDone[deviceIndex] = 0;
    this.magicTotal[deviceIndex] = filesToProcess.length;
    this.magicLog[deviceIndex] = [];

    // Backup current state for cancel
    if (this.files[deviceIndex]) {
      const backup: any = {};
      for (const key of Object.keys(this.files[deviceIndex])) {
        backup[key] = [...(this.files[deviceIndex] as any)[key]];
      }
      this.magicBackupFiles[deviceIndex] = backup;
    } else {
      this.magicBackupFiles[deviceIndex] = {} as any;
    }
    this.magicBackupPreviews[deviceIndex] = this.filePreviews[deviceIndex]
      ? { ...this.filePreviews[deviceIndex] }
      : ({} as any);

    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }

    const processNext = (idx: number) => {
      if (idx >= filesToProcess.length) {
        this.ngZone.run(() => {
          this.magicRunning[deviceIndex] = false;
          this.magicCurrentFile[deviceIndex] = null;
          this.magicCurrentStep[deviceIndex] = null;
          this.checkDocumentsUploaded();
        });
        return;
      }

      const file = filesToProcess[idx];
      this.ngZone.run(() => {
        this.magicCurrentFile[deviceIndex] = file.name;
        this.magicCurrentStep[deviceIndex] = null;
      });
      if (this.isDuplicate(deviceIndex, file)) {
        // Don't burn an AI roundtrip on a file we already have. The
        // old code classified duplicates "just in case the OK +
        // Extract path needs it" — but that path can re-classify on
        // demand at zero user-perceived cost. Skipping the classify
        // call here is what makes drag-drop of 50 photos feel fast:
        // the bar jumps to 100% as soon as the filename+size match
        // hits, instead of grinding through 3-5s of Anthropic latency
        // per duplicate.
        this.ngZone.run(() => {
          this.magicLog[deviceIndex].push({
            filename: file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name,
            target: 'Skipped (duplicate)',
            confidence: null,
            type: 'skip',
            file,
          });
          this.magicDone[deviceIndex] = idx + 1;
        });
        setTimeout(() => processNext(idx + 1));
        return;
      }
      this.documentClassifier.classify(file, (step) =>
        this.ngZone.run(() => {
          this.magicCurrentStep[deviceIndex] = step;
        }),
      ).subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            const rawType = result?.suggestedType ?? DocumentType.OTHER_DOCUMENTS;
            // FACILITY_BOUNDARY has no registrant-side upload slot today,
            // so drop the boundary file into PROJECT_PHOTOS where it can
            // still be reviewed. Magic-table label below still shows
            // "Facility Boundary" so the reviewer knows what it is.
            const targetType =
              rawType === DocumentType.FACILITY_BOUNDARY
                ? DocumentType.PROJECT_PHOTOS
                : rawType;
            const label =
              this.DOCUMENT_TYPE_LABELS[rawType] ?? 'Other Document';
            const confidence = result
              ? Math.round(result.confidence * 100)
              : null;

            // Place file in the target slot
            const multiTypes = [
              'PROJECT_PHOTOS',
              'METERING_EVIDENCE',
              'OTHER_DOCUMENTS',
            ];
            if (multiTypes.includes(targetType)) {
              this.files[deviceIndex][targetType as FileType] = [
                ...(this.files[deviceIndex][targetType as FileType] || []),
                file,
              ];
            } else {
              this.files[deviceIndex][targetType as FileType] = [file];
            }

            // Keep fileLabels aligned
            if (!this.fileLabels[deviceIndex])
              this.fileLabels[deviceIndex] = {};
            const len =
              this.files[deviceIndex][targetType as FileType].length;
            this.fileLabels[deviceIndex][targetType] = Array(len).fill('');

            // Set form control
            const control = this.deviceForms
              .at(deviceIndex)
              .get(targetType);
            if (control) {
              control.setValue(
                this.files[deviceIndex][targetType as FileType][0] ?? null,
              );
              control.markAsDirty();
            }

            // Generate preview
            if (!this.filePreviews[deviceIndex])
              this.filePreviews[deviceIndex] = {};
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isExcel = /\.(xlsx|xls)$/i.test(file.name);
            const objectUrl = URL.createObjectURL(file);
            this.filePreviews[deviceIndex][targetType] = {
              url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
              type: isImage
                ? 'image'
                : isPdf
                  ? 'pdf'
                  : isExcel
                    ? 'excel'
                    : 'other',
              name: file.name,
            };

            // Log entry
            this.magicLog[deviceIndex].push({
              filename: file.name.length > 40
                ? file.name.substring(0, 37) + '...'
                : file.name,
              target: label,
              confidence,
              type: result && result.suggestedType !== DocumentType.OTHER_DOCUMENTS
                ? 'hit'
                : 'other',
              file,
              docType: rawType,
            });

            this.magicDone[deviceIndex] = idx + 1;
            processNext(idx + 1);
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.magicLog[deviceIndex].push({
              filename: file.name.length > 40
                ? file.name.substring(0, 37) + '...'
                : file.name,
              target: 'Other Document',
              confidence: null,
              type: 'miss',
              file,
            });

            // Put in OTHER_DOCUMENTS on error
            this.files[deviceIndex][DocumentType.OTHER_DOCUMENTS] = [
              ...(this.files[deviceIndex][DocumentType.OTHER_DOCUMENTS] ||
                []),
              file,
            ];

            this.magicDone[deviceIndex] = idx + 1;
            processNext(idx + 1);
          });
        },
      });
    };

    processNext(0);
  }

  /** Run AI classification on an uploaded file and store the suggestion. */
  private extractSldFieldsForDevice(file: File, deviceIndex: number): void {
    this.sldExtracting[deviceIndex] = true;
    this.sldExtractions[deviceIndex] = null;
    this.sldExtractionDoc[deviceIndex] = { name: file.name };
    if (this.extractionApplied[deviceIndex]) {
      this.extractionApplied[deviceIndex]['SLD'] = false;
    }
    this.documentClassifier
      .extractSldFields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sldExtracting[deviceIndex] = false;
          this.sldExtractions[deviceIndex] = res;
          // Extraction is silent. The user opens the verify queue
          // explicitly via the per-doc "Verify" button so multiple
          // extractors finishing in parallel don't chaotically pop
          // dialogs over each other.
          this.sldExtractionFile[deviceIndex] = file;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sldExtracting[deviceIndex] = false;
        }),
      );
  }

  /** Verify-Source queue state — populated when an SLD extraction
   *  completes. The queue is one entry per field the model returned,
   *  walked one at a time in the dialog with OK/Decline. */
  verifyQueue: Array<{
    deviceIndex: number;
    field: string;          // form control name
    label: string;          // human label for the field
    source: string;         // 'SLD' for now; Phase 2 adds others
    value: any;             // candidate value from extractor
    confidence: number;
    region?: { page: number; x: number; y: number; w: number; h: number };
    /** 'tesseract' = pixel-exact, OCR token matched the value;
     *  'model'     = Haiku's bbox estimate (derived value, no literal
     *                string to match). Used by the dialog to show
     *                solid-red vs dashed-amber and an approximate-
     *                location banner. */
    regionSource?: 'tesseract' | 'model';
    /** Per-field justification from the extractor — what in the doc
     *  the model used to decide this value. Useful when the bbox is
     *  approximate. */
    reasoning?: string;
    transform?: (v: any) => any;
    /** Per-item File override — used by the meter-IDs queue where
     *  different serials came from different uploads. When set, the
     *  dialog renders this file instead of verifyQueueFile. */
    fileOverride?: File;
  }> = [];
  verifyQueueIndex = 0;
  verifyQueueFile: File | null = null;
  @ViewChild('verifySourceDialog') verifySourceDialog?: TemplateRef<any>;
  @ViewChild('verifyCanvas') verifyCanvasEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('verifyZoomEl', { read: ImageZoomPanDirective }) verifyZoomDirective?: ImageZoomPanDirective;

  verifyZoomIn(): void { this.verifyZoomDirective?.zoomIn(); }
  verifyZoomOut(): void { this.verifyZoomDirective?.zoomOut(); }
  verifyZoomReset(): void { this.verifyZoomDirective?.reset(); }
  private verifySourceDialogRef: MatDialogRef<any> | null = null;

  /** Resolved CSS size of the rendered verify canvas — needed so the
   *  overlay div above it can position its highlight bbox in screen
   *  pixels (the region coords are normalised 0..1). */
  verifyCanvasSize: { cssWidth: number; cssHeight: number } | null = null;

  /** Currently-displayed page in the verify dialog. Starts at the
   *  model-reported region.page (or 1) and the user can flip with
   *  Prev/Next for multi-page docs where the bbox is missing. */
  verifyCurrentPage = 1;
  /** Total pages in the verify dialog's loaded doc, for the page
   *  indicator and Next button disable. 1 for non-PDF images. */
  verifyPageCount = 1;
  @ViewChild('ocWalkZoomEl', { read: ImageZoomPanDirective }) ocWalkZoomDirective?: ImageZoomPanDirective;
  ocWalkZoomIn(): void { this.ocWalkZoomDirective?.zoomIn(); }
  ocWalkZoomOut(): void { this.ocWalkZoomDirective?.zoomOut(); }
  ocWalkZoomReset(): void { this.ocWalkZoomDirective?.reset(); }

  /** OC# walk current PDF page state (Prev/Next nav). */
  ocWalkCurrentPage = 1;
  ocWalkPageCount = 1;
  ocWalkPrevPage(): void {
    if (this.ocWalkCurrentPage <= 1) return;
    this.ocWalkCurrentPage--;
    this.renderOcWalkSource();
  }
  ocWalkNextPage(): void {
    if (this.ocWalkCurrentPage >= this.ocWalkPageCount) return;
    this.ocWalkCurrentPage++;
    this.renderOcWalkSource();
  }
  ocWalkGoToPage(p: number): void {
    if (p < 1 || p > this.ocWalkPageCount) return;
    this.ocWalkCurrentPage = p;
    this.renderOcWalkSource();
  }

  /** Per-page occurrence count of the current item's value, derived
   *  from pdf.js text-content. Index 0 unused; pages are 1-based to
   *  match pdf.js. Lets the UI show "page 3 of 30 · 2 matches" and
   *  hint which page to flip to. */
  verifyMatchesByPage: number[] = [];
  /** Match rects on the CURRENT page only, normalised 0..1 against
   *  the rendered canvas. Drawn as yellow translucent overlays. */
  verifyTextMatches: Array<{ x: number; y: number; w: number; h: number }> = [];

  /** Map a verify-source key to the docType + extractor entry point
   *  used by reverifyFromAttached. */
  private readonly REVERIFY_SOURCES: {
    [k: string]: {
      docType: string;
      label: string;
      flagKey: 'sldExtracting' | 'sf02cExtracting' | 'codExtracting' | 'sf02Extracting';
      extract: (file: File, deviceIndex: number) => void;
    };
  } = {
    'SLD':    { docType: 'SINGLE_LINE_DIAGRAM', label: 'SLD',     flagKey: 'sldExtracting',   extract: (f, i) => this.extractSldFieldsForDevice(f, i) },
    'SF-02c': { docType: 'SF_02C',              label: 'SF-02c',  flagKey: 'sf02cExtracting', extract: (f, i) => this.extractSf02cFieldsForDevice(f, i) },
    'COD':    { docType: 'COD_PROOF',           label: 'COD proof', flagKey: 'codExtracting', extract: (f, i) => this.extractCodFieldsForDevice(f, i) },
    'SF-02':  { docType: 'FORM_SF_02',          label: 'SF-02',   flagKey: 'sf02Extracting',  extract: (f, i) => this.extractSf02FieldsForDevice(f, i) },
  };

  /** Re-run a given extractor against the device's attached doc of the
   *  matching type and route through the verify-source queue. Use when
   *  values were applied before strict verification was wired (no
   *  verifiedBy on the saved provenance) and the registrant wants to
   *  attest each value against the source. Generic over all four
   *  extractors. */
  reverifyFromAttached(deviceIndex: number, source: 'SLD' | 'SF-02c' | 'COD' | 'SF-02'): void {
    const cfg = this.REVERIFY_SOURCES[source];
    const docs = this.existingDocs[deviceIndex]?.[cfg.docType] ?? [];
    if (!docs.length) {
      this.toastrService.info(`No ${cfg.label} attached to re-verify against.`);
      return;
    }
    const doc = docs[0];
    (this as any)[cfg.flagKey][deviceIndex] = true;
    this.fetchAttachedDocAsFile(doc)
      .then((file) => cfg.extract(file, deviceIndex))
      .catch((err) => {
        (this as any)[cfg.flagKey][deviceIndex] = false;
        this.toastrService.error(
          `Failed to fetch ${doc.name}: ${err?.message ?? err}`,
        );
      });
  }

  /** Back-compat shim — kept because the template calls this by name
   *  on the (45) SLD panel. Delegates to the generic method. */
  reverifySldFromAttached(deviceIndex: number): void {
    this.reverifyFromAttached(deviceIndex, 'SLD');
  }

  /** Count of fields from a given extractor that the registrant
   *  hasn't yet verified-or-declined. Used by the per-doc "Verify"
   *  button to show "Verify (N)" and to hide it when zero. Mirrors
   *  the skip logic in openVerifyQueue: skip when saved provenance
   *  already carries verifiedBy. */
  pendingVerifyCount(deviceIndex: number, source: 'SLD' | 'SF-02c' | 'COD' | 'SF-02'): number {
    const specs = this.buildVerifySpecs(deviceIndex, source);
    if (!specs.length) return 0;
    let n = 0;
    for (const s of specs) {
      const field = s.field;
      if (!field || field.value == null) continue;
      const prov = this.appliedProvenance[deviceIndex]?.[s.name];
      if (prov && (prov as any).verifiedBy) continue;
      const next = s.transform ? s.transform(field.value) : field.value;
      if (this.isDismissed(deviceIndex, s.name, next)) continue;
      n++;
    }
    return n;
  }

  /** Build the field-spec list for a given extractor. Shared by both
   *  the queue opener and the pending-count getter so the two stay in
   *  lockstep. */
  private buildVerifySpecs(
    deviceIndex: number,
    source: 'SLD' | 'SF-02c' | 'COD' | 'SF-02',
  ): Array<{ name: string; label: string; field: any; transform?: (v: any) => any }> {
    if (source === 'SLD') {
      const fx = this.sldExtractions[deviceIndex];
      if (!fx) return [];
      return [
        { name: 'capacity', label: '(9) Total AC capacity', field: fx.acCapacityKw },
        { name: 'generatingUnitCount', label: '(13) Number of generating units', field: fx.inverterCount },
        { name: 'interconnectionVoltage', label: '(18) Interconnection voltage', field: fx.gridVoltage },
        { name: 'gridInterconnection', label: '(15) Grid-connected?', field: fx.gridTied, transform: (v) => !!v },
        { name: 'dataSourceBrand', label: '(27) Data Source Brand', field: fx.inverterMakeModel },
        { name: 'networkOwner', label: '(17) Network owner', field: fx.networkOwner },
        { name: 'hasNetworkMeter', label: '(19) Network meter installed?', field: fx.hasNetworkMeter, transform: (v) => (v ? 'Yes' : 'No') },
        { name: 'gridExportType', label: '(16) Exports to grid?', field: fx.gridExportType },
        { name: 'hasAuxiliaryEnergySources', label: '(24) Auxiliary energy sources?', field: fx.hasAuxiliaryEnergySources, transform: (v) => (v ? 'Yes' : 'No') },
        { name: 'auxiliaryEnergySourceDetails', label: '(25) Aux source details', field: fx.auxiliaryEnergySourceDetails },
        { name: 'hasCaptiveConsumer', label: '(23) Captive consumer present?', field: fx.hasCaptiveConsumer, transform: (v) => (v ? 'Yes' : 'No') },
      ];
    }
    if (source === 'SF-02c') {
      const fx = this.sf02cExtractions[deviceIndex];
      if (!fx) return [];
      return [
        { name: 'siteName', label: '(7) Site name', field: fx.projectName },
        { name: 'pvSystemOwner', label: '(27) PV System Owner', field: fx.ownerLegalName },
        { name: 'pvSystemOwnerAddress', label: 'PV System Owner address', field: fx.ownerAddress },
        { name: 'countryCodename', label: 'Country', field: fx.ownerCountry, transform: (v) => this.normalizeCountry(v) },
        { name: 'signatoryName', label: 'Signatory name', field: fx.signatoryName },
      ];
    }
    if (source === 'COD') {
      const fx = this.codExtractions[deviceIndex];
      if (!fx) return [];
      return [
        { name: 'commissioningDate', label: '(10) Commissioning date', field: fx.commissioningDate },
        { name: 'siteName', label: '(7) Site name', field: fx.facilityName },
        { name: 'capacity', label: '(9) Total AC capacity', field: fx.acCapacityKw },
        { name: 'pvSystemOwner', label: '(27) PV System Owner', field: fx.ownerName },
        { name: 'countryCodename', label: 'Country', field: fx.country, transform: (v) => this.normalizeCountry(v) },
        { name: 'offTakerName', label: '(28) Off-taker name', field: fx.offTakerName },
      ];
    }
    if (source === 'SF-02') {
      const fx = this.sf02Extractions[deviceIndex];
      if (!fx) return [];
      return [
        { name: 'siteName', label: '(7) Site name', field: fx.facilityName },
        { name: 'capacity', label: '(9) Total AC capacity', field: fx.acCapacityKw },
        { name: 'commissioningDate', label: '(10) Commissioning date', field: fx.commissioningDate },
        { name: 'deviceTypeCode', label: 'Device type code', field: fx.deviceTypeCode },
        { name: 'pvSystemOwner', label: '(27) PV System Owner', field: fx.ownerLegalName },
        { name: 'pvSystemOwnerAddress', label: 'PV System Owner address', field: fx.ownerAddress },
        { name: 'countryCodename', label: 'Country', field: fx.ownerCountry, transform: (v) => this.normalizeCountry(v) },
        { name: 'latitude', label: 'Latitude', field: fx.latitude },
        { name: 'longitude', label: 'Longitude', field: fx.longitude },
        { name: 'generatingUnitCount', label: '(13) Number of generating units', field: fx.inverterCount },
        { name: 'networkOwner', label: '(17) Network owner', field: fx.networkOwner },
      ];
    }
    return [];
  }

  /** Open the verify queue for any of the four extractors using the
   *  most-recently-cached file. Template entry point for the per-doc
   *  "Verify (N)" button. */
  openVerifyForSource(
    deviceIndex: number,
    source: 'SLD' | 'SF-02c' | 'COD' | 'SF-02',
  ): void {
    const fileMap = {
      'SLD': this.sldExtractionFile,
      'SF-02c': this.sf02cExtractionFile,
      'COD': this.codExtractionFile,
      'SF-02': this.sf02ExtractionFile,
    } as const;
    const file = fileMap[source][deviceIndex];
    if (!file) {
      // No cached file (existing device loaded from server). Fetch
      // the attached doc + re-run the extractor; the verify queue
      // will open as part of the extraction completion path.
      return this.reverifyFromAttached(deviceIndex, source);
    }
    this.openVerifyQueue(deviceIndex, file, source, this.buildVerifySpecs(deviceIndex, source));
  }

  /** Generic verify-source queue opener. Builds queue items from a
   *  list of {name, label, field, transform?} specs and opens the
   *  dialog. Shared by SLD / SF-02c / COD / SF-02 paths. */
  private openVerifyQueue(
    deviceIndex: number,
    file: File,
    source: string,
    specs: Array<{
      name: string;
      label: string;
      field:
        | {
            value: any;
            confidence: number;
            region?: any;
            regionSource?: any;
            reasoning?: string;
          }
        | undefined
        | null;
      transform?: (v: any) => any;
    }>,
  ): void {
    const items: typeof this.verifyQueue = [];
    for (const s of specs) {
      const field = s.field;
      if (!field || field.value == null) continue;
      // Strict: skip only when saved provenance ALREADY has a
      // verifiedBy stamp for this field. Value matching the form by
      // accident still needs a human attestation.
      const prov = this.appliedProvenance[deviceIndex]?.[s.name];
      if (prov && (prov as any).verifiedBy) continue;
      const next = s.transform ? s.transform(field.value) : field.value;
      // Blacklist check: a (field, value) the user explicitly
      // declined in any prior session must not re-appear in the
      // queue. Persistent dismiss is the user's final word.
      if (this.isDismissed(deviceIndex, s.name, next)) continue;
      items.push({
        deviceIndex,
        field: s.name,
        label: AddDevicesComponent.FIELD_LABELS[s.name] ?? s.label,
        source,
        value: next,
        confidence: field.confidence,
        region: field.region,
        regionSource: field.regionSource,
        reasoning: field.reasoning,
        transform: s.transform,
      });
    }
    if (!items.length) {
      this.toastrService.info(
        `${source} extracted: every field already matches the form. Nothing to verify.`,
      );
      return;
    }
    this.verifyQueue = items;
    this.verifyQueueIndex = 0;
    this.verifyQueueFile = file;
    if (!this.verifySourceDialog) return;
    // Don't stack: close any existing dialog before opening a fresh
    // one. Re-verify fired mid-queue should not pile dialogs up.
    if (this.verifySourceDialogRef) {
      this.verifySourceDialogRef.close();
      this.verifySourceDialogRef = null;
    }
    this.verifySourceDialogRef = this.dialog.open(
      this.verifySourceDialog,
      {
        width: '900px',
        maxWidth: '95vw',
        disableClose: false,
        panelClass: 'drec-floating-dialog',
      },
    );
    setTimeout(() => this.renderVerifyCanvas({ resetToItemPage: true }), 50);
  }

  /** Open the verify-source queue for an SLD extraction. Kept for
   *  reverifySldFromAttached + any external callers; new code should
   *  prefer openVerifyForSource(deviceIndex, 'SLD'). */
  openSldVerifyQueue(deviceIndex: number, file: File): void {
    this.openVerifyQueue(deviceIndex, file, 'SLD', this.buildVerifySpecs(deviceIndex, 'SLD'));
  }

  /** Count of extracted meter IDs that haven't been per-ID verified
   *  yet. Drives the "Verify (N)" button in the meter IDs banner. */
  pendingMeterIdsVerifyCount(deviceIndex: number): number {
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    if (!ids.length) return 0;
    const prov = this.appliedProvenance[deviceIndex]?.['serialNumber'] as any;
    const verifiedByValue: Record<string, any> = prov?.verifiedByValue ?? {};
    const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
    return ids.filter(
      (id) => !verifiedByValue[id] && !dismissed.has(id.trim().toLowerCase()),
    ).length;
  }

  /** Open a meter-IDs verify queue: one queue item per extracted serial
   *  that hasn't been per-ID verified yet. Each item carries its own
   *  fileOverride so the dialog renders the doc that contributed it.
   *  Accept stamps a per-ID verifiedBy on the serialNumber provenance
   *  AND ensures the ID is in the device's serial number list. */
  openMeterIdsVerifyQueue(deviceIndex: number): void {
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    if (!ids.length) {
      this.toastrService.info('No extracted meter IDs to verify.');
      return;
    }
    const prov = this.appliedProvenance[deviceIndex]?.['serialNumber'] as any;
    const verifiedByValue: Record<string, any> = prov?.verifiedByValue ?? {};
    const docsByValue = this.meterIdsExtractionDocs[deviceIndex] ?? {};
    const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
    const items: typeof this.verifyQueue = [];
    for (const id of ids) {
      if (verifiedByValue[id]) continue;
      if (dismissed.has(id.trim().toLowerCase())) continue;
      const doc = docsByValue[id];
      items.push({
        deviceIndex,
        // Synthetic field key — verifyAccept inspects the prefix to
        // route to the meter-IDs per-ID path instead of setValue on a
        // form control.
        field: `meterId:${id}`,
        label: `Meter ID: ${id}`,
        source: 'Meter IDs',
        value: id,
        confidence: 1,
        fileOverride: doc?.file,
      });
    }
    if (!items.length) {
      this.toastrService.info('All extracted meter IDs already verified.');
      return;
    }
    this.verifyQueue = items;
    this.verifyQueueIndex = 0;
    // verifyQueueFile stays null; items carry per-item fileOverride.
    this.verifyQueueFile = null;
    if (!this.verifySourceDialog) return;
    if (this.verifySourceDialogRef) {
      this.verifySourceDialogRef.close();
      this.verifySourceDialogRef = null;
    }
    this.verifySourceDialogRef = this.dialog.open(
      this.verifySourceDialog,
      { width: '900px', maxWidth: '95vw', disableClose: false, panelClass: 'drec-floating-dialog' },
    );
    setTimeout(() => this.renderVerifyCanvas({ resetToItemPage: true }), 50);
  }

  /** Render the current verify queue item's source page onto the
   *  dialog's canvas. Uses pdf.js for PDFs; for images, loads into
   *  an <img> and copies to the canvas. Captures the resulting CSS
   *  size on verifyCanvasSize so the overlay div can position the
   *  bbox in screen pixels. */
  private async renderVerifyCanvas(opts?: { resetToItemPage?: boolean }): Promise<void> {
    const canvas = this.verifyCanvasEl?.nativeElement;
    const item = this.verifyCurrent;
    // Per-item file (e.g. meter IDs queue, one file per serial) wins;
    // otherwise fall back to the queue-level file.
    const file = item?.fileOverride ?? this.verifyQueueFile;
    if (!canvas || !file || !item) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (opts?.resetToItemPage ?? false) {
      this.verifyCurrentPage = item.region?.page ?? 1;
    }
    const page = this.verifyCurrentPage;
    // Render at higher internal resolution than the dialog actually
    // shows. The canvas has max-width:100% so it visually scales down
    // to ~880px in the dialog; when the user zooms in via the
    // appImageZoomPan transform there are still 2400px of source
    // pixels available, so the zoomed view stays sharp. 800px was
    // pixel-doubled almost immediately on any zoom.
    const targetW = 2400;
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pdfjs: any = await import('pdfjs-dist' as any);
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        this.verifyPageCount = pdf.numPages;
        this.verifyCurrentPage = Math.min(Math.max(1, page), pdf.numPages);
        const pdfPage = await pdf.getPage(this.verifyCurrentPage);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = targetW / viewport.width;
        const scaled = pdfPage.getViewport({ scale });
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        await pdfPage.render({ canvasContext: ctx, viewport: scaled }).promise;
        // Find-on-page: locate the current value's literal text in the
        // page's text content and draw highlight overlays. Async + best-
        // effort: if the doc is scanned (no text layer) we just get
        // zero hits — no error.
        this.verifyTextMatches = await this.findValueOnPage(pdfPage, scaled, item.value);
        // Kick off a whole-doc scan if we don't have it yet — populates
        // verifyMatchesByPage so the indicator can show "5 matches on
        // p.7" hints. Cached per (file, value).
        this.scanAllPagesForMatches(pdf, item.value);
      } else {
        this.verifyPageCount = 1;
        this.verifyCurrentPage = 1;
        this.verifyTextMatches = [];
        this.verifyMatchesByPage = [];
        const url = URL.createObjectURL(file);
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const el = new Image();
            el.onload = () => res(el);
            el.onerror = rej;
            el.src = url;
          });
          // Always render to the full target width — both upscaling
          // small phone snapshots and downscaling huge originals end at
          // 2400px, so zoom transforms always have headroom to scale
          // sharply. ctx.drawImage on a high-res canvas + browser
          // bilinear upsampling looks fine for the verify use case.
          const scale = targetW / img.width;
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      // CSS size matches intrinsic since max-width:100% above scales
      // it down; read the resolved size after a microtask so the
      // overlay positions correctly even when the dialog narrowed it.
      requestAnimationFrame(() => {
        this.verifyCanvasSize = {
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
        };
      });
    } catch (err) {
      console.warn('renderVerifyCanvas failed', err);
      this.verifyCanvasSize = null;
    }
  }

  /** Cache key for the whole-doc match scan so we don't re-run it on
   *  every page flip. Cleared whenever the file or item changes. */
  private verifyScanKey = '';

  /** Find every occurrence of the value's literal text on the current
   *  page and convert each match's bbox to normalised (0..1) coords
   *  against the rendered canvas. Returns [] when the page has no text
   *  layer (scanned doc) or the value isn't found. */
  private async findValueOnPage(
    pdfPage: any,
    viewport: any,
    value: any,
  ): Promise<Array<{ x: number; y: number; w: number; h: number }>> {
    const needle = String(value ?? '').trim().toLowerCase();
    if (needle.length < 3) return [];
    try {
      const tc = await pdfPage.getTextContent();
      const matches: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const it of tc.items as any[]) {
        if (!it.str) continue;
        const haystack = String(it.str).toLowerCase();
        if (!haystack.includes(needle)) continue;
        // pdf.js text items carry a transform [a, b, c, d, e, f]; e,f
        // is origin in PDF user space (y-up). Convert to viewport
        // coords (which are top-left origin, canvas-pixel scaled).
        const [ex, ey] = [it.transform[4], it.transform[5]];
        const vp: [number, number] = viewport.convertToViewportPoint(ex, ey);
        const w = (it.width || 0) * viewport.scale;
        const h = (it.transform[3] || it.height || 0) * viewport.scale;
        const x = vp[0];
        // convertToViewportPoint already returns top-left-origin coords,
        // but the y refers to the *baseline*; subtract glyph height for
        // the top edge of the rect.
        const y = vp[1] - h;
        if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) continue;
        matches.push({
          x: x / viewport.width,
          y: y / viewport.height,
          w: Math.max(w, 8) / viewport.width,
          h: Math.max(h, 8) / viewport.height,
        });
      }
      return matches;
    } catch {
      return [];
    }
  }

  /** ctrl-F over the PDF's text layer: search a list of value strings
   *  (form-field values for related literal-evidence fields) and
   *  return each match's bbox in fractional (0..1) canvas coords.
   *  Each value is tokenised on non-alphanumerics so multi-word
   *  values like "HUAWEI SUN2000-30KTL-M3" hit on each part. */
  private async findPdfTextHits(
    pdfPage: any,
    viewport: any,
    values: string[],
    pageNumber: number,
    opts: { minLen?: number } = {},
  ): Promise<Array<{ page: number; x: number; y: number; w: number; h: number }>> {
    const STOP = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into',
      'shown', 'page', 'label', 'labeled', 'labelled', 'value',
      'kwac', 'kwdc', 'states', 'indicates', 'confirms', 'shows',
      'reads', 'block', 'section', 'diagram', 'document',
      'inferred', 'derived', 'mentioned', 'visible', 'appears',
      'based', 'implied', 'because', 'which', 'where', 'there',
    ]);
    const minLen = opts.minLen ?? 4;
    const needles = Array.from(
      new Set(
        values
          .flatMap((v) => String(v ?? '').toLowerCase().split(/[^a-z0-9]+/))
          .filter((t) => t.length >= minLen && !STOP.has(t)),
      ),
    );
    if (!needles.length) return [];
    try {
      const tc = await pdfPage.getTextContent();
      const out: Array<{ page: number; x: number; y: number; w: number; h: number }> = [];
      for (const it of tc.items as any[]) {
        if (!it.str) continue;
        const s = String(it.str).toLowerCase();
        if (!needles.some((n) => s.includes(n))) continue;
        const [ex, ey] = [it.transform[4], it.transform[5]];
        const vp: [number, number] = viewport.convertToViewportPoint(ex, ey);
        const w = (it.width || 0) * viewport.scale;
        const h = (it.transform[3] || it.height || 0) * viewport.scale;
        const x = vp[0];
        const y = vp[1] - h;
        if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) continue;
        out.push({
          page: pageNumber,
          x: x / viewport.width,
          y: y / viewport.height,
          w: Math.max(w, 8) / viewport.width,
          h: Math.max(h, 8) / viewport.height,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Walk every page of the PDF once, counting matches per page.
   *  Caches by (file identity, value) so flipping pages doesn't rerun
   *  the scan. Fire-and-forget; updates verifyMatchesByPage when done. */
  private scanAllPagesForMatches(pdf: any, value: any): void {
    const file = this.verifyQueueFile;
    if (!file) return;
    const key = `${file.name}::${file.size}::${String(value)}`;
    if (key === this.verifyScanKey) return;
    this.verifyScanKey = key;
    const needle = String(value ?? '').trim().toLowerCase();
    if (needle.length < 3) {
      this.verifyMatchesByPage = [];
      return;
    }
    (async () => {
      const counts: number[] = new Array(pdf.numPages + 1).fill(0);
      for (let p = 1; p <= pdf.numPages; p++) {
        try {
          const pg = await pdf.getPage(p);
          const tc = await pg.getTextContent();
          let n = 0;
          for (const it of tc.items as any[]) {
            if (it.str && String(it.str).toLowerCase().includes(needle)) n++;
          }
          counts[p] = n;
        } catch {
          counts[p] = 0;
        }
      }
      // Only commit if the scan is still relevant to the user's current
      // queue item (they may have advanced while we were scanning).
      if (key === this.verifyScanKey) {
        this.ngZone.run(() => { this.verifyMatchesByPage = counts; });
      }
    })();
  }

  /** Jump to the next page containing at least one match of the
   *  current value, wrapping around. Called by the "next match" arrow
   *  in the dialog header. */
  /** Sum of matches across the whole doc — drives the "N matches" pill. */
  totalMatchesInDoc(): number {
    let n = 0;
    for (const c of this.verifyMatchesByPage) n += c || 0;
    return n;
  }

  verifyNextMatchPage(): void {
    const counts = this.verifyMatchesByPage;
    if (counts.length < 2) return;
    const start = this.verifyCurrentPage;
    for (let i = 1; i <= this.verifyPageCount; i++) {
      const p = ((start - 1 + i) % this.verifyPageCount) + 1;
      if ((counts[p] ?? 0) > 0) {
        this.verifyCurrentPage = p;
        this.renderVerifyCanvas();
        return;
      }
    }
  }

  /** Current item in the verify queue, or null when done. */
  get verifyCurrent(): typeof this.verifyQueue[number] | null {
    return this.verifyQueue[this.verifyQueueIndex] ?? null;
  }

  /** Accept the current extraction — write provenance with verifier
   *  email + region, advance the queue. */
  verifyAccept(): void {
    const item = this.verifyCurrent;
    if (!item) return;
    const email = (this.user?.email ?? '').trim() || 'unknown';
    // Meter IDs path: synthetic field key 'meterId:<id>' — add the ID
    // to the device's serial number list (if missing) and stamp a per-
    // ID verifiedBy on the serialNumber provenance entry.
    if (typeof item.field === 'string' && item.field.startsWith('meterId:')) {
      const id = String(item.value);
      const list = this.serialNumberLists[item.deviceIndex] ?? [];
      const norm = (s: string) => s.trim().toLowerCase();
      if (!list.some((s) => norm(s) === norm(id))) {
        this.serialNumberLists[item.deviceIndex] = [
          ...list.filter((s) => s.trim()),
          id,
        ];
        this.syncSerialNumberControl(item.deviceIndex);
      }
      // Ensure a serialNumber provenance entry exists; then layer the
      // per-ID verifiedByValue map on top.
      this.recordProvenance(
        item.deviceIndex,
        'serialNumber',
        item.source,
        item.confidence,
        id,
        item.fileOverride ? { name: item.fileOverride.name } : undefined,
      );
      const prov = this.appliedProvenance[item.deviceIndex]?.['serialNumber'] as any;
      if (prov) {
        if (!prov.verifiedByValue) prov.verifiedByValue = {};
        prov.verifiedByValue[id] = { email, at: new Date().toISOString() };
        if (item.region) {
          if (!prov.regionByValue) prov.regionByValue = {};
          prov.regionByValue[id] = item.region;
        }
      }
      this.verifyAdvance();
      return;
    }
    // Standard path: regular form control.
    const ctl = this.deviceForms.at(item.deviceIndex)?.get(item.field);
    if (ctl) {
      ctl.setValue(item.value);
      ctl.markAsDirty();
    }
    const docName = item.fileOverride?.name ?? this.verifyQueueFile?.name;
    this.recordProvenance(
      item.deviceIndex,
      item.field,
      item.source,
      item.confidence,
      item.value,
      docName ? { name: docName } : undefined,
    );
    const entry = this.appliedProvenance[item.deviceIndex]?.[item.field];
    if (entry) {
      (entry as any).verifiedBy = { email, at: new Date().toISOString() };
      if (item.region) (entry as any).region = item.region;
    }
    this.verifyAdvance();
  }

  /** Skip the current item — no value applied, no provenance written.
   *  Meter-IDs special case: declined IDs are recorded as dismissed
   *  so they don't reappear on the next openMeterIdsVerifyQueue. */
  verifyDecline(): void {
    const item = this.verifyCurrent;
    if (item) {
      // Blacklist the (field, value). Funnel decides whether to
      // route to the serial-number specific path or the generic
      // per-field set. Either way the next openVerifyQueue won't
      // re-offer this value.
      this.dismissFieldValue(item.deviceIndex, item.field, item.value);
    }
    this.verifyAdvance();
  }

  /** Bail out of the entire verify queue. Any remaining items aren't
   *  shown; nothing is applied; provenance for already-accepted items
   *  stays as already written. Same effect as closing the dialog via
   *  ESC or backdrop click — explicit button for users who don't
   *  realise the dialog is dismissable. */
  verifyCancelQueue(): void {
    this.verifySourceDialogRef?.close();
    this.verifySourceDialogRef = null;
    this.verifyQueue = [];
    this.verifyQueueIndex = 0;
    this.verifyQueueFile = null;
    this.verifyCanvasSize = null;
  }

  private verifyAdvance(): void {
    this.verifyQueueIndex++;
    if (this.verifyQueueIndex >= this.verifyQueue.length) {
      // Queue exhausted — stamp Applied for this source, run any
      // source-specific post-hooks, then close + reset.
      const lastSource = this.verifyQueue[0]?.source;
      const lastDevice = this.verifyQueue[0]?.deviceIndex;
      if (lastSource != null && lastDevice != null) {
        if (!this.extractionApplied[lastDevice]) {
          this.extractionApplied[lastDevice] = {};
        }
        this.extractionApplied[lastDevice][lastSource] = true;
        this.runVerifyPostHooks(lastDevice, lastSource);
      }
      this.verifySourceDialogRef?.close();
      this.verifySourceDialogRef = null;
      this.verifyQueue = [];
      this.verifyQueueIndex = 0;
      this.verifyQueueFile = null;
      this.verifyCanvasSize = null;
      return;
    }
    setTimeout(() => this.renderVerifyCanvas({ resetToItemPage: true }), 0);
  }

  /** Prev/Next page within the verify dialog's loaded doc. Used when
   *  the model didn't pin the value to a specific page or its bbox is
   *  missing — the user can flip through to find it. */
  verifyPrevPage(): void {
    if (this.verifyCurrentPage <= 1) return;
    this.verifyCurrentPage--;
    this.renderVerifyCanvas();
  }
  verifyNextPage(): void {
    if (this.verifyCurrentPage >= this.verifyPageCount) return;
    this.verifyCurrentPage++;
    this.renderVerifyCanvas();
  }
  /** Jump to the model-reported page (if any) — useful after the user
   *  has flipped away. */
  verifyJumpToReportedPage(): void {
    const item = this.verifyCurrent;
    const target = item?.region?.page;
    if (!target || target === this.verifyCurrentPage) return;
    this.verifyCurrentPage = target;
    this.renderVerifyCanvas();
  }

  /** Source-specific side effects that used to live inside the old
   *  applyXxxExtraction methods (Off-taker derivation, default
   *  data-source brand, etc.). Run once after the user has walked the
   *  whole verify queue. */
  private runVerifyPostHooks(deviceIndex: number, source: string): void {
    if (source === 'SF-02c') {
      // SF-02C carries the no-double-counting declaration; default
      // (31) to "No" when empty.
      const ec = this.deviceForms.at(deviceIndex)?.get('otherEacSchemeRegistration');
      if (ec && !ec.value) {
        ec.setValue('No');
        ec.markAsDirty();
      }
      this.deriveOffTakerSameAsOwner(deviceIndex);
    } else if (source === 'COD') {
      this.deriveOffTakerSameAsOwner(deviceIndex);
    } else if (source === 'SF-02') {
      const fx = this.sf02Extractions[deviceIndex];
      if (fx?.inverterCount) {
        this.setDataSourceIfEmpty(deviceIndex, 'Inverter', 'SF-02');
      }
      this.deriveOffTakerSameAsOwner(deviceIndex);
    }
  }

  /**
   * Generic apply-extraction helper. Splits candidates into
   * fill-empty (silent) and conflict (existing value differs from
   * extracted) buckets. Empties get patched immediately; conflicts
   * pop a single confirmation dialog the user can resolve per-field
   * (default = overwrite). Skips fields with confidence < 0.7.
   *
   * after() runs after the user's choice has landed, so callers can
   * trigger derived effects (e.g. setDataSourceIfEmpty).
   */
  pendingOverwriteCandidates: Array<{
    deviceIndex: number;
    name: string;
    label: string;
    current: any;
    next: any;
    confidence: number;
    selected: boolean;
  }> = [];
  pendingOverwriteSource = '';
  pendingOverwriteAfter: (() => void) | null = null;
  @ViewChild('overwriteConfirmDialog')
  overwriteConfirmDialog?: TemplateRef<any>;
  private overwriteDialogRef: MatDialogRef<any> | null = null;

  /** Normalise an extracted country value (ISO-2 / ISO-3 / common
   *  short name) to the canonical full name in countrylist so the
   *  autocomplete actually matches an option. Returns the input
   *  untouched if no match. */
  private normalizeCountry(raw: any): any {
    if (!raw || typeof raw !== 'string') return raw;
    const s = raw.trim();
    if (!s || !this.countrylist?.length) return s;
    const u = s.toUpperCase();
    const exact = (this.countrylist as any[]).find(
      (c) => c.country?.toUpperCase() === u,
    );
    if (exact) return exact.country;
    if (s.length === 2) {
      const m = (this.countrylist as any[]).find((c) => c.alpha2 === u);
      if (m) return m.country;
    }
    if (s.length === 3) {
      const m = (this.countrylist as any[]).find(
        (c) => c.alpha3 === u || c.countryCode === u,
      );
      if (m) return m.country;
    }
    // Tolerate common short forms ("Vietnam" → "Viet Nam", "USA" → ...)
    const flat = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');
    const fs = flat(s);
    const fuzzy = (this.countrylist as any[]).find(
      (c) => flat(c.country || '') === fs,
    );
    return fuzzy ? fuzzy.country : s;
  }

  private markExtractionApplied(deviceIndex: number, source: string): void {
    if (!this.extractionApplied[deviceIndex]) {
      this.extractionApplied[deviceIndex] = {};
    }
    this.extractionApplied[deviceIndex][source] = true;
  }

  /** Look up the doc identity stashed at extraction time for the given
   *  source label. Returns undefined when we don't have a record — the
   *  apply path will fall through to no docId/docName and the badge
   *  will read "Unattributed source: <type>" rather than claiming a
   *  specific file. */
  private docForSource(
    deviceIndex: number,
    source: string,
  ): { id?: number; name: string } | undefined {
    if (source === 'SLD') return this.sldExtractionDoc[deviceIndex] ?? undefined;
    if (source === 'SF-02c') return this.sf02cExtractionDoc[deviceIndex] ?? undefined;
    if (source === 'COD') return this.codExtractionDoc[deviceIndex] ?? undefined;
    if (source === 'SF-02') return this.sf02ExtractionDoc[deviceIndex] ?? undefined;
    return undefined;
  }

  private applyExtractionWithPrompt(
    deviceIndex: number,
    source: string,
    candidates: Array<{
      name: string;
      field: { value: any; confidence: number } | undefined;
      transform?: (v: any) => any;
    }>,
    after?: () => void,
    opts: { silentIfConflicts?: boolean; silentIfEmpty?: boolean } = {},
  ): void {
    const form = this.deviceForms.at(deviceIndex);
    const sourceDoc = this.docForSource(deviceIndex, source);
    let filled = 0;
    const conflicts: typeof this.pendingOverwriteCandidates = [];
    const unchecked = this.uncheckedExtractedFields[deviceIndex] ?? new Set<string>();
    const prefix = source.toLowerCase().replace(/-/g, '');
    for (const c of candidates) {
      if (unchecked.has(`${prefix}:${c.name}`)) continue;
      if (!c.field || c.field.value == null || c.field.confidence < 0.7) continue;
      const ctl = form.get(c.name);
      if (!ctl) continue;
      let next = c.transform ? c.transform(c.field.value) : c.field.value;
      // The country control is bound to the full name; normalise
      // ISO codes / common short forms before comparison + setValue.
      if (c.name === 'countryCodename') {
        next = this.normalizeCountry(next);
      }
      const cur = ctl.value;
      const isEmpty =
        cur === null ||
        cur === undefined ||
        cur === '' ||
        (Array.isArray(cur) && cur.length === 0);
      if (isEmpty) {
        ctl.setValue(next);
        ctl.markAsDirty();
        if (c.name === 'countryCodename') {
          this.userPickedCountry[deviceIndex] = true;
        }
        this.recordProvenance(
          deviceIndex,
          c.name,
          source,
          c.field.confidence,
          next,
          sourceDoc,
        );
        filled++;
        continue;
      }
      if (this.normalizeForCompare(cur) === this.normalizeForCompare(next)) {
        // Same value — no form patch needed, but DO record provenance.
        // Otherwise a value the registrant typed *and* Haiku independently
        // confirmed shows up later as MANUAL / "no extractor weighed in"
        // even though the extractor agreed. Matching is the strongest
        // possible signal that AI and human are aligned; we want it
        // surfaced in the OC checklist, not silently dropped.
        this.recordProvenance(
          deviceIndex,
          c.name,
          source,
          c.field.confidence,
          next,
          sourceDoc,
        );
        continue;
      }
      conflicts.push({
        deviceIndex,
        name: c.name,
        label:
          AddDevicesComponent.FIELD_LABELS[c.name] ??
          c.name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        current: cur,
        next,
        confidence: c.field.confidence,
        selected: true,
      });
    }
    if (conflicts.length === 0) {
      after?.();
      this.markExtractionApplied(deviceIndex, source);
      if (filled === 0 && opts.silentIfEmpty) return;
      this.toastrService.success(
        filled
          ? `${source}: ${filled} field${filled === 1 ? '' : 's'} applied`
          : `${source}: nothing new to apply`,
      );
      return;
    }
    // Auto-apply path: extraction finished, but the form already has
    // values for some fields. Don't pop a dialog the user didn't ask
    // for — silently apply whatever WAS empty and leave the conflict
    // resolution for the explicit "Apply to form" button.
    if (opts.silentIfConflicts) {
      if (filled > 0) this.markExtractionApplied(deviceIndex, source);
      return;
    }
    this.pendingOverwriteCandidates = conflicts;
    this.pendingOverwriteSource = source;
    this.pendingOverwriteAfter = () => {
      after?.();
      // Mark applied only after the user resolved the overwrite
      // dialog (whether they took the doc value or skipped). If they
      // cancelled the dialog the flag stays false so they can retry.
      this.markExtractionApplied(deviceIndex, source);
      this.toastrService.success(`${source} applied`);
    };
    this.overwriteDialogRef = this.dialog.open(this.overwriteConfirmDialog!, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'drec-floating-dialog',
    });
  }

  applyOverwriteConfirmed(): void {
    const form = this.deviceForms.at(0);
    const source = this.pendingOverwriteSource;
    let applied = 0;
    for (const c of this.pendingOverwriteCandidates) {
      if (!c.selected) continue;
      const ctl = form.get(c.name);
      if (!ctl) continue;
      ctl.setValue(c.next);
      ctl.markAsDirty();
      if (c.name === 'countryCodename') {
        this.userPickedCountry[c.deviceIndex] = true;
      }
      this.recordProvenance(
        c.deviceIndex,
        c.name,
        source,
        c.confidence,
        c.next,
        this.docForSource(c.deviceIndex, source),
      );
      applied++;
    }
    this.pendingOverwriteAfter?.();
    if (applied) {
      this.toastrService.success(`Overwrote ${applied} field${applied === 1 ? '' : 's'}`);
    }
    this.pendingOverwriteCandidates = [];
    this.pendingOverwriteSource = '';
    this.pendingOverwriteAfter = null;
    this.overwriteDialogRef?.close();
    this.overwriteDialogRef = null;
  }

  cancelOverwrite(): void {
    this.pendingOverwriteAfter?.();
    this.pendingOverwriteCandidates = [];
    this.pendingOverwriteSource = '';
    this.pendingOverwriteAfter = null;
    this.overwriteDialogRef?.close();
    this.overwriteDialogRef = null;
  }

  private normalizeForCompare(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number(v.toFixed(4)).toString();
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).sort().join('|');
    return String(v).trim().toLowerCase();
  }

  /** Set `dataSource` to a specific enum value only if the form
   *  control is currently empty. Used by SLD / SF-02 / meter-ids
   *  applies when an inverter signal is present. */
  private setDataSourceIfEmpty(
    deviceIndex: number,
    value: string,
    source = 'Meter IDs',
  ): void {
    const ctl = this.deviceForms.at(deviceIndex).get('dataSource');
    if (!ctl) return;
    if (ctl.value !== null && ctl.value !== undefined && ctl.value !== '') return;
    ctl.setValue(value);
    ctl.markAsDirty();
    // Credit whichever rule fired this — SLD / SF-02 / Meter IDs.
    this.recordProvenance(deviceIndex, 'dataSource', source, 0.9, value);
  }

  dismissSldExtraction(deviceIndex: number): void {
    this.sldExtractions[deviceIndex] = null;
  }

  private extractSf02cFieldsForDevice(file: File, deviceIndex: number): void {
    this.sf02cExtracting[deviceIndex] = true;
    this.sf02cExtractions[deviceIndex] = null;
    this.sf02cExtractionDoc[deviceIndex] = { name: file.name };
    if (this.extractionApplied[deviceIndex]) {
      this.extractionApplied[deviceIndex]['SF-02c'] = false;
    }
    this.documentClassifier
      .extractSf02cFields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02cExtracting[deviceIndex] = false;
          this.sf02cExtractions[deviceIndex] = res;
          this.sf02cExtractionFile[deviceIndex] = file;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02cExtracting[deviceIndex] = false;
        }),
      );
  }

  dismissSf02cExtraction(deviceIndex: number): void {
    this.sf02cExtractions[deviceIndex] = null;
  }

  private extractCodFieldsForDevice(file: File, deviceIndex: number): void {
    this.codExtracting[deviceIndex] = true;
    this.codExtractions[deviceIndex] = null;
    this.codExtractionDoc[deviceIndex] = { name: file.name };
    if (this.extractionApplied[deviceIndex]) {
      this.extractionApplied[deviceIndex]['COD'] = false;
    }
    // Pass the device's current siteName so the COD extractor can
    // filter on the right row in multi-site certificates (e.g. a
    // Provisional Acceptance Certificate listing 15 mini-grids).
    // Without this, the extractor reads the table arbitrarily and
    // returns garbage values (totals, sums, wrong rows).
    const siteName = String(
      this.deviceForms.at(deviceIndex)?.get('siteName')?.value ?? '',
    ).trim() || undefined;
    this.documentClassifier
      .extractCodFields(file, this.editingDeviceId ?? undefined, siteName)
      .then((res) =>
        this.ngZone.run(() => {
          this.codExtracting[deviceIndex] = false;
          this.codExtractions[deviceIndex] = res;
          // Opportunistic SN harvest: COD proofs sometimes carry an
          // equipment list. Merge any IDs into the meter-ids banner
          // so the user can apply them in one place.
          if (
            res?.measurementIds &&
            res.measurementIds.confidence >= 0.7 &&
            res.measurementIds.value.length
          ) {
            const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
            const existing = new Set(
              this.meterIdsExtractions[deviceIndex] || [],
            );
            for (const id of res.measurementIds.value) {
              // Honour the user's dismiss — a value they declined or
              // removed must NOT come back via the opportunistic COD
              // harvest, even if Haiku still confidently sees it.
              if (dismissed.has((id || '').trim().toLowerCase())) continue;
              existing.add(id);
            }
            this.meterIdsExtractions[deviceIndex] = [...existing];
          }
          this.codExtractionFile[deviceIndex] = file;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.codExtracting[deviceIndex] = false;
        }),
      );
  }

  /**
   * (30) Off-taker same company as PV owner? auto-derives from
   * (27) PV System Owner + (28) Off-taker Name once both are
   * populated. Patches only when empty so a deliberate user
   * override survives.
   */
  private deriveOffTakerSameAsOwner(deviceIndex: number): void {
    const form = this.deviceForms.at(deviceIndex);
    const ctl = form?.get('offTakerSameCompanyAsOwner');
    if (!ctl || ctl.value) return;
    const owner = String(form?.get('pvSystemOwner')?.value ?? '').trim().toLowerCase();
    const off = String(form?.get('offTakerName')?.value ?? '').trim().toLowerCase();
    if (!owner || !off) return;
    ctl.setValue(owner === off ? 'Yes' : 'No');
    ctl.markAsDirty();
  }

  dismissCodExtraction(deviceIndex: number): void {
    this.codExtractions[deviceIndex] = null;
  }

  private extractSf02FieldsForDevice(file: File, deviceIndex: number): void {
    this.sf02Extracting[deviceIndex] = true;
    this.sf02Extractions[deviceIndex] = null;
    this.sf02ExtractionDoc[deviceIndex] = { name: file.name };
    if (this.extractionApplied[deviceIndex]) {
      this.extractionApplied[deviceIndex]['SF-02'] = false;
    }
    this.documentClassifier
      .extractSf02Fields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02Extracting[deviceIndex] = false;
          this.sf02Extractions[deviceIndex] = res;
          this.sf02ExtractionFile[deviceIndex] = file;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02Extracting[deviceIndex] = false;
        }),
      );
  }

  dismissSf02Extraction(deviceIndex: number): void {
    this.sf02Extractions[deviceIndex] = null;
  }

  /** Classify a metering-evidence file's *shape* (portal screenshot →
   *  Mode 2, API payload → Mode 1, source-linked CSV → Mode 3) and
   *  auto-fill the source-access-mode form field if (a) confidence is
   *  high enough, (b) the form field is currently empty, and (c) the
   *  suggested mode maps cleanly to one of the three documentable
   *  modes (Mode 4 is reviewer judgment, not a doc property).
   *
   *  Records provenance against 'Metering evidence' so the OC#22 row
   *  reads "Metering evidence: Mode 2 ✓" instead of MANUAL. */
  private classifySourceAccessModeForDevice(
    file: File,
    deviceIndex: number,
  ): void {
    const KEY_TO_DISPLAY: Record<string, SourceAccessMode> = {
      Mode1_DirectAPI: SourceAccessMode.Mode1_DirectAPI,
      Mode2_PortalAccess: SourceAccessMode.Mode2_PortalAccess,
      Mode3_FileSubmission: SourceAccessMode.Mode3_FileSubmission,
    };
    this.documentClassifier
      .classifySourceAccessMode(file, this.editingDeviceId ?? undefined)
      .then((res) =>
        this.ngZone.run(() => {
          if (!res?.suggestedMode) return;
          const sm = res.suggestedMode;
          if (sm.value == null || sm.confidence < 0.7) return;
          const display = KEY_TO_DISPLAY[sm.value as string];
          if (!display) return; // Mode 4 (null) or unknown — leave it.

          const ctrl = (this.deviceForms.at(deviceIndex) as FormGroup).get(
            'sourceAccessMode',
          );
          const cur = ctrl?.value;
          // Only auto-fill an empty field. Don't overwrite a registrant
          // who already picked a mode — even Haiku-suggested values
          // defer to explicit human input here.
          if (cur == null || cur === '') {
            ctrl?.setValue(display);
            ctrl?.markAsDirty();
          }
          // Record provenance regardless of whether we patched — if the
          // registrant's value matches our suggestion, that's still
          // metering-evidence-backed.
          if (
            cur == null ||
            cur === '' ||
            String(cur).trim() === display
          ) {
            this.recordProvenance(
              deviceIndex,
              'sourceAccessMode',
              'Metering evidence',
              sm.confidence,
              display,
            );
          }
        }),
      )
      .catch((err) =>
        console.warn('source-access-mode classify failed', err?.message),
      );
  }

  private extractMeterIdsForDevice(file: File, deviceIndex: number): void {
    this.meterIdsExtracting[deviceIndex] = true;
    if (!this.meterIdsExtractions[deviceIndex]) {
      this.meterIdsExtractions[deviceIndex] = [];
    }
    if (!this.meterIdsExtractionDocs[deviceIndex]) {
      this.meterIdsExtractionDocs[deviceIndex] = {};
    }
    this.documentClassifier
      .extractMeterIds(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.meterIdsExtracting[deviceIndex] = false;
          if (res?.measurementIds && res.measurementIds.confidence >= 0.7) {
            const existing = new Set(
              this.meterIdsExtractions[deviceIndex] || [],
            );
            const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
            for (const id of res.measurementIds.value) {
              // Honour the user's dismiss — re-extracting the doc that
              // produced a phantom serial must not bring the phantom
              // back.
              if (dismissed.has((id || '').trim().toLowerCase())) continue;
              existing.add(id);
              if (!this.meterIdsExtractionDocs[deviceIndex][id]) {
                this.meterIdsExtractionDocs[deviceIndex][id] = { name: file.name, file };
              }
            }
            this.meterIdsExtractions[deviceIndex] = [...existing];
          }
          if (res?.inverterMakeModel && res.inverterMakeModel.confidence >= 0.7) {
            this.meterIdsBrands[deviceIndex] = res.inverterMakeModel.value;
          }
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.meterIdsExtracting[deviceIndex] = false;
        }),
      );
  }

  applyMeterIdsExtraction(deviceIndex: number): void {
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    if (!ids.length) return;
    // The (14) input list is rendered from serialNumberLists[i], not
    // straight from the form control — so we have to update both.
    const existing = (this.getSerialNumbers(deviceIndex) || [])
      .map((s) => (s || '').trim())
      .filter(Boolean);
    const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
    // Honour Phase-2 per-ID checkboxes: an unticked ID is treated as
    // explicitly skipped (registers in dismissedSerialNumbers too so
    // re-running extraction doesn't bring it back).
    const unchecked = this.uncheckedExtractedFields[deviceIndex] ?? new Set();
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const id of [...existing, ...ids]) {
      const k = id.toLowerCase();
      if (seen.has(k)) continue;
      if (dismissed.has(k) && !existing.includes(id)) continue;
      // Skip if user unticked this specific ID in the Reading-
      // documents conclusion. Add to dismissed so the spurious
      // value stays gone across subsequent extractor replays.
      if (unchecked.has(`meterId:${id}`) && !existing.includes(id)) {
        this.dismissSerial(deviceIndex, id);
        continue;
      }
      seen.add(k);
      merged.push(id);
    }
    // Always proceed when there's an extraction in scope — even if
    // every extracted ID matches an existing chip, the apply rewrites
    // provenance so the existing chips pick up their per-file
    // attribution. Without this, a device with pre-existing chips
    // that the extractor independently confirms ships as Unattributed.
    this.serialNumberLists[deviceIndex] = merged.length ? merged : [''];
    this.syncSerialNumberControl(deviceIndex);
    // Build a docs map for the IDs being recorded — one ID can have
    // come from one of several uploads in the same batch. Stored under
    // .docs on the provenance entry alongside the joined value list.
    const docsByValue = this.meterIdsExtractionDocs[deviceIndex] ?? {};
    const usedDocs = merged
      .map((id) => docsByValue[id])
      .filter((d): d is { name: string; id?: number } => !!d);
    // De-dupe by name so the provenance entry's docName is the most
    // useful single-doc label (the first file that contributed).
    const primaryDoc = usedDocs[0];
    this.recordProvenance(
      deviceIndex,
      'serialNumber',
      'Meter IDs',
      1,
      merged.join(';'),
      primaryDoc,
    );
    // Stash the per-id map alongside the entry so the UI can show
    // "from photo3.jpg" per chip, not just the first-file headline.
    if (
      Object.keys(docsByValue).length &&
      this.appliedProvenance[deviceIndex]?.['serialNumber']
    ) {
      (this.appliedProvenance[deviceIndex]['serialNumber'] as any).docsByValue =
        docsByValue;
    }
    // SNs were read from a metering portal / nameplate — the data
    // source is the inverter.
    this.setDataSourceIfEmpty(deviceIndex, 'Inverter');
    // Patch (27) Data Source Brand Name when we also captured an
    // inverter make/model from any of the screenshots.
    const brand = this.meterIdsBrands[deviceIndex];
    if (brand) {
      const brandCtl = this.deviceForms.at(deviceIndex).get('dataSourceBrand');
      if (brandCtl) {
        const cur = String(brandCtl.value ?? '').trim();
        if (!cur) {
          brandCtl.setValue(brand);
          brandCtl.markAsDirty();
          this.recordProvenance(deviceIndex, 'dataSourceBrand', 'Meter IDs', 1, brand);
        }
      }
    }
    const added = merged.length - existing.length;
    const attributed = Object.keys(
      this.meterIdsExtractionDocs[deviceIndex] ?? {},
    ).filter((id) => merged.includes(id)).length;
    if (added > 0) {
      this.toastrService.success(
        `${added} measurement ID${added === 1 ? '' : 's'} added ` +
          `(${attributed} attributed to source).`,
      );
    } else if (attributed > 0) {
      this.toastrService.success(
        `Provenance refreshed — ${attributed} chip${attributed === 1 ? '' : 's'} ` +
          `now attributed to source.`,
      );
    } else {
      this.toastrService.info('No changes — all chips already in place.');
    }
  }

  /** Bulk "Dismiss" on the AI-extracted-IDs banner. Blacklists EVERY
   *  currently-extracted ID for this device before clearing the list,
   *  so re-extracting the same screenshots doesn't bring the phantoms
   *  back. Previously this just emptied the array without recording
   *  anything — the prime "10024nen keeps coming back" reseed. */
  dismissMeterIdsExtraction(deviceIndex: number): void {
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    for (const id of ids) this.dismissSerial(deviceIndex, id);
    this.meterIdsExtractions[deviceIndex] = [];
  }

  /** Dismiss a SINGLE extracted ID from the banner without nuking the
   *  rest. Blacklists the value so it can't return on re-extract.
   *  Wired to a × button per <li> in the meter-IDs banner template. */
  dismissOneExtractedMeterId(deviceIndex: number, id: string): void {
    this.dismissSerial(deviceIndex, id);
  }

  /** OK + Extract: keep the magic dialog open, transition into
   *  extraction-phase view, kick off all matching extractors.
   *  Files are already routed (the classifier moved them at sort
   *  time); we just clean up the cancel-backup since the user is
   *  committing. */
  extractAllFromMagic(deviceIndex: number): void {
    const log = this.magicLog[deviceIndex] || [];
    // Drop the cancel-rollback backup -- user committed to the sort.
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
    this.magicExtractMode[deviceIndex] = true;
    for (const entry of log) {
      if (!entry.file || !entry.docType) continue;
      switch (entry.docType) {
        case DocumentType.SINGLE_LINE_DIAGRAM:
          this.extractSldFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.SF_02C:
          this.extractSf02cFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.COD_PROOF:
          this.extractCodFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.FORM_SF_02:
          this.extractSf02FieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.METERING_EVIDENCE:
          this.extractMeterIdsForDevice(entry.file, deviceIndex);
          this.classifySourceAccessModeForDevice(entry.file, deviceIndex);
          break;
      }
    }
  }

  /** True while any extractor is still running on this device. */
  isAnyExtracting(deviceIndex: number): boolean {
    return !!(
      this.sldExtracting[deviceIndex] ||
      this.sf02cExtracting[deviceIndex] ||
      this.codExtracting[deviceIndex] ||
      this.sf02Extracting[deviceIndex] ||
      this.meterIdsExtracting[deviceIndex]
    );
  }

  /** True if at least one extractor returned a usable result. */
  hasAnyExtractionResult(deviceIndex: number): boolean {
    return !!(
      this.sldExtractions[deviceIndex] ||
      this.sf02cExtractions[deviceIndex] ||
      this.codExtractions[deviceIndex] ||
      this.sf02Extractions[deviceIndex] ||
      (this.meterIdsExtractions[deviceIndex]?.length ?? 0) > 0
    );
  }

  /** Aggregate every extractor's per-form-field claim with its
   *  source label and confidence. One field may have multiple claims
   *  (e.g. capacity from SLD + COD + SF-02). */
  collectExtractionClaims(
    deviceIndex: number,
  ): {
    [field: string]: Array<{ source: string; value: any; confidence: number; at?: string }>;
  } {
    const claims: {
      [field: string]: Array<{ source: string; value: any; confidence: number; at?: string }>;
    } = {};
    const add = (
      field: string,
      source: string,
      raw: { value: any; confidence: number } | undefined,
      transform?: (v: any) => any,
    ) => {
      if (!raw || raw.confidence < 0.7) return;
      if (!claims[field]) claims[field] = [];
      claims[field].push({
        source,
        value: transform ? transform(raw.value) : raw.value,
        confidence: raw.confidence,
      });
    };
    const sld = this.sldExtractions[deviceIndex];
    if (sld) {
      add('capacity', 'SLD', sld.acCapacityKw);
      add('generatingUnitCount', 'SLD', sld.inverterCount);
      add('interconnectionVoltage', 'SLD', sld.gridVoltage);
      add('gridInterconnection', 'SLD', sld.gridTied, (v) => !!v);
      add('dataSourceBrand', 'SLD', sld.inverterMakeModel);
      add('networkOwner', 'SLD', sld.networkOwner);
      add('hasNetworkMeter', 'SLD', sld.hasNetworkMeter, (v) =>
        v ? 'Yes' : 'No',
      );
      add('gridExportType', 'SLD', sld.gridExportType);
      add('hasAuxiliaryEnergySources', 'SLD', sld.hasAuxiliaryEnergySources, (v) =>
        v ? 'Yes' : 'No',
      );
      add('auxiliaryEnergySourceDetails', 'SLD', sld.auxiliaryEnergySourceDetails);
      add('hasCaptiveConsumer', 'SLD', sld.hasCaptiveConsumer, (v) =>
        v ? 'Yes' : 'No',
      );
    }
    const sf02c = this.sf02cExtractions[deviceIndex];
    if (sf02c) {
      add('siteName', 'SF-02c', sf02c.projectName);
      add('pvSystemOwner', 'SF-02c', sf02c.ownerLegalName);
      add('pvSystemOwnerAddress', 'SF-02c', sf02c.ownerAddress);
      add('countryCodename', 'SF-02c', sf02c.ownerCountry, (v) =>
        this.normalizeCountry(v),
      );
    }
    const cod = this.codExtractions[deviceIndex];
    if (cod) {
      add('commissioningDate', 'COD', cod.commissioningDate);
      add('siteName', 'COD', cod.facilityName);
      add('capacity', 'COD', cod.acCapacityKw);
      add('pvSystemOwner', 'COD', cod.ownerName);
      add('countryCodename', 'COD', cod.country, (v) =>
        this.normalizeCountry(v),
      );
      // utilityOrIssuer dropped from networkOwner candidates — it's
      // the COD signatory (often the EPC), not the DSO. The
      // dedicated networkOwner field on SF-02 is the reliable source.
    }
    const sf02 = this.sf02Extractions[deviceIndex];
    if (sf02) {
      add('siteName', 'SF-02', sf02.facilityName);
      add('capacity', 'SF-02', sf02.acCapacityKw);
      add('commissioningDate', 'SF-02', sf02.commissioningDate);
      add('deviceTypeCode', 'SF-02', sf02.deviceTypeCode);
      add('pvSystemOwner', 'SF-02', sf02.ownerLegalName);
      add('pvSystemOwnerAddress', 'SF-02', sf02.ownerAddress);
      add('countryCodename', 'SF-02', sf02.ownerCountry, (v) =>
        this.normalizeCountry(v),
      );
      add('latitude', 'SF-02', sf02.latitude);
      add('longitude', 'SF-02', sf02.longitude);
      add('generatingUnitCount', 'SF-02', sf02.inverterCount);
      add('networkOwner', 'SF-02', sf02.networkOwner);
    }
    // Synthetic-source claims from the inference helpers (geocoder,
    // impact-story keyword scan, metering-evidence presence rule).
    // These aren't doc-extractors but they're real provenance and
    // would otherwise be reported as "MANUAL".
    const inferences = this.inferenceClaims[deviceIndex] ?? {};
    for (const [field, list] of Object.entries(inferences)) {
      for (const c of list) {
        if (!claims[field]) claims[field] = [];
        claims[field].push(c);
      }
    }
    // Retroactive inference: a field saved in a prior session is
    // already populated on hydration, so the live inference helpers
    // never re-fire — they only write to empty controls. Recompute
    // what each helper WOULD say given the current state and credit
    // it when its output matches the form value. This catches
    // SDGBenefits / impactStory-derived flags / geocoder values
    // that were inferred before this edit session.
    const formAt = this.deviceForms.at(deviceIndex);
    if (formAt) {
      const story = formAt.get('impactStory')?.value as string | null;
      const addInferred = (
        field: string,
        source: string,
        inferredValue: any,
      ): void => {
        if (inferredValue == null || inferredValue === '') return;
        if (Array.isArray(inferredValue) && inferredValue.length === 0) return;
        const cur = formAt.get(field)?.value;
        let match: boolean;
        if (Array.isArray(inferredValue) && Array.isArray(cur)) {
          // Multi-select fields: credit the inference if the user's
          // current selection is a SUBSET of what the inference
          // would produce. Catches the common case of the helper
          // suggesting [SDG7, SDG2, SDG11, SDG13] and the user
          // having pruned it to [SDG7, SDG11, SDG13]. Empty current
          // is trivially a subset → reject that.
          if (cur.length === 0) return;
          const inferredSet = new Set(inferredValue.map((v) => String(v)));
          match = cur.every((v: any) => inferredSet.has(String(v)));
        } else {
          match =
            String(cur).trim().toLowerCase() ===
            String(inferredValue).trim().toLowerCase();
        }
        if (!match) return;
        if (!claims[field]) claims[field] = [];
        // Skip if the same source already weighed in (live capture
        // beat us to it).
        if (claims[field].some((c) => c.source === source)) return;
        // Claim the CURRENT value, not the inferred superset, so
        // the conflict-detection layer marks the row DOC-BACKED
        // (matches form) rather than RESOLVED CONFLICT (which
        // would imply the user actively rejected something).
        claims[field].push({ source, value: cur, confidence: 0.9 });
        // Also persist into appliedProvenance so the reviewer's OC#
        // panel can credit retroactive inferences (deviceDescription,
        // offTaker, evidencePathway, …). Without this the field
        // showed up in the report as DOC-BACKED but the reviewer
        // saw it as MANUAL because field_provenance didn't have it.
        const existing = this.appliedProvenance[deviceIndex]?.[field];
        if (!existing) {
          this.recordProvenance(deviceIndex, field, source, 0.9, cur);
        }
      };
      // (30) Operating configuration is derivable from the SLD's
      // gridTied + gridExportType + the impactStory's mini-grid hint.
      // Inferred string maps 1:1 to the form's enum values.
      const sldFx = this.sldExtractions[deviceIndex];
      const inferOpConfig = (): string | null => {
        const isMiniGrid =
          story && /\bmini[\s-]?grid\b/i.test(story);
        const gridTied = sldFx?.gridTied?.value;
        const exportType = sldFx?.gridExportType?.value;
        if (isMiniGrid || gridTied === false) return 'Off-grid / islanded';
        if (gridTied === true && typeof exportType === 'string') {
          if (exportType.startsWith('No')) {
            return 'Grid-connected, behind-the-meter, no export';
          }
          if (exportType.includes('partial')) {
            return 'Grid-connected, behind-the-meter, with permitted export';
          }
          if (exportType.includes('full')) {
            return 'Grid-connected, full export / open access';
          }
        }
        return null;
      };
      addInferred(
        'operatingConfiguration',
        'SLD + Impact story',
        inferOpConfig(),
      );

      // (12) fuelCode defaults to 'ES100' (solar PV) in the form
      // builder — every new device starts there unless something
      // overrides it. If the form value matches the default, credit
      // the platform rather than the user.
      addInferred('fuelCode', 'Platform default (solar PV)', 'ES100');

      // (21) Data source. When the form holds 'Inverter' AND any of
      // SLD / SF-02 / METERING_EVIDENCE are attached, the platform
      // (or a prior Apply) set it from one of those — never the user.
      // Pick the most specific source available; on re-edit the
      // original-attribution doc isn't recoverable, so this is a
      // best-effort post-hoc credit.
      const docs = this.existingDocs[deviceIndex] ?? {};
      const dataSourceSource = docs['SINGLE_LINE_DIAGRAM']?.length
        ? 'SLD'
        : docs['FORM_SF_02']?.length
          ? 'SF-02'
          : docs['METERING_EVIDENCE']?.length
            ? 'Meter IDs'
            : null;
      if (dataSourceSource) {
        addInferred('dataSource', dataSourceSource, 'Inverter');
      }

      // version 1.0 is the form-builder's hard-coded default — every
      // device starts there and almost nothing overrides it.
      addInferred('version', 'Platform default', '1.0');

      // sf02EvidenceMode defaults to 'self' (Self-generated SF-02).
      // The form-builder hard-codes this; it only changes if the
      // registrant explicitly switches the radio to "upload".
      addInferred('sf02EvidenceMode', 'Platform default', 'self');

      // labellingSchemeAccreditation: every facility on this platform
      // carries the D-REC Label by definition. Credit the platform.
      const lsa = formAt.get('labellingSchemeAccreditation')?.value;
      if (Array.isArray(lsa) && lsa.includes('The D-REC Label')) {
        addInferred('labellingSchemeAccreditation', 'Platform default', lsa);
      }

      // meterReadsShareable = 'Yes' is reasonable to infer when the
      // SLD found a network meter (hasNetworkMeter='Yes') OR a
      // METERING_EVIDENCE doc is attached. Credit accordingly.
      const mrs = formAt.get('meterReadsShareable')?.value;
      const hnm = formAt.get('hasNetworkMeter')?.value;
      if (mrs === 'Yes') {
        if (hnm === 'Yes' && docs['SINGLE_LINE_DIAGRAM']?.length) {
          addInferred('meterReadsShareable', 'SLD', 'Yes');
        } else if (docs['METERING_EVIDENCE']?.length) {
          addInferred('meterReadsShareable', 'Meter IDs', 'Yes');
        }
      }

      // evidence_pathway is mechanically derived from operating
      // configuration + sourceAccessMode (per the D-REC §3.1 table).
      // If the form value matches what the rule produces, credit it.
      const opConfig = formAt.get('operatingConfiguration')?.value;
      const sam = formAt.get('sourceAccessMode')?.value;
      const offGrid =
        typeof opConfig === 'string' && /off[\s-]?grid|islanded/i.test(opConfig);
      const samMode =
        typeof sam === 'string'
          ? sam.startsWith('Mode 1')
            ? 1
            : sam.startsWith('Mode 2')
              ? 2
              : sam.startsWith('Mode 3')
                ? 3
                : sam.startsWith('Mode 4')
                  ? 4
                  : null
          : null;
      const inferEvidencePathway = (): string | null => {
        if (samMode == null) return null;
        if (offGrid) {
          if (samMode === 1 || samMode === 2) return 'Direct Off-Grid';
          return 'Compensating Off-Grid';
        }
        if (samMode === 1 || samMode === 2) return 'Direct Grid-Connected';
        if (samMode === 3) return 'File-Based Grid-Connected';
        return 'Compensating Grid-Connected';
      };
      addInferred(
        'evidencePathway',
        'opConfig × sourceAccessMode',
        inferEvidencePathway(),
      );

      // state_province: the impactStory often names the locale
      // verbatim (e.g. "Lokoja LGA of Kogi State"). If the form
      // value appears in the story, credit the story as the source.
      if (story) {
        const sp = formAt.get('stateProvince')?.value as string | null;
        if (
          sp &&
          story.toLowerCase().includes(sp.toLowerCase())
        ) {
          // addInferred matches via String-equal; pass the form value
          // back as the inferred value so it always matches.
          addInferred('stateProvince', 'Impact story', sp);
        }

        // off_taker_name: typically the community / customer label in
        // the story. Credit when the form value is a verbatim
        // substring (case-insensitive) of the story — conservative
        // enough that "Atsawa Community" matches "Atsawa community"
        // but a hand-typed off-taker that's not in the story won't.
        const otn = formAt.get('offTakerName')?.value as string | null;
        if (
          otn &&
          story.toLowerCase().includes(otn.toLowerCase())
        ) {
          addInferred('offTakerName', 'Impact story', otn);
        }
      }

      // sourceAccessMode 'Mode 1' is inferable when the device has an
      // api_user_id wired up — the platform is pulling data via API,
      // which is exactly what Mode 1 describes. Credit it retro-
      // actively so it stops reading MANUAL on API-ingested devices.
      const apiUserId = (this.initialValues as any)?.api_user_id;
      if (apiUserId) {
        addInferred(
          'sourceAccessMode',
          'API-user inference',
          'Mode 1 — Direct API-based source access',
        );
      }

      if (story) {
        addInferred(
          'deviceDescription',
          'Impact story',
          this.inferDeviceDescription(story),
        );
        addInferred('offTaker', 'Impact story', this.inferOffTaker(story));
        const fund = this.inferFundingFlags(story);
        if (fund) {
          addInferred(
            'hasPublicFunding',
            'Impact story',
            fund.publicFunding,
          );
          addInferred('hasSubsidy', 'Impact story', fund.subsidy);
        }
        addInferred('SDGBenefits', 'Impact story', this.inferSdgBenefits(story));
      }
    }
    // Don't inject the live form value as a synthetic claim — the
    // form value isn't itself evidence (it's whatever's typed/picked
    // right now). Doc-vs-form discrepancies still surface in the
    // submit-time form-vs-doc resolver dialog (a separate pass that
    // explicitly compares form to extractor claims). The conflict
    // block here is for doc-vs-doc disagreement only.

    // Persisted provenance from prior edits — synthesise a "(saved)"
    // claim for any field that has stored attribution but no live
    // claim this session. Without this, every field Haiku populated
    // before would re-appear as MANUAL on re-edit.
    const persisted = this.appliedProvenance[deviceIndex] ?? {};
    const formNow = this.deviceForms.at(deviceIndex);
    for (const [field, prov] of Object.entries(persisted)) {
      if (claims[field]?.length) continue;
      const cur = formNow?.get(field)?.value;
      if (cur == null || cur === '' || (Array.isArray(cur) && cur.length === 0)) {
        continue;
      }
      claims[field] = [
        {
          source: `${prov.source} (saved)`,
          value: cur,
          confidence: prov.confidence,
          at: prov.at,
        },
      ];
    }
    return claims;
  }

  /** Returns only the entries where ≥2 sources disagree (after
   *  normalisation: numbers rounded to 2dp, strings trimmed +
   *  lowercased). */
  getConflicts(
    deviceIndex: number,
  ): {
    [field: string]: Array<{ source: string; value: any; confidence: number; at?: string }>;
  } {
    const claims = this.collectExtractionClaims(deviceIndex);
    const out: typeof claims = {};
    for (const [field, list] of Object.entries(claims)) {
      if (list.length < 2) continue;
      // Detect "essentially same" pairs in long-text fields with
      // token-overlap (Jaccard) so paraphrases don't escalate:
      //   "Mikano 80 kVA + Victron Quattro 10 kVA battery inverter"
      //   "Mikano 80 kVA + 6× Victron Quattro 10 kVA battery inverters"
      // share 9/10 tokens — same description, just rephrased.
      // Same trick handles legal-name variants:
      //   "ENGIE Energy Access Nigeria Limited"
      //   "CrossBoundary Energy Access Nigeria Assets Limited"
      // share 4 tokens of 6/7 — recognise them as the same entity.
      const valuesAllSimilar = (vs: any[]): boolean => {
        for (let i = 0; i < vs.length; i++) {
          for (let j = i + 1; j < vs.length; j++) {
            if (!this.valuesEquivalent(vs[i], vs[j], field)) return false;
          }
        }
        return true;
      };
      if (valuesAllSimilar(list.map((c) => c.value))) continue;
      // Dedupe candidates that normalise to the same value (e.g.
      // "VN" + "Vietnam" both → "Vietnam" after the country
      // transform). Keep the highest-confidence representative;
      // the picker then shows one row per distinct value, not one
      // row per source repeating itself.
      const dedup: typeof list = [];
      for (const c of list) {
        const existing = dedup.find((d) =>
          this.valuesEquivalent(d.value, c.value, field),
        );
        if (!existing) {
          dedup.push(c);
        } else if (c.confidence > existing.confidence) {
          existing.source = c.source;
          existing.value = c.value;
          existing.confidence = c.confidence;
        }
      }
      out[field] = dedup;
    }
    return out;
  }

  /**
   * Free-text description fields where paraphrasing is genuinely
   * the same content (different word order, parenthetical asides,
   * count prefixes). Loose Jaccard match here. Legal-entity / name
   * fields stay strict — "ENGIE Energy Access" vs "CrossBoundary
   * Energy Access" might share tokens but ARE different entities.
   */
  private static readonly LOOSE_MATCH_FIELDS = new Set([
    'auxiliaryEnergySourceDetails',
    'impactStory',
    'address',
  ]);

  /**
   * "Essentially the same value" — handles type quirks (numbers vs
   * strings, arrays as sets). For free-text description fields
   * (LOOSE_MATCH_FIELDS) treats values as matching when their token
   * Jaccard similarity ≥ 0.6, so paraphrases don't escalate. All
   * other fields use strict equality after lowercase-trim.
   */
  private valuesEquivalent(a: any, b: any, field?: string): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (typeof a === 'number' && typeof b === 'number') {
      return Number(a.toFixed(2)) === Number(b.toFixed(2));
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      return String(a) === String(b);
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const sa = [...a].map(String).sort();
      const sb = [...b].map(String).sort();
      return JSON.stringify(sa) === JSON.stringify(sb);
    }
    // Country field: compare normalised forms so ISO codes ("VN") and
    // common short names ("Vietnam") match the canonical full name
    // ("Viet Nam"). Without this, the form-vs-doc conflict picker
    // surfaces a fake "Keep VN / Switch to: Viet Nam" choice that
    // the registrant shouldn't have to make — the form always wants
    // the full name and the ISO code is just a noisy extractor artifact.
    if (field === 'countryCodename') {
      const na = String(this.normalizeCountry(a) ?? '').trim().toLowerCase();
      const nb = String(this.normalizeCountry(b) ?? '').trim().toLowerCase();
      if (na && nb && na === nb) return true;
    }
    const sa = String(a).trim().toLowerCase();
    const sb = String(b).trim().toLowerCase();
    if (sa === sb) return true;
    if (
      !field ||
      !AddDevicesComponent.LOOSE_MATCH_FIELDS.has(field)
    ) {
      return false;
    }
    const tokenize = (s: string): Set<string> =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length >= 2),
      );
    const ta = tokenize(sa);
    const tb = tokenize(sb);
    if (!ta.size || !tb.size) return false;
    let overlap = 0;
    ta.forEach((t) => {
      if (tb.has(t)) overlap++;
    });
    const jaccard = overlap / (ta.size + tb.size - overlap);
    return jaccard >= 0.6;
  }

  hasConflicts(deviceIndex: number): boolean {
    return Object.keys(this.getConflicts(deviceIndex)).length > 0;
  }

  setConflictPick(
    deviceIndex: number,
    field: string,
    source: string,
  ): void {
    if (!this.conflictPicks[deviceIndex]) this.conflictPicks[deviceIndex] = {};
    this.conflictPicks[deviceIndex][field] = source;
  }

  isConflictPickSelected(
    deviceIndex: number,
    field: string,
    source: string,
    list: Array<{ source: string; confidence: number }>,
  ): boolean {
    const picked = this.conflictPicks[deviceIndex]?.[field];
    if (picked) return picked === source;
    // No explicit pick yet — default to highest-confidence claim.
    const top = [...list].sort((a, b) => b.confidence - a.confidence)[0];
    return top?.source === source;
  }

  /**
   * Build an HTML evidence-provenance report from the live form +
   * extractor state, then upload it to the device as an
   * EVIDENCE_PROVENANCE document. Reviewers see this inline in the
   * device-info-window so they know at a glance which form values
   * are document-backed (and from which document) vs hand-entered
   * by the registrant.
   *
   * Edit-mode only: needs a persisted device id to attach the doc.
   */
  /** Per-device hash of the last-uploaded provenance report's
   *  *content* (Generated timestamp stripped). Used to skip redundant
   *  uploads when the user clicks Update without anything changing. */
  private lastProvenanceContentHash: Record<number, string> = {};

  /** Per-device set of "extractor:fieldName" or "meterId:value" keys
   *  the user has UNTICKED in the Reading-documents conclusion. The
   *  apply paths consult this so e.g. a spurious meter-ID can be
   *  skipped without removing it from the form list later. */
  uncheckedExtractedFields: { [deviceIndex: number]: Set<string> } = {};

  isFieldChecked(deviceIndex: number, key: string): boolean {
    return !this.uncheckedExtractedFields[deviceIndex]?.has(key);
  }

  toggleFieldChecked(deviceIndex: number, key: string, checked: boolean): void {
    if (!this.uncheckedExtractedFields[deviceIndex]) {
      this.uncheckedExtractedFields[deviceIndex] = new Set();
    }
    if (checked) {
      this.uncheckedExtractedFields[deviceIndex].delete(key);
    } else {
      this.uncheckedExtractedFields[deviceIndex].add(key);
    }
  }

  /** Per-device map of `fieldName → { source, confidence, at }` recording
   *  which extractor (SLD / SF-02 / SF-02c / COD / Meter IDs / Geocoder /
   *  Impact-story / ...) populated each form value. Hydrated from
   *  `device.fieldProvenance` on edit and persisted back on submit so
   *  re-edits can distinguish doc-extracted values from manual ones —
   *  otherwise the conflict block sees an empty live-claims array and
   *  falsely tags every prior-session extraction as MANUAL. */
  appliedProvenance: {
    [deviceIndex: number]: Record<
      string,
      {
        source: string;
        confidence: number;
        at: string;
        value?: any;
        docId?: number;
        docName?: string;
        // For multi-value lists (serialNumber): per-value doc map so
        // each chip can show its specific source even when different
        // files contributed different IDs in the same batch.
        docsByValue?: Record<string, { id?: number; name: string }>;
        // Sibling map for human attestation — chips not covered by a
        // doc but personally vouched for by a registrant. Keyed by
        // chip value → email. Used so Attest doesn't clobber the
        // per-id doc attributions when only SOME chips lack a doc.
        personByValue?: Record<string, string>;
      }
    >;
  } = {};

  /** Per-chip source for the (14) Meter/Measurement IDs list.
   *  Returns the recorded source type + the specific file per chip,
   *  or null when no provenance covers that chip (Unattributed).
   *
   *  After migration 1780000000000 + the per-id docsByValue map
   *  introduced for fresh extractions, the invariant is: a chip is
   *  doc-backed iff its value appears in prov.docsByValue with a doc
   *  entry. No more "value-list match but no docsByValue → guess at
   *  primaryDoc" — that branch existed to tolerate the now-deleted
   *  backfill rows and would misattribute pre-existing chips. */
  meterIdSource(
    deviceIndex: number,
    value: string,
  ): { source: string; doc: { id?: number; name: string } } | null {
    const v = (value || '').trim();
    if (!v) return null;
    const prov = this.appliedProvenance[deviceIndex]?.['serialNumber'];
    if (!prov) return null;
    const doc = prov.docsByValue?.[v];
    if (!doc) return null;
    return { source: prov.source, doc };
  }

  /** Pre-submit review modal state. */
  presubmitIssues: {
    empty: Array<{ field: string; label: string }>;
    disagrees: Array<{
      field: string;
      label: string;
      current: any;
      candidates: Array<{ source: string; value: any }>;
    }>;
    unextracted: Array<{ field: string; label: string; via: string; value?: any }>;
  } = { empty: [], disagrees: [], unextracted: [] };

  /** Always-on sidebar issue tally. Computed on a debounced cadence
   *  so we're not re-walking the form on every keystroke. The
   *  registrant clicks a field name to jump to it. */
  liveIssues: {
    empty: Array<{ field: string; label: string }>;
    disagrees: Array<{
      field: string;
      label: string;
      current: any;
      candidates: Array<{ source: string; value: any }>;
    }>;
    unextracted: Array<{ field: string; label: string; via: string; value?: any }>;
  } = { empty: [], disagrees: [], unextracted: [] };

  /** Collapsed state for the sidebar — registrants who hate it can
   *  shrink it to a chip showing just the total count. */
  liveIssuesCollapsed = false;

  private liveIssuesTimer: ReturnType<typeof setTimeout> | null = null;
  /** Debounced re-tally of liveIssues — called from form value
   *  changes + apply paths + hydration. */
  refreshLiveIssues(): void {
    if (!this.isEditMode || !this.deviceForms.controls.length) return;
    if (this.liveIssuesTimer) clearTimeout(this.liveIssuesTimer);
    this.liveIssuesTimer = setTimeout(() => {
      this.liveIssuesTimer = null;
      try {
        this.liveIssues = this.collectPresubmitIssues(0);
      } catch {
        /* ignore — refresh on next event */
      }
    }, 300);
  }

  /** Wire Ctrl+wheel (or pinch on touch) to zoom the contents of any
   *  floating dialog. Each dialog tracks its own zoom on a CSS
   *  custom property so multiple open dialogs zoom independently. */
  private installFloatingDialogZoom(): void {
    if ((window as any).__drecFloatingDialogZoomInstalled) return;
    (window as any).__drecFloatingDialogZoomInstalled = true;
    document.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const pane = target.closest('.cdk-overlay-pane.drec-floating-dialog') as HTMLElement | null;
        if (!pane) return;
        e.preventDefault();
        const cur = parseFloat(
          getComputedStyle(pane).getPropertyValue('--drec-dialog-zoom') || '1',
        ) || 1;
        const next = Math.max(
          0.5,
          Math.min(2.5, cur * (e.deltaY < 0 ? 1.1 : 1 / 1.1)),
        );
        pane.style.setProperty('--drec-dialog-zoom', String(next));
      },
      { passive: false },
    );
    // Double-click reset on any drec-floating-dialog: Ctrl+double-click
    // resets zoom to 1. (Plain double-click is reserved for inner
    // controls like the SLD canvas's appImageZoomPan reset.)
    document.addEventListener('dblclick', (e: MouseEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const pane = target?.closest(
        '.cdk-overlay-pane.drec-floating-dialog',
      ) as HTMLElement | null;
      if (pane) pane.style.setProperty('--drec-dialog-zoom', '1');
    });
  }

  /** Hand-rolled resize for floating dialogs. Body-attached handle
   *  (position: fixed) that tracks the pane's bottom-right corner on
   *  every animation frame. Body-level so it can't be clipped or
   *  z-ordered behind the cdkDrag wrapper inside the pane. */
  private installFloatingDialogResize(): void {
    if ((window as any).__drecFloatingDialogResizeInstalled) return;
    (window as any).__drecFloatingDialogResizeInstalled = true;
    const handles = new WeakMap<HTMLElement, HTMLElement>();
    const tracked = new Set<HTMLElement>();

    const positionHandle = (pane: HTMLElement, handle: HTMLElement) => {
      const r = pane.getBoundingClientRect();
      handle.style.left = r.right - 20 + 'px';
      handle.style.top = r.bottom - 20 + 'px';
    };

    const attachHandle = (pane: HTMLElement) => {
      if (handles.has(pane)) return;
      const handle = document.createElement('div');
      handle.className = 'drec-resize-handle';
      handle.style.position = 'fixed';
      handle.style.zIndex = '10000';
      handle.title = 'Drag to resize';
      document.body.appendChild(handle);
      handles.set(pane, handle);
      tracked.add(pane);
      positionHandle(pane, handle);

      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = pane.getBoundingClientRect();
        const startW = rect.width;
        const startH = rect.height;
        const onMove = (ev: MouseEvent) => {
          const w = Math.max(320, startW + (ev.clientX - startX));
          const h = Math.max(240, startH + (ev.clientY - startY));
          pane.style.width = w + 'px';
          pane.style.height = h + 'px';
          positionHandle(pane, handle);
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove, true);
          window.removeEventListener('mouseup', onUp, true);
        };
        window.addEventListener('mousemove', onMove, true);
        window.addEventListener('mouseup', onUp, true);
      });
    };

    const tick = () => {
      for (const pane of tracked) {
        const handle = handles.get(pane);
        if (!handle) continue;
        if (!pane.isConnected) {
          handle.remove();
          tracked.delete(pane);
          continue;
        }
        positionHandle(pane, handle);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Scan everything currently in the DOM.
    const scan = () => {
      document
        .querySelectorAll('.cdk-overlay-pane.drec-floating-dialog')
        .forEach((p) => attachHandle(p as HTMLElement));
    };
    scan();
    // Observe document.body, not .cdk-overlay-container — the
    // container is created lazily by Material on the first dialog
    // open, so observing it at ngOnInit time hits a null and does
    // nothing forever. Body is always there.
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
    // Polling fallback in case the observer misses something (Angular
    // CDK has some attribute-only flows). 500ms idle scan is cheap.
    setInterval(scan, 500);
  }

  /* ---- OC# walkthrough ---- */
  ocWalkQueue: Array<{ field: string; oc: number; label: string }> = [];
  ocWalkIndex = 0;
  ocWalkOverride = '';
  /** True when the dialog is closed but state is preserved — registrant
   *  can resume from the same step later. Distinct from ocWalkQueue
   *  being empty (which means no walk has been started or it was
   *  explicitly quit). Persisted to localStorage so a page reload
   *  doesn't drop progress mid-walk. */
  ocWalkPaused = false;
  @ViewChild('ocWalkthroughDialog') ocWalkthroughDialog?: TemplateRef<any>;
  @ViewChild('ocWalkCanvas') ocWalkCanvasEl?: ElementRef<HTMLCanvasElement>;
  private ocWalkDialogRef: MatDialogRef<any> | null = null;
  /** Source-canvas size for bbox overlay positioning. */
  ocWalkCanvasSize: { cssWidth: number; cssHeight: number } | null = null;
  /** Region to draw on the OC# walk source canvas — pulled from the
   *  current step's appliedProvenance entry. */
  ocWalkCurrentRegion: { page?: number; x: number; y: number; w: number; h: number; approximate?: boolean } | null = null;
  /** "Scan around here" hints when the field has no precise bbox.
   *  Populated by a client-side Tesseract pass that matches tokens
   *  from the reasoning text against the rendered canvas. Rendered
   *  as soft yellow overlays distinct from the red precise-bbox. */
  ocWalkTextHints: Array<{ x: number; y: number; w: number; h: number }> = [];
  /** Self-check: did the field's own value (e.g. "415V") turn up in
   *  the PDF text layer on the current page? true = anchored, false
   *  = not found (Haiku inferred or hallucinated), null = not
   *  applicable (no value yet, image-only doc, or field skipped). */
  ocWalkValueFoundInText: boolean | null = null;
  /** If the own-value search found a hit on a DIFFERENT page than
   *  the one currently rendered, the page number lives here so the
   *  UI can offer a "jump to p.N" link. null = current page or no
   *  cross-page hit. */
  ocWalkValueFoundOnPage: number | null = null;

  /** Recorded sequence of the registrant's last walkthrough — one
   *  entry per Approve / Decline / Use-mine action. Persisted on
   *  the device record so a reviewer can replay it later. */
  ocWalkLog: Array<{
    at: string;              // ISO timestamp
    oc: number;
    field: string;
    label: string;
    action: 'approve' | 'decline' | 'fill_your_own' | 'skip';
    valueBefore: any;
    valueAfter: any;
    source: string | null;   // recorded provenance source AT THE TIME
    by: string;              // registrant email
  }> = [];
  /** Replay mode: when true, the same wizard dialog shows the recorded
   *  log instead of the live form, with no interactive Approve/Decline/
   *  Use-mine buttons. Reviewer view. */
  ocWalkReplay = false;
  ocWalkReplayIndex = 0;

  /** localStorage key for the paused-walk state. */
  private ocWalkStateKey(): string {
    const id =
      (this as any).editingDeviceId ??
      this.editingExternalId ??
      `draft:0`;
    return `drec.ocWalkState.${id}`;
  }
  /** Persist current walk state (queue + index) so a refresh resumes
   *  from the same step. Writes whenever a queue exists; deletes only
   *  when the walk is finished or explicitly quit. */
  private saveOcWalkState(): void {
    try {
      if (!this.ocWalkQueue.length) {
        localStorage.removeItem(this.ocWalkStateKey());
        return;
      }
      localStorage.setItem(
        this.ocWalkStateKey(),
        JSON.stringify({
          queue: this.ocWalkQueue,
          index: this.ocWalkIndex,
          paused: this.ocWalkPaused,
        }),
      );
    } catch {}
  }
  /** Hydrate paused-walk state on edit-load. Called from
   *  loadDeviceForEdit alongside the other localStorage hydrators. */
  loadOcWalkState(): void {
    try {
      const raw = localStorage.getItem(this.ocWalkStateKey());
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s?.queue) && typeof s?.index === 'number') {
        this.ocWalkQueue = s.queue;
        this.ocWalkIndex = Math.max(0, Math.min(s.index, s.queue.length - 1));
        this.ocWalkPaused = true;
      }
    } catch {}
  }

  /** Build the queue: every field whose FIELD_LABELS entry starts with
   *  "(N)" (i.e. has an OC#), sorted by OC#. Walks the registrant
   *  through each one, showing the current value + source + three
   *  actions: approve / decline / fill-your-own.
   *
   *  If a paused walk exists, resumes it instead of starting a fresh
   *  one. Pass force:true to restart from the top regardless. */
  startOcWalkthrough(opts?: { force?: boolean }): void {
    if (!opts?.force && this.ocWalkPaused && this.ocWalkQueue.length) {
      this.resumeOcWalkthrough();
      return;
    }
    const items: Array<{ field: string; oc: number; label: string }> = [];
    for (const [name, label] of Object.entries(AddDevicesComponent.FIELD_LABELS)) {
      const m = /^\((\d+)[a-z]?\)/.exec(label);
      if (!m) continue;
      const ctl = this.deviceForms.at(0)?.get(name);
      if (!ctl) continue;
      items.push({ field: name, oc: parseInt(m[1], 10), label });
    }
    items.sort((a, b) => a.oc - b.oc);
    if (!items.length) {
      this.toastrService.info('No OC# fields found on this form.');
      return;
    }
    this.ocWalkQueue = items;
    this.ocWalkIndex = 0;
    this.ocWalkOverride = '';
    this.ocWalkPaused = false;
    this.saveOcWalkState();
    this.openOcWalkDialog();
  }

  /** Re-open the dialog at the paused step. */
  resumeOcWalkthrough(): void {
    if (!this.ocWalkQueue.length) return;
    this.ocWalkPaused = false;
    this.saveOcWalkState();
    this.openOcWalkDialog();
  }

  /** Pause: close the dialog but keep queue + index alive. The button
   *  in the form footer flips to "Resume OC# walk (i / N)" so the
   *  user can pick up where they left off. */
  pauseOcWalkthrough(): void {
    if (!this.ocWalkQueue.length) return;
    this.ocWalkPaused = true;
    this.saveOcWalkState();
    this.ocWalkDialogRef?.close();
    this.ocWalkDialogRef = null;
  }

  /** Shared dialog-opener used by both fresh-start and resume. */
  private openOcWalkDialog(): void {
    if (!this.ocWalkthroughDialog) return;
    if (this.ocWalkDialogRef) { this.ocWalkDialogRef.close(); this.ocWalkDialogRef = null; }
    this.ocWalkDialogRef = this.dialog.open(this.ocWalkthroughDialog, {
      width: '720px', maxWidth: '95vw', disableClose: false,
      panelClass: 'drec-floating-dialog',
    });
    this.ocWalkDialogRef.afterClosed().subscribe(() => {
      if (this.ocWalkDialogRef) {
        // afterClosed fired but ref wasn't cleared by an explicit
        // handler — user dismissed. Pause unless we're already
        // mid-replay (which is fine to abandon).
        this.ocWalkDialogRef = null;
        if (this.ocWalkReplay) {
          this.ocWalkReplay = false;
          this.ocWalkReplayIndex = 0;
          return;
        }
        if (this.ocWalkQueue.length && this.ocWalkIndex < this.ocWalkQueue.length) {
          this.ocWalkPaused = true;
          this.saveOcWalkState();
        }
      }
    });
    this.primeOcWalkOverride();
  }

  get ocWalkCurrent(): { field: string; oc: number; label: string } | null {
    return this.ocWalkQueue[this.ocWalkIndex] ?? null;
  }

  /** Current form value display for the wizard header. */
  ocWalkCurrentValueDisplay(): string {
    const item = this.ocWalkCurrent;
    if (!item) return '';
    const v = this.deviceForms.at(0)?.get(item.field)?.value;
    if (v == null || v === '') return '(empty)';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }

  /** Source label for the current row, drawn from appliedProvenance. */
  ocWalkCurrentSource(): { source: string; docName?: string; verifiedBy?: string } | null {
    const item = this.ocWalkCurrent;
    if (!item) return null;
    const p = this.appliedProvenance[0]?.[item.field] as any;
    if (!p?.source) return null;
    return {
      source: p.source,
      docName: p.docName ?? undefined,
      verifiedBy: p.verifiedBy?.email ?? undefined,
    };
  }

  private primeOcWalkOverride(): void {
    const item = this.ocWalkCurrent;
    if (!item) { this.ocWalkOverride = ''; return; }
    const v = this.deviceForms.at(0)?.get(item.field)?.value;
    this.ocWalkOverride = v == null ? '' : String(v);
    // Reset page on step change so the next render starts from the
    // new step's region.page (or 1) instead of inheriting the last
    // step's flipped-to page.
    this.ocWalkCurrentPage = 1;
    this.ocWalkPageCount = 1;
    this.renderOcWalkSource();
  }

  /** Source File cached this session for the OC# walk current step,
   *  derived from the source label on the provenance entry. */
  private ocWalkSourceFile(): File | null {
    const key = this.ocWalkSourceKey();
    if (!key) return null;
    return (this as any)[key.fileMap][0] ?? null;
  }

  /** Resolve the current step's source label to a (fileMap, docType)
   *  pair used by both ocWalkSourceFile and the on-demand fetcher. */
  /** Form-field values for the literal-evidence fields a derived
   *  field rests on. Fed into Tesseract as additional keywords so a
   *  derived numeric ("60") can be pinned via the brand string
   *  ("HUAWEI SUN2000-30KTL-M3") which the OCR pass CAN find. */
  private relatedLiteralValuesFor(field: string): string[] {
    const RELATED: Record<string, string[]> = {
      capacity:             ['dataSourceBrand'],
      generatingUnitCount:  ['dataSourceBrand'],
      gridInterconnection:  ['networkOwner'],
      gridExportType:       ['networkOwner'],
      hasNetworkMeter:      ['networkOwner'],
    };
    const sources = RELATED[field] ?? [];
    const form = this.deviceForms.at(0);
    const out: string[] = [];
    for (const s of sources) {
      const v = form?.get(s)?.value;
      if (v != null && v !== '') out.push(String(v));
    }
    return out;
  }

  private ocWalkSourceKey(): { fileMap: string; docType: string } | null {
    const item = this.ocWalkCurrent;
    if (!item) return null;
    const p = this.appliedProvenance[0]?.[item.field] as any;
    const src: string = p?.source ?? '';
    if (src.startsWith('SLD')) return { fileMap: 'sldExtractionFile', docType: 'SINGLE_LINE_DIAGRAM' };
    if (src.startsWith('SF-02c')) return { fileMap: 'sf02cExtractionFile', docType: 'SF_02C' };
    if (src.startsWith('COD')) return { fileMap: 'codExtractionFile', docType: 'COD_PROOF' };
    if (src.startsWith('SF-02')) return { fileMap: 'sf02ExtractionFile', docType: 'FORM_SF_02' };
    return null;
  }

  /** Spinner state while fetching an attached doc on demand for the
   *  OC# walk source canvas. */
  ocWalkSourceLoading = false;

  /** If no cached File for the current source, fetch the first
   *  attached doc of the matching type from the server and stash it
   *  into the local cache slot. Returns the File (or null if no
   *  attachment of that type exists or fetch fails). */
  private async ensureOcWalkSourceFile(): Promise<File | null> {
    const cached = this.ocWalkSourceFile();
    if (cached) return cached;
    const key = this.ocWalkSourceKey();
    if (!key) return null;
    const docs = this.existingDocs[0]?.[key.docType] ?? [];
    if (!docs.length) return null;
    const doc = docs[0];
    this.ocWalkSourceLoading = true;
    try {
      const file = await this.fetchAttachedDocAsFile(doc);
      (this as any)[key.fileMap][0] = file;
      return file;
    } catch (err) {
      console.warn('ensureOcWalkSourceFile failed', err);
      return null;
    } finally {
      this.ocWalkSourceLoading = false;
    }
  }

  /** True when the current OC# step has any source doc to render
   *  (with or without a region). Template gates the canvas section
   *  on this — drops down to "doc preview only, no bbox" when the
   *  provenance lacks a region. */
  ocWalkHasSourceDoc = false;
  /** Human-readable error if the source render failed (file fetch
   *  404, non-renderable type, pdf.js threw, …). Shown inline so the
   *  user sees WHY the canvas is empty, not just a blank box. */
  ocWalkSourceError: string | null = null;

  /** Render the source doc behind the current OC# step into
   *  ocWalkCanvas, with the recorded region overlaid (if any). */
  private async renderOcWalkSource(): Promise<void> {
    this.ocWalkCurrentRegion = null;
    this.ocWalkTextHints = [];
    this.ocWalkCanvasSize = null;
    this.ocWalkHasSourceDoc = false;
    this.ocWalkSourceError = null;
    const item = this.ocWalkCurrent;
    if (!item) return;
    const p = this.appliedProvenance[0]?.[item.field] as any;
    if (!p?.source) return;
    if (p.region) this.ocWalkCurrentRegion = p.region;
    // Pre-flight: do we even have an attached doc of the matching
    // type? If not, don't flip the gate.
    const key = this.ocWalkSourceKey();
    const fileMap = key ? (this as any)[key.fileMap] : null;
    const cached = fileMap?.[0] as File | undefined;
    const attached = key ? (this.existingDocs[0]?.[key.docType] ?? []) : [];
    if (!cached && !attached.length) {
      // Doc-backed value but no doc on file (likely Manual:<email>
      // routed under a doc source label, or a stale provenance entry).
      return;
    }
    this.ocWalkHasSourceDoc = true;
    await new Promise((r) => setTimeout(r, 0));
    const canvas = this.ocWalkCanvasEl?.nativeElement;
    if (!canvas) {
      this.ocWalkSourceError = 'internal: canvas element missing';
      return;
    }
    const file = await this.ensureOcWalkSourceFile();
    if (!file) {
      this.ocWalkSourceError = 'failed to fetch the attached document';
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Initialise the per-step page state if we just landed on this
    // step. Subsequent Prev/Next clicks reuse it.
    if (this.ocWalkCurrentPage < 1) this.ocWalkCurrentPage = 1;
    // 3200px wide — high enough that zooming in via the appImage
    // -ZoomPan transform (up to 2.5x) keeps the SLD's tiny labels
    // legible. A1-sized plotter SLDs at 1600px were ~33 DPI which
    // got pixelated immediately on any zoom.
    const targetW = 3200;
    // Captured by the PDF branch so the text-layer search after
    // render has the page+viewport on hand.
    let ocWalkPdfPage: any = null;
    let ocWalkPdfViewport: any = null;
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pdfjs: any = await import('pdfjs-dist' as any);
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        this.ocWalkPageCount = pdf.numPages;
        // Default to region.page on first render of a step; the user's
        // explicit Prev/Next overrides this on subsequent renders.
        if (this.ocWalkCurrentPage === 1 && p.region?.page) {
          this.ocWalkCurrentPage = Math.min(p.region.page, pdf.numPages);
        }
        const page = Math.min(Math.max(1, this.ocWalkCurrentPage), pdf.numPages);
        this.ocWalkCurrentPage = page;
        const pdfPage = await pdf.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = targetW / viewport.width;
        const scaled = pdfPage.getViewport({ scale });
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        await pdfPage.render({ canvasContext: ctx, viewport: scaled }).promise;
        // Text-layer search: same path Firefox ctrl-F uses. For PDFs
        // with a text layer (most SLDs, all CODs) the brand string,
        // owner name, etc. are addressable directly — no OCR, no AI.
        ocWalkPdfPage = pdfPage;
        ocWalkPdfViewport = scaled;
      } else {
        const url = URL.createObjectURL(file);
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const el = new Image();
            el.onload = () => res(el);
            el.onerror = rej;
            el.src = url;
          });
          const scale = targetW / img.width;
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      requestAnimationFrame(() => {
        this.ocWalkCanvasSize = {
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
        };
      });
      // No model bbox? Try ctrl-F. For PDFs with a text layer the
      // related literal value (e.g. dataSourceBrand="HUAWEI
      // SUN2000-30KTL-M3") is addressable directly — no OCR, no AI.
      // Tesseract is only a fallback for image docs (PNG / scanned).
      this.ocWalkTextHints = [];
      this.ocWalkValueFoundInText = null;
      this.ocWalkValueFoundOnPage = null;
      if (!this.ocWalkCurrentRegion && canvas) {
        const ownValue = this.deviceForms.at(0)?.get(item.field)?.value;
        const ownStr = ownValue == null ? '' : String(ownValue);
        const related = this.relatedLiteralValuesFor(item.field);
        if (ocWalkPdfPage && ocWalkPdfViewport) {
          // Search the field's own value first — that's the "is
          // this real?" check. A hit proves the value is in the doc;
          // no hit means Haiku either inferred it or hallucinated.
          // minLen=3 so a short numeric value like "415" still
          // counts when its unit ("V") is positioned as a separate
          // text item in the PDF (common for unit suffixes).
          const ownHits = ownStr
            ? await this.findPdfTextHits(
                ocWalkPdfPage,
                ocWalkPdfViewport,
                [ownStr],
                this.ocWalkCurrentPage,
                { minLen: 3 },
              )
            : [];
          if (ownHits.length) {
            this.ocWalkValueFoundInText = true;
            this.ocWalkCurrentRegion = { ...ownHits[0] };
            this.ocWalkTextHints = ownHits.slice(1);
          } else if (ownStr) {
            // No hit on the current page — try every other page. If
            // one has the value, jump there directly and re-render
            // so the bbox lands on the hit page.
            let foundOnOther: number | null = null;
            if (this.ocWalkPageCount > 1) {
              try {
                const pdfjs: any = await import('pdfjs-dist' as any);
                const data = new Uint8Array(await file.arrayBuffer());
                const pdf = await pdfjs.getDocument({ data }).promise;
                for (let p = 1; p <= pdf.numPages; p++) {
                  if (p === this.ocWalkCurrentPage) continue;
                  const pg = await pdf.getPage(p);
                  const vp = pg.getViewport({ scale: 1 });
                  const otherHits = await this.findPdfTextHits(
                    pg, vp, [ownStr], p, { minLen: 3 },
                  );
                  if (otherHits.length) {
                    foundOnOther = p;
                    break;
                  }
                }
              } catch (e) {
                console.warn('cross-page own-value search failed', e);
              }
            }
            if (foundOnOther !== null) {
              // Navigate to the hit page; the re-render finds the
              // value on the (now current) page and bboxes it.
              this.ocWalkCurrentPage = foundOnOther;
              this.renderOcWalkSource();
              return;
            }
            this.ocWalkValueFoundInText = false;
          }
          // Related-field anchors — useful when the field's own value
          // is derived (capacity, count) and so isn't on the doc, but
          // related literals (brand, owner) ARE.
          if (!this.ocWalkCurrentRegion && related.length) {
            const hits = await this.findPdfTextHits(
              ocWalkPdfPage,
              ocWalkPdfViewport,
              related,
              this.ocWalkCurrentPage,
            );
            if (hits.length) {
              this.ocWalkCurrentRegion = { ...hits[0] };
              this.ocWalkTextHints = hits.slice(1);
            }
          }
          // Reasoning keywords — last resort for boolean / derived
          // fields whose value ("Yes") is uninformative and whose
          // related literals don't exist. e.g. (15) Grid-connected?:
          // Haiku's reasoning mentions "Grid tied solar Inverter
          // system" (from the title) — those tokens find the title
          // in the text layer.
          if (!this.ocWalkCurrentRegion) {
            const reasoning = String(p?.reasoning ?? '').trim();
            if (reasoning) {
              const hits = await this.findPdfTextHits(
                ocWalkPdfPage,
                ocWalkPdfViewport,
                [reasoning],
                this.ocWalkCurrentPage,
              );
              if (hits.length) {
                this.ocWalkCurrentRegion = { ...hits[0] };
                this.ocWalkTextHints = hits.slice(1);
              }
            }
          }
        }
        if (!this.ocWalkCurrentRegion && !ocWalkPdfPage) {
          // Image fallback: Tesseract over the rendered canvas.
          const reasoning = String(p?.reasoning ?? '').trim();
          const keywords = `${reasoning} ${related.join(' ')}`.trim();
          if (keywords) {
            try {
              const hits = await this.documentClassifier.findReasoningHints(
                canvas,
                keywords,
              );
              if (hits.length) {
                this.ocWalkCurrentRegion = { ...hits[0] };
                this.ocWalkTextHints = hits.slice(1);
              }
            } catch (e) {
              console.warn('OC walk Tesseract fallback failed', e);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('renderOcWalkSource failed', err);
      this.ocWalkSourceError = `render failed — ${err?.message ?? err}`;
    }
  }

  /** Append one entry to the walkthrough log. Captures the state the
   *  reviewer needs to reconstruct what the registrant saw and did. */
  private logOcWalkAction(
    item: { field: string; oc: number; label: string },
    action: 'approve' | 'decline' | 'fill_your_own' | 'skip',
    valueBefore: any,
    valueAfter: any,
  ): void {
    const p = this.appliedProvenance[0]?.[item.field] as any;
    this.ocWalkLog.push({
      at: new Date().toISOString(),
      oc: item.oc,
      field: item.field,
      label: item.label,
      action,
      valueBefore,
      valueAfter,
      source: p?.source ?? null,
      by: (this.user?.email ?? '').trim() || 'unknown',
    });
  }

  ocWalkApprove(): void {
    const item = this.ocWalkCurrent;
    if (!item) return;
    const ctl = this.deviceForms.at(0)?.get(item.field);
    const v = ctl?.value;
    if (v == null || v === '') {
      // Approving an empty value is meaningless — log as skip.
      this.logOcWalkAction(item, 'skip', v, v);
      this.ocWalkAdvance();
      return;
    }
    const email = (this.user?.email ?? '').trim() || 'unknown';
    const existing = this.appliedProvenance[0]?.[item.field] as any;
    if (!existing?.source) {
      this.recordProvenance(0, item.field, `Manual: ${email}`, 1, v);
    }
    const entry = this.appliedProvenance[0]?.[item.field] as any;
    if (entry) entry.verifiedBy = { email, at: new Date().toISOString() };
    this.logOcWalkAction(item, 'approve', v, v);
    this.ocWalkAdvance();
  }

  ocWalkDecline(): void {
    const item = this.ocWalkCurrent;
    if (!item) return;
    const ctl = this.deviceForms.at(0)?.get(item.field);
    const v = ctl?.value;
    if (v != null && v !== '') {
      this.dismissFieldValue(0, item.field, v);
      ctl?.setValue(Array.isArray(v) ? [] : null);
      ctl?.markAsDirty();
    }
    this.logOcWalkAction(item, 'decline', v, null);
    this.ocWalkAdvance();
  }

  ocWalkFillOwn(): void {
    const item = this.ocWalkCurrent;
    if (!item) return;
    const v = this.ocWalkOverride;
    const ctl = this.deviceForms.at(0)?.get(item.field);
    if (!ctl) { this.ocWalkAdvance(); return; }
    const before = ctl.value;
    const after = v === '' ? null : v;
    ctl.setValue(after);
    ctl.markAsDirty();
    if (after != null) {
      const email = (this.user?.email ?? '').trim() || 'unknown';
      this.recordProvenance(0, item.field, `Manual: ${email}`, 1, after);
      const entry = this.appliedProvenance[0]?.[item.field] as any;
      if (entry) entry.verifiedBy = { email, at: new Date().toISOString() };
    }
    this.logOcWalkAction(item, 'fill_your_own', before, after);
    this.ocWalkAdvance();
  }

  /** Open the wizard in replay mode for the reviewer. Same template,
   *  but ocWalkReplay=true hides the interactive buttons and steps
   *  through the recorded log instead of the live form. */
  startOcWalkReplay(): void {
    if (!this.ocWalkLog.length) {
      this.toastrService.info('No recorded walkthrough on this device yet.');
      return;
    }
    this.ocWalkReplay = true;
    this.ocWalkReplayIndex = 0;
    if (!this.ocWalkthroughDialog) return;
    if (this.ocWalkDialogRef) { this.ocWalkDialogRef.close(); this.ocWalkDialogRef = null; }
    this.ocWalkDialogRef = this.dialog.open(this.ocWalkthroughDialog, {
      width: '720px', maxWidth: '95vw', disableClose: false,
      panelClass: 'drec-floating-dialog',
    });
  }

  get ocWalkReplayCurrent(): typeof this.ocWalkLog[number] | null {
    return this.ocWalkLog[this.ocWalkReplayIndex] ?? null;
  }
  ocWalkReplayPrev(): void {
    if (this.ocWalkReplayIndex <= 0) return;
    this.ocWalkReplayIndex--;
  }
  ocWalkReplayNext(): void {
    if (this.ocWalkReplayIndex >= this.ocWalkLog.length - 1) {
      this.ocWalkClose();
      return;
    }
    this.ocWalkReplayIndex++;
  }

  ocWalkPrev(): void {
    if (this.ocWalkIndex <= 0) return;
    this.ocWalkIndex--;
    this.primeOcWalkOverride();
  }
  ocWalkNext(): void {
    if (this.ocWalkIndex >= this.ocWalkQueue.length - 1) {
      this.ocWalkClose();
      return;
    }
    this.ocWalkIndex++;
    this.primeOcWalkOverride();
  }
  private ocWalkAdvance(): void {
    this.ocWalkNext();
    this.saveOcWalkState();
  }
  ocWalkClose(): void {
    this.ocWalkDialogRef?.close();
    this.ocWalkDialogRef = null;
    this.ocWalkQueue = [];
    this.ocWalkIndex = 0;
    this.ocWalkOverride = '';
    this.ocWalkReplay = false;
    this.ocWalkReplayIndex = 0;
    this.ocWalkPaused = false;
    this.saveOcWalkState();
    this.refreshLiveIssues();
  }

  /** Explicit "quit" — abandon the walk. Discards queue and any
   *  paused-resume state. Distinct from pause/dismiss which preserves. */
  ocWalkQuit(): void {
    if (!confirm('Quit OC# walkthrough? Progress to here is kept (already-attested values stay attested), but the walk position will be lost.')) return;
    this.ocWalkClose();
  }

  /** Expand the live-issues sidebar if collapsed, scroll it into
   *  view, and pulse it briefly. Used by the inline "Resolve N
   *  disagreements" link next to the Submit button. */
  scrollToLiveIssues(): void {
    this.liveIssuesCollapsed = false;
    const el = document.querySelector('.live-issues');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('live-issues--flash');
    setTimeout(() => el.classList.remove('live-issues--flash'), 1600);
  }

  /** Resolve one row in the live-issues "disagrees" block. Called by
   *  the inline picker — user clicks "keep" on the Form row or
   *  "use this" on a doc row, the value lands in the form control
   *  and provenance is credited to the chosen source. */
  resolveDisagreement(field: string, value: any, source: string): void {
    const form = this.deviceForms.at(0);
    const ctl = form?.get(field);
    if (!ctl) return;
    ctl.setValue(value);
    ctl.markAsDirty();
    if (source === 'Form') {
      // Keep form value: credit the registrant as the verifier.
      const email = (this.user?.email ?? '').trim() || 'unknown';
      this.recordProvenance(0, field, `Manual: ${email}`, 1, value);
      const entry = this.appliedProvenance[0]?.[field];
      if (entry) {
        (entry as any).verifiedBy = { email, at: new Date().toISOString() };
      }
    } else {
      // Adopt doc value: credit the doc source. recordProvenance
      // uses 'Manual: <email>'-style strings for human attestation,
      // and bare source labels (SLD/SF-02c/COD/SF-02) for doc.
      this.recordProvenance(0, field, source, 0.9, value);
    }
    if (field === 'countryCodename') {
      // Pin against the geocoder so the user's explicit pick isn't
      // reverted on the next coord recompute.
      this.userPickedCountry[0] = true;
    }
    this.refreshLiveIssues();
  }

  liveIssueCount(): number {
    return (
      this.liveIssues.empty.length +
      this.liveIssues.disagrees.length +
      this.liveIssues.unextracted.length
    );
  }
  @ViewChild('presubmitDialog') presubmitDialog?: TemplateRef<any>;
  private presubmitDialogRef: MatDialogRef<any> | null = null;

  @ViewChild('evidenceReviewDialog') evidenceReviewDialog?: TemplateRef<any>;
  private evidenceReviewDialogRef: MatDialogRef<any> | null = null;

  /** Rows for the Review Evidence modal. Populated synchronously when
   *  the registrant clicks the button so the dialog opens with state
   *  matching the form at that instant. */
  evidenceRows: Array<{
    field: string;
    label: string;
    displayValue: string;
    source: string | null;
    confidence: number | null;
    docName: string | null;
    docUrl: string | null;
    /** Per-row "attest as me" toggle for no-subject rows. Drives the
     *  "Attest selected" action at the bottom. */
    attestSelected?: boolean;
    /** Attached docs that could plausibly cover this field — links the
     *  registrant can open to verify before attesting. Computed from
     *  DOC_FIELD_MAP ∩ existingDocs. Empty when no doc type maps to
     *  this field (free text like impactStory). */
    helpfulDocs?: Array<{ name: string; url?: string; docType: string }>;
  }> = [];

  evidenceSummary: { docBacked: number; unattributed: number; total: number } = {
    docBacked: 0,
    unattributed: 0,
    total: 0,
  };
  /** Drives the evidence-table data-attribute used by CSS to emphasise
   *  no-subject rows on hover/focus of the Flush or Attest button. */
  evidenceHoverAction: 'attest' | 'flush' | null = null;

  /** Credit a doc as the source for an orphan row. Called when the
   *  registrant has opened the doc, confirmed the value is in it,
   *  and clicks "credit". Writes a real fieldProvenance entry with
   *  the doc identity, verifiedBy stamped to the registrant. Updates
   *  the row in place so the dialog re-renders as cleanly-attributed. */
  creditValueToDoc(
    row: { field: string; displayValue: string; source: string | null; docName: string | null; helpfulDocs?: any },
    doc: { name: string; url?: string; docType: string },
  ): void {
    const i = 0;
    const ctl = this.deviceForms.at(i)?.get(row.field);
    const value = ctl ? ctl.value : row.displayValue;
    const source = `${doc.docType.replace(/_/g, ' ')} (registrant-credited)`;
    this.recordProvenance(i, row.field, source, 1, value, { name: doc.name });
    const email = (this.user?.email ?? '').trim() || 'unknown';
    const entry = this.appliedProvenance[i]?.[row.field];
    if (entry) {
      (entry as any).verifiedBy = { email, at: new Date().toISOString() };
    }
    // Update the in-memory row so the dialog re-renders without a
    // full close+reopen.
    row.source = source;
    row.docName = doc.name;
    row.helpfulDocs = undefined;
    this.evidenceSummary = {
      docBacked: this.evidenceRows.filter((r) => r.source).length,
      unattributed: this.evidenceRows.filter((r) => !r.source).length,
      total: this.evidenceRows.length,
    };
    this.unattributedFields = this.evidenceRows
      .filter((r) => !r.source)
      .map((r) => r.field);
    this.toastrService.success(`Credited ${doc.name} for ${row.field}.`);
  }

  /** Count of no-subject rows the user has ticked to attest. */
  attestSelectedCount(): number {
    return this.evidenceRows.filter((r) => !r.source && r.attestSelected).length;
  }

  /** Bulk select / clear of every no-subject row's attest checkbox. */
  toggleAllAttest(on: boolean): void {
    for (const r of this.evidenceRows) {
      if (!r.source) r.attestSelected = on;
    }
  }

  /** Attest only the rows the user has ticked. Same effect as the old
   *  attestUnattributed but scoped to the registrant's per-row choices
   *  — preserves rows they wanted to leave un-attested (e.g. ones
   *  they're still verifying via the helpful-docs links). */
  attestSelected(): void {
    const picked = this.evidenceRows
      .filter((r) => !r.source && r.attestSelected)
      .map((r) => r.field);
    if (!picked.length) {
      this.toastrService.info('Tick the rows you want to attest first.');
      return;
    }
    this.attestUnattributed({ keys: new Set(picked) });
  }

  /** Field names with no provenance entry (or sub-threshold) — used by
   *  the Flush Unattributed action to know what to clear. */
  unattributedFields: string[] = [];

  /** Clear every field listed in unattributedFields plus any chip-list
   *  values (serialNumber) whose individual provenance is missing.
   *  Destructive — confirm first. After clear, regenerate the evidence
   *  rows so the dialog reflects the post-flush state. */
  flushUnattributed(): void {
    const i = 0;
    const form = this.deviceForms.at(i) as FormGroup;
    if (!form) return;
    // Filter out synthetic "serialNumber:<chip>" entries — those are
    // handled by the orphanedSerials path below.
    const fields = this.unattributedFields.filter((f) => !f.includes(':'));
    const serialProv = this.appliedProvenance[i]?.['serialNumber'];
    const serials = this.serialNumberLists[i] ?? [];
    const orphanedSerials = serials.filter((s) => {
      const v = (s || '').trim();
      if (!v) return false;
      if (!serialProv || serialProv.value == null) return true;
      const list = String(serialProv.value)
        .split(';')
        .map((x) => x.trim().toLowerCase());
      return !list.includes(v.toLowerCase());
    });
    const total = fields.length + orphanedSerials.length;
    if (total === 0) {
      this.toastrService.info('Nothing to flush — all values have a source.');
      return;
    }
    const msg =
      `Clear ${total} unattributed value${total === 1 ? '' : 's'}?\n\n` +
      `Form fields: ${fields.length}\n` +
      `Meter ID chips: ${orphanedSerials.length}\n\n` +
      `This wipes any value the system has no source record for. ` +
      `You'll need to re-extract from a doc or type the values back.`;
    if (!confirm(msg)) return;
    for (const f of fields) {
      const ctl = form.get(f);
      if (!ctl) continue;
      ctl.setValue(Array.isArray(ctl.value) ? [] : null);
      ctl.markAsDirty();
    }
    if (orphanedSerials.length) {
      const kept = serials.filter((s) => !orphanedSerials.includes(s));
      this.serialNumberLists[i] = kept.length ? kept : [''];
      this.syncSerialNumberControl(i);
    }
    this.toastrService.success(
      `Flushed ${fields.length} field${fields.length === 1 ? '' : 's'} and ${orphanedSerials.length} meter ID${orphanedSerials.length === 1 ? '' : 's'}.`,
    );
    // Close-and-reopen so the dialog reflects the post-flush state
    // (the row builder reads from form + provenance, both just
    // changed). Without close+open the user sees stale rows.
    this.evidenceReviewDialogRef?.close();
    this.evidenceReviewDialogRef = null;
    setTimeout(() => this.openEvidenceReview(), 0);
  }

  /** Stamp every unattributed value with the current registrant as
   *  the source. The principle: a field must be attributed either by
   *  a document (extractor confidence ≥0.7 with docId/docName) OR by
   *  a named human taking responsibility. This action does the
   *  second — the registrant's email becomes the source label so
   *  the audit trail has a defensible "<user> attested this value
   *  on <date>" line for each previously-orphan entry. */
  attestUnattributed(scope?: { keys: Set<string> }): void {
    const i = 0;
    const form = this.deviceForms.at(i) as FormGroup;
    if (!form) return;
    const email = (this.user?.email ?? '').trim();
    if (!email) {
      this.toastrService.error(
        'No registrant email on this session — log out and back in.',
        'Cannot attest',
      );
      return;
    }
    let fields = this.unattributedFields.filter((f) => !f.includes(':'));
    if (scope) fields = fields.filter((f) => scope.keys.has(f));
    const serialProv = this.appliedProvenance[i]?.['serialNumber'];
    const serials = this.serialNumberLists[i] ?? [];
    let orphanedSerials = serials.filter((s) => {
      const v = (s || '').trim();
      if (!v) return false;
      if (!serialProv || serialProv.value == null) return true;
      const list = String(serialProv.value)
        .split(';')
        .map((x) => x.trim().toLowerCase());
      return !list.includes(v.toLowerCase());
    });
    if (scope) {
      orphanedSerials = orphanedSerials.filter((id) =>
        scope.keys.has(`serialNumber:${id}`),
      );
    }
    const total = fields.length + orphanedSerials.length;
    if (total === 0) {
      this.toastrService.info('Nothing to attest — every value has a source.');
      return;
    }
    const msg =
      `Attest ${total} unattributed value${total === 1 ? '' : 's'} as ${email}?\n\n` +
      `Form fields: ${fields.length}\n` +
      `Meter ID chips: ${orphanedSerials.length}\n\n` +
      `Your email + the current timestamp will be recorded as the source ` +
      `for each. You're confirming you personally verified these values.`;
    if (!confirm(msg)) return;
    const source = `Manual: ${email}`;
    for (const f of fields) {
      const ctl = form.get(f);
      if (!ctl) continue;
      this.recordProvenance(i, f, source, 1, ctl.value);
    }
    if (orphanedSerials.length) {
      // Mixed-attribution path: preserve any existing docsByValue
      // (doc-backed chips keep their photo source) AND promote any
      // pending extraction (meterIdsExtractionDocs) into docsByValue
      // — otherwise Attest would clobber 4 OCR-attributable chips
      // just because they hadn't been Applied yet. Person attestation
      // (Manual:<email>) goes into a sibling personByValue map,
      // covering only the chips that have NEITHER a doc nor a
      // previously-recorded human source.
      const allSerials = serials.filter((s) => (s || '').trim());
      const existingProv = this.appliedProvenance[i]?.['serialNumber'];
      const docsByValue: Record<string, { id?: number; name: string }> = {
        ...(existingProv?.docsByValue ?? {}),
        ...(this.meterIdsExtractionDocs[i] ?? {}),
      };
      const personByValue: Record<string, string> = {
        ...(existingProv?.personByValue ?? {}),
      };
      const orphans = allSerials.filter(
        (id) => !docsByValue[id] && !personByValue[id],
      );
      // When the caller passed a scope, only stamp the chips the user
      // actually ticked — leave the rest as orphans so they remain
      // visible on next dialog open.
      const toStamp = scope
        ? orphans.filter((id) => scope.keys.has(`serialNumber:${id}`))
        : orphans;
      for (const id of toStamp) personByValue[id] = email;
      // Source label: 'Meter IDs' when at least one chip is
      // doc-backed (the dominant attribution), else the Manual
      // label so single-source rendering stays sensible.
      const hasDocs = Object.keys(docsByValue).length > 0;
      const headlineSource = hasDocs ? 'Meter IDs' : source;
      const primaryDoc = hasDocs
        ? Object.values(docsByValue).find((d) => d?.name)
        : undefined;
      this.recordProvenance(
        i,
        'serialNumber',
        headlineSource,
        1,
        allSerials.join(';'),
        primaryDoc,
      );
      // Stash the per-value maps on the fresh provenance entry.
      const entry = this.appliedProvenance[i]?.['serialNumber'];
      if (entry) {
        if (Object.keys(docsByValue).length) entry.docsByValue = docsByValue;
        if (Object.keys(personByValue).length) entry.personByValue = personByValue;
      }
    }
    this.toastrService.success(
      `Attested ${fields.length} field${fields.length === 1 ? '' : 's'} ` +
        `${orphanedSerials.length ? `and ${orphanedSerials.length} meter ID${orphanedSerials.length === 1 ? '' : 's'} ` : ''}` +
        `as ${email}.`,
    );
    this.evidenceReviewDialogRef?.close();
    this.evidenceReviewDialogRef = null;
    setTimeout(() => this.openEvidenceReview(), 0);
  }

  /** Build evidence rows from the current form state + appliedProvenance
   *  and pop the dialog. Edit-mode only (button is hidden otherwise).
   *  Skips empty fields and a handful of plumbing controls the
   *  registrant doesn't think of as "evidence-worthy" (organizationId,
   *  countryCode, eSignature, document-type slots). */
  openEvidenceReview(): void {
    const i = 0;
    const form = this.deviceForms.at(i) as FormGroup;
    if (!form) return;
    const prov = this.appliedProvenance[i] ?? {};
    const skip = new Set([
      'organizationId',
      'countryCode',
      'eSignature',
      'SINGLE_LINE_DIAGRAM',
      'FORM_SF_02',
      'SF_02C',
      'COD_PROOF',
      'PROOF_OF_OWNERSHIP',
      'PROJECT_PHOTOS',
      'METERING_EVIDENCE',
      'OTHER_DOCUMENTS',
      'sf02EvidenceMode',
    ]);
    const isEmpty = (v: any): boolean =>
      v === null ||
      v === undefined ||
      v === '' ||
      (Array.isArray(v) && v.length === 0);
    const labelOf = (name: string) =>
      AddDevicesComponent.FIELD_LABELS[name] ??
      name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    const display = (v: any): string => {
      if (v == null) return '';
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    };
    // Reverse map: field name → set of doc types that could cover it.
    // Used to suggest attached docs alongside each no-subject row.
    const fieldToDocTypes: Record<string, string[]> = {};
    for (const [dt, fields] of Object.entries(AddDevicesComponent.DOC_FIELD_MAP)) {
      for (const f of fields) {
        if (!fieldToDocTypes[f]) fieldToDocTypes[f] = [];
        fieldToDocTypes[f].push(dt);
      }
    }
    const helpfulDocsFor = (field: string): Array<{ name: string; url?: string; docType: string }> => {
      const types = fieldToDocTypes[field] ?? [];
      const out: Array<{ name: string; url?: string; docType: string }> = [];
      for (const t of types) {
        const docs = this.existingDocs[i]?.[t] ?? [];
        for (const d of docs as any[]) {
          out.push({ name: d.name, url: d.url, docType: t });
        }
      }
      return out;
    };
    // Free, local re-attribution pass — for each orphan field, walk
    // cached extractor outputs (sld/sf02c/cod/sf02) and credit any
    // doc whose extracted value matches the form value verbatim.
    // Only positive hits write provenance; misses leave the orphan
    // alone (asymmetric: a miss is epistemically weak — the value
    // may be there but OCR-distorted, paraphrased, or in a region
    // the extractor didn't read).
    const valueEq = (a: any, b: any): boolean => {
      if (a == null || b == null) return false;
      return (
        String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
      );
    };
    const cachedExtractions: Array<{ source: string; doc: any; fx: any }> = [];
    if (this.sldExtractions[i]) {
      cachedExtractions.push({
        source: 'SLD',
        doc: this.sldExtractionDoc[i] ?? null,
        fx: this.sldExtractions[i],
      });
    }
    if (this.sf02cExtractions[i]) {
      cachedExtractions.push({
        source: 'SF-02c',
        doc: this.sf02cExtractionDoc[i] ?? null,
        fx: this.sf02cExtractions[i],
      });
    }
    if (this.codExtractions[i]) {
      cachedExtractions.push({
        source: 'COD',
        doc: this.codExtractionDoc[i] ?? null,
        fx: this.codExtractions[i],
      });
    }
    if (this.sf02Extractions[i]) {
      cachedExtractions.push({
        source: 'SF-02',
        doc: this.sf02ExtractionDoc[i] ?? null,
        fx: this.sf02Extractions[i],
      });
    }
    // Field-name aliasing between form and extractor outputs (e.g.
    // SLD calls it acCapacityKw, form calls it capacity).
    const FORM_TO_FX_KEYS: Record<string, string[]> = {
      capacity: ['acCapacityKw'],
      generatingUnitCount: ['inverterCount'],
      interconnectionVoltage: ['gridVoltage'],
      dataSourceBrand: ['inverterMakeModel'],
      siteName: ['projectName', 'facilityName'],
      pvSystemOwner: ['ownerLegalName', 'ownerName'],
      pvSystemOwnerAddress: ['ownerAddress'],
      countryCodename: ['ownerCountry', 'country'],
      address: ['ownerAddress', 'facilityName'],
    };
    const matchCachedSource = (
      field: string,
      value: any,
    ): { source: string; doc: any; confidence: number } | null => {
      const candidates = [field, ...(FORM_TO_FX_KEYS[field] ?? [])];
      for (const ce of cachedExtractions) {
        for (const k of candidates) {
          const ef = ce.fx?.[k];
          if (ef?.value != null && valueEq(ef.value, value)) {
            return { source: ce.source, doc: ce.doc, confidence: ef.confidence ?? 0.9 };
          }
        }
      }
      return null;
    };
    const rows: typeof this.evidenceRows = [];
    for (const name of Object.keys(form.controls)) {
      if (skip.has(name)) continue;
      const ctl = form.get(name);
      if (!ctl) continue;
      const v = ctl.value;
      if (isEmpty(v)) continue;
      let p = prov[name];
      let hasSource = !!p?.source;
      // If orphan + a cached extractor saw this exact value: credit
      // it now. Writes to appliedProvenance so the next reload reads
      // it as cleanly-attributed too.
      if (!hasSource) {
        const m = matchCachedSource(name, v);
        if (m) {
          this.recordProvenance(
            i,
            name,
            m.source,
            m.confidence,
            v,
            m.doc ?? undefined,
          );
          p = prov[name];
          hasSource = !!p?.source;
        }
      }
      rows.push({
        field: name,
        label: labelOf(name),
        displayValue: display(v),
        source: p?.source ?? null,
        confidence: p?.confidence ?? null,
        docName: p?.docName ?? null,
        docUrl: null,
        attestSelected: false,
        helpfulDocs: hasSource ? undefined : helpfulDocsFor(name),
      });
    }
    // Surface orphan serial chips as their own rows — a serial chip
    // is independently no-subject when its specific value isn't
    // covered by the provenance.value list (or there's no provenance
    // at all). Showing them as rows makes the "N highlighted" count
    // match what the registrant actually sees in the table.
    const serialProv = this.appliedProvenance[i]?.['serialNumber'];
    const serials = this.serialNumberLists[i] ?? [];
    const orphanChips: string[] = serials.filter((s) => {
      const v = (s || '').trim();
      if (!v) return false;
      if (!serialProv || serialProv.value == null) return true;
      const list = String(serialProv.value)
        .split(';')
        .map((x) => x.trim().toLowerCase());
      return !list.includes(v.toLowerCase());
    });
    for (const chip of orphanChips) {
      rows.push({
        field: `serialNumber:${chip}`,
        label: '(14) Serial number',
        displayValue: chip,
        source: null,
        confidence: null,
        docName: null,
        docUrl: null,
        attestSelected: false,
        helpfulDocs: helpfulDocsFor('serialNumber'),
      });
    }
    const orphanChipCount = orphanChips.length;
    rows.sort((a, b) => {
      // Doc-backed first, then manual — registrant skims sources, eyes
      // settle on the Manual block to verify there's nothing dodgy.
      const ad = a.source ? 0 : 1;
      const bd = b.source ? 0 : 1;
      return ad !== bd ? ad - bd : a.label.localeCompare(b.label);
    });
    this.evidenceRows = rows;
    // Orphan chips are now their own rows in the table; the
    // serialNumber field row itself only stays if there's a chip with
    // attribution. Drop the duplicate serialNumber-field row when
    // every chip is orphaned (one row + N chip-rows would read as
    // N+1 no-subjects).
    if (
      orphanChipCount > 0 &&
      orphanChipCount === serials.filter((s) => (s || '').trim()).length
    ) {
      this.evidenceRows = rows.filter(
        (r) => !(r.field === 'serialNumber' && !r.source),
      );
    }
    this.evidenceSummary = {
      docBacked: this.evidenceRows.filter((r) => r.source).length,
      unattributed: this.evidenceRows.filter((r) => !r.source).length,
      total: this.evidenceRows.length,
    };
    // Stash the unattributed field list for the flush action. Includes
    // synthetic "serialNumber:<chip>" entries so flush/attest can act
    // on individual chips, not just the field row.
    this.unattributedFields = this.evidenceRows.filter((r) => !r.source).map((r) => r.field);
    if (!this.evidenceReviewDialog) return;
    this.evidenceReviewDialogRef = this.dialog.open(
      this.evidenceReviewDialog,
      { width: '780px', maxWidth: '95vw', panelClass: 'drec-floating-dialog' },
    );
  }
  /** Set to true when the registrant clicks "Submit anyway" so the
   *  next submitEdit re-entry skips the issues check. */
  presubmitOverride = false;

  /** Hide the four non-OC# legacy form fields (registrationType,
   *  volumeEvidenceType, verificationAgentName, offGridCircumstances)
   *  behind a collapsed expander so they don't distract registrants
   *  doing the normal flow. They're scheduled for removal in Phase 3
   *  once the SF-02 generator path exists. */
  legacyExpanded = false;

  /** Which form fields each attached doc could populate. Drives the
   *  "unextracted" list — if a doc is present but the corresponding
   *  field is empty/manual, surface it as something to extract. */
  private static readonly DOC_FIELD_MAP: Record<string, string[]> = {
    SINGLE_LINE_DIAGRAM: [
      'capacity',
      'generatingUnitCount',
      'interconnectionVoltage',
      'gridInterconnection',
      'gridExportType',
      'hasNetworkMeter',
      'hasAuxiliaryEnergySources',
      'auxiliaryEnergySourceDetails',
      'dataSourceBrand',
      'networkOwner',
      // SLDs typically carry the site location (project name / address
      // block) so they DO cover form field (16) Address. Surface the
      // SLD link in the evidence-review dialog for that row.
      'address',
    ],
    FORM_SF_02: [
      'siteName',
      'capacity',
      'commissioningDate',
      'deviceTypeCode',
      'pvSystemOwner',
      'pvSystemOwnerAddress',
      'address',
      'latitude',
      'longitude',
      'generatingUnitCount',
      'networkOwner',
    ],
    SF_02C: [
      'siteName',
      'pvSystemOwner',
      'pvSystemOwnerAddress',
      'countryCodename',
      'signatoryName',
    ],
    COD_PROOF: ['commissioningDate', 'siteName', 'capacity', 'pvSystemOwner', 'address'],
    METERING_EVIDENCE: ['serialNumber', 'dataSourceBrand'],
  };

  /** Friendly doc-type names for the unextracted list. */
  // Must match the `source` strings used in collectExtractionClaims
  // — claims[field].find(c => c.source === friendly) is how the
  // unextracted list looks up the actual extracted value.
  private static readonly DOC_FRIENDLY: Record<string, string> = {
    SINGLE_LINE_DIAGRAM: 'SLD',
    FORM_SF_02: 'SF-02',
    SF_02C: 'SF-02c',
    COD_PROOF: 'COD',
    METERING_EVIDENCE: 'Metering evidence',
  };

  private collectPresubmitIssues(deviceIndex: number): {
    empty: Array<{ field: string; label: string }>;
    disagrees: Array<{
      field: string;
      label: string;
      current: any;
      candidates: Array<{ source: string; value: any }>;
    }>;
    unextracted: Array<{ field: string; label: string; via: string; value?: any }>;
  } {
    const form = this.deviceForms.at(deviceIndex) as FormGroup;
    const labelOf = (name: string) =>
      AddDevicesComponent.FIELD_LABELS[name] ??
      name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    const isEmpty = (v: any): boolean =>
      v === null ||
      v === undefined ||
      v === '' ||
      (Array.isArray(v) && v.length === 0);

    // (a) empty required fields — walk controls flagged required
    const empty: Array<{ field: string; label: string }> = [];
    for (const name of Object.keys(form.controls)) {
      const ctl = form.get(name);
      if (!ctl) continue;
      const required = ctl.errors?.['required'];
      if (required && isEmpty(ctl.value)) {
        empty.push({ field: name, label: labelOf(name) });
      }
    }

    // (b) doc-vs-form disagreements — reuse collectFormVsDocConflicts.
    // Carry the candidates through so the modal / sidebar can show
    // *what* the docs say, not just *that* there's a disagreement.
    const disagrees = this
      .collectFormVsDocConflicts(deviceIndex)
      .map((c) => ({
        field: c.name,
        label: c.label,
        current: c.current,
        candidates: c.candidates.map((k) => ({
          source: k.source,
          value: k.value,
        })),
      }));

    // (c) unextracted: doc is attached but a field that doc could
    //     populate is empty AND has no provenance entry yet.
    const provenance = this.appliedProvenance[deviceIndex] ?? {};
    const docs = this.existingDocs[deviceIndex] ?? {};
    const claims = this.collectExtractionClaims(deviceIndex);
    const seenFields = new Set<string>();
    const unextracted: Array<{ field: string; label: string; via: string; value?: any }> = [];
    // Surface the extractor's actual value (if any) next to the
    // source name so the registrant sees WHAT the doc says, not just
    // WHICH doc could fill the field.
    for (const [docType, fields] of Object.entries(
      AddDevicesComponent.DOC_FIELD_MAP,
    )) {
      if (!(docs as any)[docType]?.length) continue;
      const friendly = AddDevicesComponent.DOC_FRIENDLY[docType] ?? docType;
      for (const f of fields) {
        if (seenFields.has(f)) continue;
        const cur = form.get(f)?.value;
        if (!isEmpty(cur)) continue;
        if (provenance[f]) continue;
        const claim = claims[f]?.find((c) => c.source === friendly);
        // Only surface as extractable if the extractor actually has
        // a real applicable value for the registrant to apply.
        // Suppress when:
        //   - no claim at all (extractor didn't return this field)
        //   - claim value is null / empty / "n/a"-like sentinel
        // In all those cases there's no actionable value to one-click
        // apply, so the entry would be noise.
        if (!claim) {
          seenFields.add(f);
          continue;
        }
        const v = claim.value;
        const sentinel =
          v == null ||
          v === '' ||
          (typeof v === 'string' && /^n\/?a$/i.test(v.trim()));
        if (sentinel) {
          seenFields.add(f);
          continue;
        }
        seenFields.add(f);
        unextracted.push({ field: f, label: labelOf(f), via: friendly, value: v });
      }
    }

    return { empty, disagrees, unextracted };
  }

  private openPresubmitDialog(issues: ReturnType<typeof this.collectPresubmitIssues>): void {
    this.presubmitIssues = issues;
    this.isSubmitting = false;
    this.submitButtonText = 'Submit';
    this.presubmitDialogRef = this.dialog.open(this.presubmitDialog!, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'drec-floating-dialog',
    });
  }

  /** Registrant clicks "Submit anyway" — close the modal, set the
   *  override flag, and re-enter submitEdit which will skip the
   *  pre-submit check this time. */
  submitAnyway(): void {
    this.presubmitOverride = true;
    this.presubmitDialogRef?.close();
    this.presubmitDialogRef = null;
    this.isSubmitting = true;
    this.submitEdit();
  }

  /** Render the current presubmit issues as plain text and drop them
   *  on the clipboard. Useful when the registrant has to forward the
   *  fix list to whoever produced the offending document. */
  copyPresubmitReport(): void {
    const issues = this.presubmitIssues;
    const lines: string[] = [];
    const siteName = this.deviceForms.at(0)?.get('siteName')?.value || '(unnamed device)';
    lines.push(`Pre-submit checklist — ${siteName}`);
    lines.push('');
    if (issues.empty.length) {
      lines.push(`${issues.empty.length} required field${issues.empty.length === 1 ? '' : 's'} empty:`);
      for (const e of issues.empty) lines.push(`  - ${e.label}`);
      lines.push('');
    }
    if (issues.unextracted.length) {
      lines.push(`${issues.unextracted.length} field${issues.unextracted.length === 1 ? '' : 's'} look extractable from attached documents:`);
      for (const u of issues.unextracted) {
        const v = u.value === undefined || u.value === null || u.value === '' ? '' : `: ${u.value}`;
        lines.push(`  - ${u.label} (via ${u.via})${v}`);
      }
      lines.push('');
    }
    const text = lines.join('\n').trimEnd();
    navigator.clipboard.writeText(text).then(
      () => this.toastrService.success('Pre-submit checklist copied to clipboard'),
      () => this.toastrService.error('Copy failed — clipboard access denied'),
    );
  }

  /** Cancel the modal and stay on the form so the registrant can fix
   *  the issues. */
  cancelPresubmit(): void {
    this.presubmitDialogRef?.close();
    this.presubmitDialogRef = null;
    this.isSubmitting = false;
  }

  jumpToFormField(field: string): void {
    this.cancelPresubmit();
    setTimeout(() => this.jumpToField(field), 50);
  }

  /** Open reviewer notes for the device — pulled from the device's
   *  chat (kind='note', status='open'). The template renders these
   *  inline as the per-field feedback banner. */
  openReviewNotes(): ChatMessage[] {
    const all = this.chatService.messages$.value ?? [];
    return all.filter((m) => m.kind === 'note' && m.status === 'open');
  }

  /** Per-input "what the doc says" hint. Walks the live extraction
   *  results for the field; returns the highest-confidence claim
   *  that's NOT the synthetic Current/(saved) entry, plus a doc URL
   *  to jump to. Renders under the input so the registrant sees
   *  what their attached doc reports next to what they typed. */
  extractorHintFor(
    deviceIndex: number,
    field: string,
  ): {
    source: string;
    value: any;
    url: string | null;
    confidence: number | null;
    /** True when the extracted value didn't make it onto the form
     *  because confidence was below the 0.7 auto-apply threshold. The
     *  template uses this to give the chip a more informative tooltip. */
    lowConfidence: boolean;
  } | null {
    const collect = (): Array<{ source: string; value: any; confidence: number }> => {
      const out: Array<{ source: string; value: any; confidence: number }> = [];
      const sld = this.sldExtractions[deviceIndex];
      const sf02c = this.sf02cExtractions[deviceIndex];
      const cod = this.codExtractions[deviceIndex];
      const sf02 = this.sf02Extractions[deviceIndex];
      // Map form-field → which extractor field on each doc.
      const sldFieldMap: Record<string, string> = {
        capacity: 'acCapacityKw',
        generatingUnitCount: 'inverterCount',
        interconnectionVoltage: 'gridVoltage',
        gridInterconnection: 'gridTied',
        dataSourceBrand: 'inverterMakeModel',
        networkOwner: 'networkOwner',
        hasNetworkMeter: 'hasNetworkMeter',
        gridExportType: 'gridExportType',
        hasAuxiliaryEnergySources: 'hasAuxiliaryEnergySources',
        auxiliaryEnergySourceDetails: 'auxiliaryEnergySourceDetails',
      };
      const sf02cFieldMap: Record<string, string> = {
        siteName: 'projectName',
        pvSystemOwner: 'ownerLegalName',
        pvSystemOwnerAddress: 'ownerAddress',
        countryCodename: 'ownerCountry',
        signatoryName: 'signatoryName',
      };
      const codFieldMap: Record<string, string> = {
        commissioningDate: 'commissioningDate',
        siteName: 'facilityName',
        capacity: 'acCapacityKw',
        pvSystemOwner: 'ownerName',
      };
      const sf02FieldMap: Record<string, string> = {
        siteName: 'facilityName',
        capacity: 'acCapacityKw',
        commissioningDate: 'commissioningDate',
        deviceTypeCode: 'deviceTypeCode',
        pvSystemOwner: 'ownerLegalName',
        pvSystemOwnerAddress: 'ownerAddress',
        countryCodename: 'ownerCountry',
        latitude: 'latitude',
        longitude: 'longitude',
        generatingUnitCount: 'inverterCount',
        networkOwner: 'networkOwner',
      };
      const push = (
        source: string,
        fx: any,
        key: string | undefined,
      ): void => {
        if (!fx || !key) return;
        const c = fx[key];
        if (!c || c.value == null || c.value === '') return;
        out.push({
          source,
          value: c.value,
          confidence: c.confidence ?? 0.5,
        });
      };
      push('SLD', sld, sldFieldMap[field]);
      push('SF-02c', sf02c, sf02cFieldMap[field]);
      push('COD', cod, codFieldMap[field]);
      push('SF-02', sf02, sf02FieldMap[field]);
      return out;
    };
    const candidates = collect();
    const docTypeBySource: Record<string, string> = {
      SLD: 'SINGLE_LINE_DIAGRAM',
      'SF-02c': 'SF_02C',
      'SF-02': 'FORM_SF_02',
      COD: 'COD_PROOF',
    };
    if (candidates.length) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0];
      const docType = docTypeBySource[best.source];
      const url =
        (this.existingDocs[deviceIndex]?.[docType]?.[0] as any)?.url ?? null;
      return {
        source: best.source,
        value: best.value,
        url,
        confidence: best.confidence,
        lowConfidence: best.confidence < 0.7,
      };
    }
    // Fallback: no live extraction this session, but the registrant's
    // last save persisted a value into field_provenance — show that
    // so hints hydrate on edit-page open without re-running Haiku.
    const persisted = this.appliedProvenance[deviceIndex]?.[field];
    if (persisted?.value !== undefined && persisted.value !== null) {
      // Source labels can carry " (backfill)" / " (saved)" suffixes;
      // strip for a cleaner pill, but only when looking up the doc URL.
      const rawSource = persisted.source.replace(
        /\s*\((?:backfill|saved)\)\s*$/i,
        '',
      );
      const docType = docTypeBySource[rawSource];
      const url =
        (this.existingDocs[deviceIndex]?.[docType]?.[0] as any)?.url ?? null;
      return {
        source: persisted.source,
        value: persisted.value,
        url,
        confidence: persisted.confidence ?? null,
        lowConfidence: (persisted.confidence ?? 1) < 0.7,
      };
    }
    return null;
  }

  /** Click the hint → open the doc in a new tab. Signed URL was
   *  produced when the page loaded; for short-lived devices we just
   *  let the browser request it directly. */
  openHintDoc(url: string | null): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  /** Registrant clicks "Go to field" — scroll the form control into
   *  view and pulse an amber halo around it so it's obvious which
   *  row to fix. The halo goes on the wrapping mat-form-field (or
   *  the closest col-md-* container) so it actually frames the
   *  visible control instead of just the raw <input> deep inside
   *  Material's DOM. */
  jumpToField(field: string | null): void {
    if (!field) return;
    const ctl = document.querySelector<HTMLElement>(
      `[formControlName="${field}"]`,
    );
    if (!ctl) return;
    const target =
      ctl.closest<HTMLElement>('.mat-mdc-form-field') ??
      ctl.closest<HTMLElement>('[class*="col-md-"]') ??
      ctl;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Remove first so re-clicking the same field restarts the
    // animation instead of being a no-op.
    target.classList.remove('field--flash');
    // Force reflow so the next class add starts a fresh animation.
    void target.offsetWidth;
    target.classList.add('field--flash');
    setTimeout(() => target.classList.remove('field--flash'), 2200);
  }

  /** After a registrant submit, if there were open reviewer notes on
   *  this device, post a system message to the device's chat so the
   *  reviewer gets a concrete "I addressed this — please re-check"
   *  ping. No-op when there are no open notes (no need to noise the
   *  reviewer when nothing was flagged). */
  private notifyReviewerOfUpdate(siteLabel: string): void {
    const openCount = this.openReviewNotes().length;
    if (openCount === 0) return;
    const siteName =
      (this.deviceForms.at(0)?.get('siteName')?.value as string | null) ??
      this.initSiteName ??
      siteLabel;
    if (!siteName) return;
    const me = this.user?.email ?? '';
    if (!me) return;
    const body = `Registrant updated the device — please re-check ${openCount} open note${openCount === 1 ? '' : 's'}.`;
    this.chatService
      .getConversation(undefined, undefined, siteName)
      .subscribe({
        next: (conv) => {
          if (!conv) return; // no chat means no reviewer note path either
          this.chatService
            .postToConversation(conv.id, me, body, {
              kind: 'system',
              payload: { action: 'registrant-updated', openNoteCount: openCount },
            })
            .subscribe({
              error: (err) =>
                console.warn('[chat] notify reviewer failed', err),
            });
        },
        error: (err) =>
          console.warn('[chat] lookup conv for notify failed', err),
      });
  }

  /** Open the chat panel so the registrant can reply to a specific
   *  reviewer note. Wires openForDevice$ with (admin email, siteName)
   *  the same way the My-Devices page does — without that the
   *  chat-window component never learns its partner email and
   *  silently drops the registrant's send() calls. */
  replyToReviewNote(_note: ChatMessage): void {
    const siteName =
      (this.deviceForms.at(0)?.get('siteName')?.value as string | null) ??
      this.initSiteName ??
      '';
    this.chatService.getAdminUser().subscribe({
      next: (admin) => {
        if (!admin?.email) return;
        this.chatService.siteName$.next(siteName);
        this.chatService.openForDevice$.next({
          submitterEmail: admin.email,
          siteName,
        });
        if (!this.chatService.isChatOpen$.value) {
          this.chatService.isChatOpen$.next(true);
        }
      },
      error: (err) =>
        console.error('Could not get admin user for chat', err),
    });
  }

  /** Human label for a note's anchor — mirrors FIELD_LABELS so the
   *  registrant sees the same numbering the reviewer typed against. */
  labelForNoteField(field: string | null): string {
    if (!field) return 'General';
    return (
      AddDevicesComponent.FIELD_LABELS[field] ??
      field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
    );
  }

  recordProvenance(
    deviceIndex: number,
    field: string,
    source: string,
    confidence: number,
    value?: any,
    doc?: { id?: number; name?: string },
  ): void {
    if (!this.appliedProvenance[deviceIndex]) {
      this.appliedProvenance[deviceIndex] = {};
    }
    this.appliedProvenance[deviceIndex][field] = {
      source,
      confidence,
      at: new Date().toISOString(),
      // Storing the extracted value alongside the source label lets
      // edit-page hints hydrate without re-running extractors. Older
      // entries from before this commit won't have a value; the hint
      // helper falls through cleanly when value is undefined.
      ...(value !== undefined ? { value } : {}),
      // Doc identity — when present, lets the UI show "from
      // atsawa_sld.pdf" instead of the bare source type "SLD" and
      // makes the badge a one-click link to that exact file.
      // Persists into device.field_provenance so the source survives
      // reload and downstream consumers (OC checklist, audit export,
      // evidence-review dialog) can all link back to the same doc.
      ...(doc?.id != null ? { docId: doc.id } : {}),
      ...(doc?.name ? { docName: doc.name } : {}),
    };
  }

  /** If the persisted fieldProvenance has entries newer than the most
   *  recent EVIDENCE_PROVENANCE document, regenerate the report so it
   *  reflects the latest state. Runs on edit-page load after
   *  appliedProvenance + existingDocs are both hydrated, so a
   *  server-side backfill (or any out-of-band field_provenance update)
   *  surfaces in the report without requiring a manual Save.
   *
   *  Skips silently if: no provenance entries at all, no existing
   *  report and no provenance to put in one, or report is already
   *  current. */
  private maybeAutoRegenerateProvenanceReport(deviceIndex: number): void {
    if (!this.editingDeviceId) return;
    if (this.isGeneratingProvenance[deviceIndex]) return;
    const persisted = this.appliedProvenance[deviceIndex] ?? {};
    const timestamps = Object.values(persisted)
      .map((p) => (p as any)?.at)
      .filter((t): t is string => typeof t === 'string')
      .map((t) => new Date(t).getTime())
      .filter((n) => Number.isFinite(n) && n > 0);
    if (timestamps.length === 0) return;
    const newestProvenanceAt = Math.max(...timestamps);

    const existing =
      this.existingDocs[deviceIndex]?.['EVIDENCE_PROVENANCE'] ?? [];
    const newestReportAt = existing
      .map((d) => (d.createdAt ? new Date(d.createdAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);

    if (newestReportAt >= newestProvenanceAt) return;

    this.generateProvenanceReport(deviceIndex);
  }

  generateProvenanceReport(deviceIndex: number): void {
    const deviceId = this.editingDeviceId;
    if (!deviceId) {
      this.toastrService.warning('Save the device first', 'Provenance');
      return;
    }
    if (this.isGeneratingProvenance[deviceIndex]) return;
    const html = this.buildProvenanceHtml(deviceIndex);
    // Hash the content sans the generated-at timestamp so identical
    // reports don't upload a fresh doc on every Update.
    const stableContent = html.replace(
      /Generated: [^<]+/,
      'Generated: <stripped>',
    );
    void this.sha256(stableContent).then((hash) => {
      if (this.lastProvenanceContentHash[deviceIndex] === hash) {
        // No structural change since last upload — skip.
        return;
      }
      this.isGeneratingProvenance[deviceIndex] = true;
      const blob = new Blob([html], { type: 'text/html' });
      const file = new File([blob], 'evidence-provenance.html', {
        type: 'text/html',
      });
      const fd = new FormData();
      fd.append('file', file);
      this.http
        .post(
          `${environment.API_URL}device/${deviceId}/documents/EVIDENCE_PROVENANCE`,
          fd,
        )
        .subscribe({
          next: () => {
            this.isGeneratingProvenance[deviceIndex] = false;
            this.provenanceGeneratedAt[deviceIndex] = new Date().toISOString();
            this.lastProvenanceContentHash[deviceIndex] = hash;
            this.toastrService.success(
              'Evidence provenance report attached',
              'Provenance',
            );
          },
          error: (err) => {
            this.isGeneratingProvenance[deviceIndex] = false;
            this.toastrService.error(
              err?.error?.message || err?.message || 'Failed to attach',
              'Provenance',
            );
          },
        });
    });
  }

  private async sha256(text: string): Promise<string> {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /** Render the HTML body of the provenance report for one device. */
  private buildProvenanceHtml(deviceIndex: number): string {
    const form = this.deviceForms.at(deviceIndex);
    const claims = this.collectExtractionClaims(deviceIndex);
    const docCount = (type: string): number => {
      const staged =
        (this.files[deviceIndex] as any)?.[type]?.length ?? 0;
      const existing = this.existingDocs[deviceIndex]?.[type]?.length ?? 0;
      return staged + existing;
    };

    const escape = (s: any): string =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    type Row = {
      label: string;
      value: any;
      sources: Array<{ source: string; value: any; confidence: number; at?: string }>;
      flag: 'auto-confirmed' | 'overwrote' | 'conflict' | 'manual' | 'empty';
    };

    const norm = (v: any): string => {
      if (v == null || v === '') return '';
      if (typeof v === 'number') return Number(v.toFixed(2)).toString();
      if (typeof v === 'boolean') return String(v);
      if (Array.isArray(v))
        return v.map((x) => String(x).trim().toLowerCase()).sort().join('|');
      return String(v).trim().toLowerCase();
    };

    const rows: Row[] = [];
    const handled = new Set<string>();
    for (const [field, list] of Object.entries(claims)) {
      handled.add(field);
      const label = AddDevicesComponent.FIELD_LABELS[field] ?? field;
      const cur = form?.get(field)?.value;
      const curN = norm(cur);
      let flag: Row['flag'];
      if (cur == null || cur === '') {
        flag = 'empty';
      } else {
        // Free-text description fields (auxiliaryEnergySourceDetails,
        // impactStory, address) use valuesEquivalent so paraphrases
        // ("6× Victron Quattro 10 kVA battery inverters" vs
        // "Victron Quattro 10 kVA battery inverter") count as
        // auto-confirmed instead of DISAGREES WITH DOCS.
        const matchingSources = list.filter((c) =>
          this.valuesEquivalent(c.value, cur, field),
        );
        const distinctValues = new Set(list.map((c) => norm(c.value)));
        if (matchingSources.length && distinctValues.size === 1) {
          flag = 'auto-confirmed';
        } else if (matchingSources.length) {
          flag = 'overwrote'; // user / geocoder picked one of the candidates
        } else {
          flag = 'conflict'; // current matches no source — manual override
        }
      }
      rows.push({
        label,
        value: this.formatFieldValue(field, cur),
        sources: list,
        flag,
      });
    }
    // Manual-only fields (filled by user, no extractor weighed in).
    if (form) {
      for (const name of Object.keys(
        (form as FormGroup).controls,
      )) {
        if (handled.has(name)) continue;
        const v = form.get(name)?.value;
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0))
          continue;
        const label =
          AddDevicesComponent.FIELD_LABELS[name] ?? name;
        rows.push({
          label,
          value: this.formatFieldValue(name, v),
          sources: [],
          flag: 'manual',
        });
      }
    }

    const flagBadge = (f: Row['flag']) => {
      switch (f) {
        case 'auto-confirmed':
          return '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600">DOC-BACKED</span>';
        case 'overwrote':
          return '<span style="background:#fef3c7;color:#854d0e;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600">RESOLVED CONFLICT</span>';
        case 'conflict':
          return '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600">DISAGREES WITH DOCS</span>';
        case 'manual':
          return '<span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600">MANUAL</span>';
        case 'empty':
          return '<span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:3px;font-size:11px">EMPTY</span>';
      }
    };

    // Map source-tag → first attached doc of the corresponding
    // type, so we can render the source as a hyperlink that streams
    // the document inline through the API. Reviewers click and jump
    // straight to the SLD / SF-02 / etc. that backed the field.
    const sourceDocType: Record<string, string> = {
      SLD: 'SINGLE_LINE_DIAGRAM',
      'SF-02': 'FORM_SF_02',
      'SF-02c': 'SF_02C',
      COD: 'COD_PROOF',
    };
    // Use the presigned S3 URL (existingDocs[i][type][n].url) so
    // <img>/<iframe> tags can load the doc without going through
    // the auth-bearing HttpClient interceptor. The streaming endpoint
    // /api/document-uploads/N/url requires JWT, which native browser
    // requests can't carry → broke the in-app picture-window.
    const docLink = (sourceTag: string): string | null => {
      const docType = sourceDocType[sourceTag];
      if (!docType) return null;
      const docs = this.existingDocs[deviceIndex]?.[docType];
      if (!docs?.length) return null;
      const url = (docs[0] as any).url;
      if (!url) return null;
      const name = docs[0].label || docs[0].name || docType;
      return `<a href="${url}" target="_blank" rel="noopener" title="${escape(name)}" style="color:#0f607f;text-decoration:none;border-bottom:1px dotted #0f607f">${escape(sourceTag)} ↗</a>`;
    };

    const sourcesCell = (sources: Row['sources'], current: any): string => {
      if (!sources.length)
        return '<em style="color:#94a3b8">no extractor weighed in</em>';
      const curN = norm(current);
      return sources
        .map((s) => {
          const tick = norm(s.value) === curN ? ' ✓' : '';
          const tag = docLink(s.source) ?? `<strong>${escape(s.source)}</strong>`;
          // Provenance timestamp (YYYY-MM-DD) — present on persisted /
          // session-recorded claims. Skip for live extractor runs where
          // it'd just say "today" and add noise.
          const when = s.at
            ? ` <small style="color:#94a3b8">${escape(s.at.slice(0, 10))}</small>`
            : '';
          return `<div>${tag}${tick}: ${escape(s.value)} <small style="color:#64748b">(${Math.round(
            s.confidence * 100,
          )}%)</small>${when}</div>`;
        })
        .join('');
    };

    // Document inventory with per-doc links. Single-doc types render
    // as a count-with-link; multi-doc types list each filename as a
    // separate link so the reviewer can jump straight to e.g. one
    // specific metering screenshot.
    const docList = [
      ['SLD', 'SINGLE_LINE_DIAGRAM'],
      ['SF-02', 'FORM_SF_02'],
      ['SF-02c', 'SF_02C'],
      ['Proof of Ownership', 'PROOF_OF_OWNERSHIP'],
      ['COD Proof', 'COD_PROOF'],
      ['Metering Evidence', 'METERING_EVIDENCE'],
      ['Project Photos', 'PROJECT_PHOTOS'],
      ['Other Documents', 'OTHER_DOCUMENTS'],
    ]
      .map(([name, type]) => {
        const docs = this.existingDocs[deviceIndex]?.[type] ?? [];
        if (!docs.length) {
          return `<li>${escape(name)}: <em style="color:#94a3b8">none</em></li>`;
        }
        // Multi-doc categories (Metering Evidence, Project Photos)
        // get their links rendered as a stacked sub-list rather than
        // a comma-soup that wraps over many rows. Single-doc
        // categories stay inline.
        // Same auth rationale as docLink above — use the presigned URL.
        const linkHtml = (d: any): string =>
          `<a href="${escape(d.url ?? '')}" target="_blank" rel="noopener" style="color:#0f607f">${escape(d.label || d.name)} ↗</a>`;
        if (docs.length > 1) {
          const rows = docs
            .map((d: any) => `<li>${linkHtml(d)}</li>`)
            .join('');
          return `<li>${escape(name)} (${docs.length}):<ul style="margin:4px 0 0 18px;padding:0">${rows}</ul></li>`;
        }
        return `<li>${escape(name)}: ${linkHtml(docs[0])}</li>`;
      })
      .join('');

    // Sort rows by OC# extracted from the leading "(N)" / "(34a)"
    // marker on the label. Rows without an OC# (the few raw-key
    // labels like "sourceAccessMode") sort to the end alphabetically.
    const ocNum = (label: string): { n: number; suffix: string } => {
      const m = /^\((\d+)([a-z]?)\)/i.exec(label);
      if (!m) return { n: Number.POSITIVE_INFINITY, suffix: '' };
      return { n: parseInt(m[1], 10), suffix: m[2] };
    };
    rows.sort((a, b) => {
      const oa = ocNum(a.label);
      const ob = ocNum(b.label);
      if (oa.n !== ob.n) return oa.n - ob.n;
      if (oa.suffix !== ob.suffix) return oa.suffix.localeCompare(ob.suffix);
      return a.label.localeCompare(b.label);
    });
    const tableRows = rows
      .map(
        (r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600">${escape(r.label)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escape(r.value ?? '')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${flagBadge(r.flag)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${sourcesCell(r.sources, r.value)}</td>
    </tr>`,
      )
      .join('');

    const generated = new Date().toISOString();
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Evidence provenance — site ${escape(form?.get('siteName')?.value ?? this.editingExternalId ?? '')}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;max-width:1100px;margin:24px auto;padding:0 16px">
  <h1 style="font-size:20px;margin:0 0 4px">Evidence provenance</h1>
  <div style="color:#64748b;font-size:13px;margin-bottom:18px">Site: <strong>${escape(form?.get('siteName')?.value ?? '')}</strong> · External ID: ${escape(this.editingExternalId ?? '')} · Generated: ${escape(generated)}</div>
  <h2 style="font-size:14px;margin-top:18px">Documents attached</h2>
  <ul style="font-size:13px;line-height:1.5">${docList}</ul>
  <h2 style="font-size:14px;margin-top:18px">Per-field provenance</h2>
  <p style="font-size:12px;color:#475569;line-height:1.5">
    <strong>DOC-BACKED</strong>: every extractor that read this field agrees with the form value.
    <strong>RESOLVED CONFLICT</strong>: extractors disagreed; the registrant accepted one source (matches the form value, marked ✓).
    <strong>DISAGREES WITH DOCS</strong>: the registrant's value matches no extractor — manual override.
    <strong>MANUAL</strong>: no extractor weighed in.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1">
        <th style="padding:6px 8px;text-align:left">Field</th>
        <th style="padding:6px 8px;text-align:left">Form value</th>
        <th style="padding:6px 8px;text-align:left">Status</th>
        <th style="padding:6px 8px;text-align:left">Sources</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`;
  }

  /** Build a plain-text summary of every extractor's findings,
   *  matching the on-screen "From SLD / SF-02c / …" sections, and
   *  copy it to the clipboard. */
  copyMagicSummary(deviceIndex: number): void {
    const lines: string[] = [];
    const sld = this.sldExtractions[deviceIndex];
    if (sld) {
      lines.push('From SLD');
      const f = (l: string, x: any) => x && lines.push(`  ${l}: ${x.value}`);
      f('AC capacity (kW)', sld.acCapacityKw);
      f('DC capacity (kWp)', sld.dcCapacityKwp);
      if (sld.inverterCount) {
        const cap = sld.inverterCapacityKw ? ` × ${sld.inverterCapacityKw.value} kW` : '';
        const mk = sld.inverterMakeModel ? ` (${sld.inverterMakeModel.value})` : '';
        lines.push(`  Inverters: ${sld.inverterCount.value}${cap}${mk}`);
      }
      if (sld.moduleCount) {
        const w = sld.moduleWattage ? ` × ${sld.moduleWattage.value} W` : '';
        lines.push(`  Modules: ${sld.moduleCount.value}${w}`);
      }
      f('Grid voltage', sld.gridVoltage);
      if (sld.gridTied) lines.push(`  Grid-tied: ${sld.gridTied.value ? 'yes' : 'no'}`);
      if (sld.zeroExport) lines.push(`  Zero-export: ${sld.zeroExport.value ? 'yes' : 'no'}`);
      f('Transformer (kVA)', sld.transformerKva);
      f('Network owner', sld.networkOwner);
      f('Aux energy', sld.auxiliaryEnergySourceDetails);
    }
    const sf02c = this.sf02cExtractions[deviceIndex];
    if (sf02c) {
      lines.push('', 'From SF-02c');
      const f = (l: string, x: any) => x && lines.push(`  ${l}: ${x.value}`);
      f('Project', sf02c.projectName);
      f('Owner', sf02c.ownerLegalName);
      f('Owner address', sf02c.ownerAddress);
      f('Country', sf02c.ownerCountry);
      f('Signed', sf02c.signingDate);
      f('Signatory', sf02c.signatoryName);
    }
    const cod = this.codExtractions[deviceIndex];
    if (cod) {
      lines.push('', 'From COD proof');
      const f = (l: string, x: any) => x && lines.push(`  ${l}: ${x.value}`);
      f('COD', cod.commissioningDate);
      f('Site', cod.facilityName);
      f('AC capacity (kW)', cod.acCapacityKw);
      f('Owner', cod.ownerName);
      f('Off-taker', cod.offTakerName);
      f('Country', cod.country);
      f('Issuer', cod.utilityOrIssuer);
    }
    const sf02 = this.sf02Extractions[deviceIndex];
    if (sf02) {
      lines.push('', 'From SF-02');
      const f = (l: string, x: any) => x && lines.push(`  ${l}: ${x.value}`);
      f('Site', sf02.facilityName);
      f('AC capacity (kW)', sf02.acCapacityKw);
      f('COD', sf02.commissioningDate);
      f('Owner', sf02.ownerLegalName);
      f('Owner address', sf02.ownerAddress);
      f('Country', sf02.ownerCountry);
      f('Lat', sf02.latitude);
      f('Lng', sf02.longitude);
      f('Inverters', sf02.inverterCount);
      f('Network owner', sf02.networkOwner);
    }
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    if (ids.length) {
      lines.push('', 'Meter / Measurement IDs');
      ids.forEach((s) => lines.push(`  ${s}`));
    }
    const conflicts = this.getConflicts(deviceIndex);
    const conflictKeys = Object.keys(conflicts);
    if (conflictKeys.length) {
      lines.push('', 'Conflicts');
      for (const k of conflictKeys) {
        lines.push(`  ${this.fieldLabel(k)}:`);
        for (const c of conflicts[k]) {
          lines.push(`    - ${c.source}: ${c.value} (${Math.round(c.confidence * 100)}%)`);
        }
      }
    }
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).then(
      () => this.toastrService.success('Extraction summary copied'),
      () => this.toastrService.error('Failed to copy'),
    );
  }

  fieldLabel(field: string): string {
    const labels: { [k: string]: string } = {
      capacity: '(9) Total AC Capacity (kW)',
      generatingUnitCount: '(13) Number of generating units',
      interconnectionVoltage: '(18) Interconnection voltage',
      gridInterconnection: '(15) Grid-connected?',
      dataSourceBrand: '(27) Data Source Brand Name',
      siteName: 'Site name',
      pvSystemOwner: 'PV system owner',
      address: 'Address',
      countryCodename: 'Country',
      commissioningDate: 'Commissioning date',
      deviceTypeCode: 'Device type code',
      latitude: 'Latitude',
      longitude: 'Longitude',
    };
    return labels[field] ?? field;
  }

  /** Apply every extractor's claim to the form. For fields with
   *  multiple claims, use the user's pick (or highest-confidence
   *  fallback). Patch-empty-only — never overwrites manual input. */
  applyAllExtracted(deviceIndex: number): void {
    const claims = this.collectExtractionClaims(deviceIndex);
    const picks = this.conflictPicks[deviceIndex] || {};
    const form = this.deviceForms.at(deviceIndex);
    for (const [field, list] of Object.entries(claims)) {
      const ctl = form.get(field);
      if (!ctl) continue;
      const current = String(ctl.value ?? '').trim();
      if (current) continue;
      let chosen = list[0];
      if (list.length > 1) {
        const pickedSource = picks[field];
        chosen =
          (pickedSource && list.find((c) => c.source === pickedSource)) ||
          [...list].sort((a, b) => b.confidence - a.confidence)[0];
      }
      ctl.setValue(chosen.value);
      ctl.markAsDirty();
    }
    // Inverter signal → dataSource = Inverter. Credit whichever doc
    // (highest-confidence) provided the inverter evidence.
    const inverterClaim =
      [
        ...(claims['dataSourceBrand'] ?? []),
        ...(claims['generatingUnitCount'] ?? []),
      ].sort((a, b) => b.confidence - a.confidence)[0];
    if (inverterClaim) {
      this.setDataSourceIfEmpty(deviceIndex, 'Inverter', inverterClaim.source);
    }
    // Meter IDs (list union) and meter-ids-extracted brand still
    // route through the existing single-source apply path.
    if (this.meterIdsExtractions[deviceIndex]?.length) {
      this.applyMeterIdsExtraction(deviceIndex);
    }
    this.toastrService.success('Extracted fields applied to the form');
    this.dismissMagicExtraction(deviceIndex);
  }

  dismissMagicExtraction(deviceIndex: number): void {
    this.magicLog[deviceIndex] = [];
    this.magicExtractMode[deviceIndex] = false;
    this.sldExtractions[deviceIndex] = null;
    this.sf02cExtractions[deviceIndex] = null;
    this.codExtractions[deviceIndex] = null;
    this.sf02Extractions[deviceIndex] = null;
    this.meterIdsExtractions[deviceIndex] = [];
    delete this.meterIdsBrands[deviceIndex];
    delete this.conflictPicks[deviceIndex];
  }

  private classifyUploadedFile(
    file: File,
    deviceIndex: number,
    currentType: string,
  ): void {
    if (!this.classifying[deviceIndex]) this.classifying[deviceIndex] = {};
    if (!this.classificationSuggestions[deviceIndex])
      this.classificationSuggestions[deviceIndex] = {};

    this.classifying[deviceIndex][currentType] = true;
    this.classificationSuggestions[deviceIndex][currentType] = null;

    this.documentClassifier.classify(file).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.classifying[deviceIndex][currentType] = false;
          if (
            result &&
            result.suggestedType !== currentType &&
            result.confidence >= 0.4
          ) {
            this.classificationSuggestions[deviceIndex][currentType] = result;
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.classifying[deviceIndex][currentType] = false;
        });
      },
    });
  }

  /** Accept an AI classification suggestion: move the file to the suggested slot. */
  acceptClassification(deviceIndex: number, fromType: string): void {
    const suggestion =
      this.classificationSuggestions[deviceIndex]?.[fromType];
    if (!suggestion) return;

    const toType = suggestion.suggestedType as string as FileType;
    const filesInSlot = this.files[deviceIndex]?.[fromType as FileType];
    if (!filesInSlot?.length) return;

    // Move file(s) to the suggested slot
    if (!this.files[deviceIndex][toType]) {
      this.files[deviceIndex][toType] = [];
    }
    this.files[deviceIndex][toType] = [
      ...this.files[deviceIndex][toType],
      ...filesInSlot,
    ];
    this.files[deviceIndex][fromType as FileType] = [];

    // Move preview
    if (this.filePreviews[deviceIndex]?.[fromType]) {
      this.filePreviews[deviceIndex][toType] = this.filePreviews[deviceIndex][fromType];
      delete this.filePreviews[deviceIndex][fromType];
    }

    // Update form controls
    const fromControl = this.deviceForms.at(deviceIndex).get(fromType);
    const toControl = this.deviceForms.at(deviceIndex).get(toType);
    if (fromControl) fromControl.setValue(null);
    if (toControl) {
      toControl.setValue(this.files[deviceIndex][toType][0] ?? null);
      toControl.markAsDirty();
    }

    // Clear suggestion
    this.classificationSuggestions[deviceIndex][fromType] = null;
    this.checkDocumentsUploaded();
  }

  /** Dismiss an AI classification suggestion. */
  dismissClassification(deviceIndex: number, fileType: string): void {
    if (this.classificationSuggestions[deviceIndex]) {
      this.classificationSuggestions[deviceIndex][fileType] = null;
    }
  }

  /** Read-only view of staged files for a slot — typed in TS so the
   *  template doesn't have to fight `keyof DeviceFiles`. */
  getStagedFiles(deviceIndex: number, fileType: string): File[] {
    return (this.files[deviceIndex]?.[fileType as keyof DeviceFiles] as File[] | undefined) ?? [];
  }

  /** Run client-side Tesseract OCR on a metering-evidence image and
   *  show the extracted text in a dialog. Useful when the
   *  registrant wants to copy a meter reading / SN out of a
   *  monitoring-portal screenshot manually. */
  ocrResultText: string | null = null;
  ocrResultRunning = false;
  @ViewChild('ocrResultDialog') ocrResultDialogTemplate?: TemplateRef<any>;
  private ocrResultDialogRef: MatDialogRef<any> | null = null;

  async runOcrOnStagedFile(file: File): Promise<void> {
    if (this.ocrResultRunning) return;
    this.ocrResultRunning = true;
    this.ocrResultText = null;
    if (this.ocrResultDialogTemplate) {
      this.ocrResultDialogRef = this.dialog.open(this.ocrResultDialogTemplate, {
        // Don't set width/height here — let the .ocr-result-window
        // CSS define the initial size (720×420). The user resizes
        // via the bottom-right corner; mat-dialog caps are lifted
        // in styles.scss so they don't fight the resize.
        hasBackdrop: false,
        panelClass: 'ocr-result-dialog',
      });
    }
    try {
      const isPdf =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      let text = '';
      if (isPdf) {
        // 1. Try the embedded text layer (instant, lossless on
        //    digitally-generated PDFs like e-signed contracts).
        const layer = await (this.documentClassifier as any)
          .extractPdfTextLayer(file)
          .catch(() => '');
        if ((layer || '').trim().length > 40) {
          text = layer;
        } else {
          // 2. Scanned PDF — render each page and OCR with Tesseract.
          text = await this.ocrPdfWithTesseract(file);
        }
      } else {
        text = await this.ocrImageWithTesseract(file);
      }
      this.ocrResultText =
        (text || '').trim() || '(no text recognised)';
    } catch (err: any) {
      this.ocrResultText = `OCR failed: ${err?.message ?? err}`;
    } finally {
      this.ocrResultRunning = false;
    }
  }

  private async ocrImageWithTesseract(file: File): Promise<string> {
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;
    const worker = await createWorker('eng+fra', 1);
    try {
      const canvas = await this.imageFileToCanvas(file);
      const { data } = await worker.recognize(canvas);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  private async ocrPdfWithTesseract(file: File): Promise<string> {
    let pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      pdfjs = await import('pdfjs-dist' as any);
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;
    const worker = await createWorker('eng+fra', 1);
    try {
      const chunks: string[] = [];
      const pages = Math.min(pdf.numPages, 10); // cap for sanity
      for (let p = 1; p <= pages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data } = await worker.recognize(canvas);
        chunks.push(`--- Page ${p} ---\n${data.text}`);
      }
      return chunks.join('\n\n');
    } finally {
      await worker.terminate();
    }
  }

  private async imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  closeOcrResult(): void {
    this.ocrResultDialogRef?.close();
    this.ocrResultDialogRef = null;
  }

  copyOcrResult(): void {
    if (!this.ocrResultText) return;
    navigator.clipboard?.writeText(this.ocrResultText).then(
      () => this.toastrService.success('OCR text copied'),
      () => this.toastrService.error('Failed to copy'),
    );
  }

  /** Remove a staged (not-yet-saved) file from a slot. Mirrors the
   *  existing-doc delete affordance for files already on the server. */
  removeStagedFile(deviceIndex: number, fileType: string, fileIndex: number): void {
    const list = this.files[deviceIndex]?.[fileType as keyof DeviceFiles] as File[] | undefined;
    if (!list) return;
    const removed = list.splice(fileIndex, 1)[0];
    if (this.fileLabels[deviceIndex]?.[fileType]) {
      this.fileLabels[deviceIndex][fileType].splice(fileIndex, 1);
    }
    // Form control + preview track only the first file in multi-slots,
    // so refresh both based on what's left.
    const ctrl = this.deviceForms.at(deviceIndex).get(fileType);
    if (ctrl) {
      ctrl.setValue(list[0] ?? null);
      ctrl.markAsDirty();
    }
    if (this.filePreviews[deviceIndex]) {
      const preview = this.filePreviews[deviceIndex][fileType];
      if (list.length === 0) {
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
        delete this.filePreviews[deviceIndex][fileType];
      } else {
        const next = list[0];
        const isImage = next.type.startsWith('image/');
        const isPdf = next.type === 'application/pdf';
        const isExcel = /\.(xlsx|xls)$/i.test(next.name);
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
        const objectUrl = URL.createObjectURL(next);
        this.filePreviews[deviceIndex][fileType] = {
          url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
          type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
          name: next.name,
        };
      }
    }
    void removed;
    this.checkDocumentsUploaded?.();
  }

  openPreview(deviceIndex: number, fileType: string) {
    const preview = this.filePreviews[deviceIndex]?.[fileType];
    if (!preview) return;
    this.previewData = preview;
    this.currentPreviewFile =
      this.files[deviceIndex]?.[fileType as keyof DeviceFiles]?.[0] ?? null;
    this.currentPreviewDocType = fileType;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
      panelClass: 'file-preview-dialog',
    });
  }

  viewMagicFile(file: File, deviceIndex: number): void {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = file.type.startsWith('image/');
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const objUrl = URL.createObjectURL(file);
    this.previewData = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
      name: file.name,
    };
    this.currentPreviewFile = file;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
      panelClass: 'file-preview-dialog',
    });
  }

  acceptMagic(deviceIndex: number): void {
    this.magicLog[deviceIndex] = [];
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
  }

  cancelMagic(deviceIndex: number): void {
    if (this.magicBackupFiles[deviceIndex]) {
      this.files[deviceIndex] = this.magicBackupFiles[deviceIndex] as any;
    }
    if (this.magicBackupPreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = this.magicBackupPreviews[deviceIndex] as any;
    }
    this.magicLog[deviceIndex] = [];
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
  }

  renameableTypes: string[] = ['PROJECT_PHOTOS', 'METERING_EVIDENCE'];

  renameDialogFiles: {
    file: File;
    url: string;
    name: string;
    type: 'image' | 'pdf' | 'excel' | 'other';
    label: string;
  }[] = [];

  openRenameDialog(deviceIndex: number, fileType: string): void {
    const files =
      this.files[deviceIndex]?.[fileType as keyof DeviceFiles] || [];
    if (!files.length) return;
    // Revoke any URLs from a prior opening before creating new ones.
    for (const u of this.renameObjectUrls) URL.revokeObjectURL(u);
    this.renameObjectUrls = [];
    if (!this.fileLabels[deviceIndex]) this.fileLabels[deviceIndex] = {};
    if (!this.fileLabels[deviceIndex][fileType]) {
      this.fileLabels[deviceIndex][fileType] = Array(files.length).fill('');
    }
    this.renameDialogDeviceIndex = deviceIndex;
    this.renameDialogType = fileType;
    this.renameDialogFiles = files.map((f, i) => {
      const url = URL.createObjectURL(f);
      this.renameObjectUrls.push(url);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const type: 'image' | 'pdf' | 'excel' | 'other' = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'bmp',
        'svg',
      ].includes(ext)
        ? 'image'
        : ext === 'pdf'
          ? 'pdf'
          : ext === 'xlsx' || ext === 'xls'
            ? 'excel'
            : 'other';
      return {
        file: f,
        url,
        name: f.name,
        type,
        label: this.fileLabels[deviceIndex][fileType][i] ?? '',
      };
    });
    this.renameDialogRef = this.dialog.open(this.renameDialogTemplate, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      disableClose: true,
      panelClass: 'drec-floating-dialog',
    });
    this.renameDialogRef.afterClosed().subscribe(() => {
      // Release object URLs and clear dialog-local state. Label commit happens in saveRenameDialog().
      for (const u of this.renameObjectUrls) URL.revokeObjectURL(u);
      this.renameObjectUrls = [];
      this.renameDialogFiles = [];
    });
  }

  saveRenameDialog(): void {
    const labels = this.renameDialogFiles.map((r) => r.label || '');
    this.fileLabels[this.renameDialogDeviceIndex][this.renameDialogType] =
      labels;
    this.renameDialogRef?.close();
  }

  cancelRenameDialog(): void {
    this.renameDialogRef?.close();
  }

  fileExtension(name: string): string {
    return (name.split('.').pop() || '').toUpperCase();
  }

  openRenamePreview(r: {
    url: string;
    name: string;
    type: 'image' | 'pdf' | 'excel' | 'other';
    file: File;
  }): void {
    if (r.type === 'image') {
      this.imageFullViewUrl = r.url;
      this.imageFullViewName = r.name;
      this.imageFullViewRef = this.dialog.open(this.imageFullViewTemplate, {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        panelClass: 'image-full-view-dialog',
      });
      return;
    }
    this.previewData = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(r.url),
      type: r.type,
      name: r.name,
    };
    this.currentPreviewFile = r.file;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
      panelClass: 'file-preview-dialog',
    });
  }

  /** Fetch documents for the freshly-created device and PATCH labels for any we staged. */
  private persistStagedLabels(deviceId: number, deviceIndex: number): void {
    const labelsByType = this.fileLabels[deviceIndex];
    if (!labelsByType) return;
    // Only the three user-facing categories support rename. Skip the call if nothing is set.
    const hasAny = this.renameableTypes.some((t) =>
      (labelsByType[t] || []).some((l) => l && l.trim() !== ''),
    );
    if (!hasAny) return;
    this.deviceService.getDocuments(deviceId).subscribe({
      next: (docs) => {
        for (const type of this.renameableTypes) {
          const files =
            this.files[deviceIndex]?.[type as keyof DeviceFiles] || [];
          const labels = labelsByType[type] || [];
          for (let i = 0; i < files.length; i++) {
            const label = (labels[i] || '').trim();
            if (!label) continue;
            const match = docs.find(
              (d) =>
                d.type === type &&
                d.originalFilename === files[i].name &&
                !d.label,
            );
            if (!match) continue;
            this.deviceService.updateDocumentLabel(match.id, label).subscribe({
              error: (err) =>
                console.warn(
                  `Failed to save label for ${files[i].name}`,
                  err?.message,
                ),
            });
          }
        }
      },
      error: (err) =>
        console.warn('Failed to fetch documents for labeling', err?.message),
    });
  }

  /**
   * Save & Generate SF-02 for a single row. Equivalent to bulk Submit
   * for that one device, then immediately calls
   * /device-reviews/:id/generate-sf02. The row stays in the FormArray
   * (so the user can see the timestamp + Re-generate) but bulk Submit
   * will skip it on subsequent runs.
   */
  saveAndGenerateSf02(index: number): void {
    // Edit mode: device already exists, just regenerate.
    if (this.isEditMode && this.editingDeviceId != null) {
      this.runGenerateSf02(index, this.editingDeviceId);
      return;
    }
    if (this.savedDeviceIdByIndex[index] != null) {
      // Already saved in this session; just regenerate.
      this.runGenerateSf02(index, this.savedDeviceIdByIndex[index]);
      return;
    }
    if (this.isGeneratingSf02ByIndex[index]) return;
    this.myform.markAllAsTouched();
    if (!this.myform.valid) {
      this.toastrService.error(
        'Fix validation errors before saving this device.',
        'SF-02',
      );
      return;
    }
    const element = this.myform.value.devices[index];
    if (!element) return;
    const formData = this.buildDeviceFormData(element, index);
    if (!formData) return;

    this.isGeneratingSf02ByIndex[index] = true;
    this.deviceService.create(formData).subscribe({
      next: (event: any) => {
        // deviceService.create now emits the full HttpEvent stream
        // (Sent=0, UploadProgress=1, Response=4). Ignore everything
        // but the final Response; otherwise the first emission has
        // no body and we'd false-fire "no device id".
        if (event?.type !== 4) return;
        const body = event.body;
        if (!body?.id) {
          this.isGeneratingSf02ByIndex[index] = false;
          this.toastrService.error(
            'Saved but no device id returned',
            'SF-02',
          );
          return;
        }
        this.savedDeviceIdByIndex[index] = body.id;
        this.persistStagedLabels(body.id, index);
        this.runGenerateSf02(index, body.id);
      },
      error: (err) => {
        this.isGeneratingSf02ByIndex[index] = false;
        const message =
          err?.error?.message || err?.message || 'Failed to save device';
        this.toastrService.error(message, 'SF-02 — save step failed');
      },
    });
  }

  private runGenerateSf02(index: number, deviceId: number): void {
    this.isGeneratingSf02ByIndex[index] = true;
    this.http
      .post(
        `${environment.API_URL}device-reviews/${deviceId}/generate-sf02`,
        {},
      )
      .subscribe({
        next: () => {
          this.isGeneratingSf02ByIndex[index] = false;
          this.sf02GeneratedAtByIndex[index] = new Date().toISOString();
          this.toastrService.success(
            'Device saved and SF-02 generated',
            'SF-02',
          );
        },
        error: (err) => {
          this.isGeneratingSf02ByIndex[index] = false;
          this.toastrService.error(
            err?.error?.message || err?.message || 'Generation failed',
            'SF-02 — generate step failed',
          );
        },
      });
  }

  onSubmit() {
    if (this.isSubmitting) return;
    this.myform.markAllAsTouched();
    this.checkDocumentsUploaded();
    if (!this.formValid) {
      this.submitValidationErrors = this.getMissingFieldsList();
      const count = this.submitValidationErrors.length;
      this.toastrService.error(
        count
          ? `Cannot submit — ${count} field(s) need attention. See list at top of page.`
          : 'Cannot submit — form is incomplete. Look for red borders on required fields.',
        'Submission blocked',
        { timeOut: 8000 },
      );
      setTimeout(() => {
        const banner =
          document.querySelector<HTMLElement>('.submit-validation-banner') ??
          document.querySelector<HTMLElement>('.mat-form-field-invalid');
        banner?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    this.submitValidationErrors = [];

    // D-REC requires ≥6 decimals on lat/lng (≈10cm) so the coords
    // pinpoint a specific facility, not a 1km cell. Rejected at
    // submission time so the device never enters review with
    // unfixable formal-fail state.
    // Coord-precision check intentionally removed: once the
    // registrant has typed or drag-adjusted lat/lng, the value is
    // theirs to own. Reviewer-side automation flags low-precision
    // sites independently, so blocking submit here was paternalistic.

    // Flip isSubmitting FIRST so the overlay + spinner are rendered
    // before the (possibly slow) submitForm path runs. The setTimeout
    // yields the macrotask queue once, giving Angular a chance to do a
    // change-detection pass and paint, so the user sees feedback even
    // if the subsequent build / upload chain runs synchronously for
    // several seconds.
    this.isSubmitting = true;
    this.submitButtonText = 'Submitting…';
    this.uploadProgressPct = 0;
    this.uploadPhase = 'uploading';
    // Safety reset — if no callback path fires within 2min, we unlock
    // the button so the user isn't trapped. The submit subscription
    // resets this timer on every UploadProgress event, so a legitimate
    // slow upload (17 files on a home connection) keeps it alive as long
    // as bytes are flowing. Only fires when truly nothing happens.
    if (this.submitSafetyTimer) clearTimeout(this.submitSafetyTimer);
    this.submitSafetyTimer = setTimeout(() => this.safetyTimerFire(), 120_000);
    setTimeout(() => this.openPopupDialog(), 0);
  }

  private submitSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  private safetyTimerFire(): void {
    if (this.isSubmitting) {
      this.isSubmitting = false;
      this.submitButtonText = 'Submit';
      this.uploadProgressPct = 0;
      // Reset the gating flags so the NEXT submit re-evaluates from
      // scratch. Without this, a timed-out submit can leave the
      // form-vs-doc resolver silently disabled (presubmitOverride /
      // formVsDocPromptShown stuck true) — the user presses Submit
      // again, no dialog appears, and they assume the picker is broken.
      this.presubmitOverride = false;
      this.formVsDocPromptShown = false;
      this.toastrService.error(
        'Submission appears stuck. Try again, or refresh if the issue persists.',
        'Timed out',
      );
    }
    this.submitSafetyTimer = null;
  }

  /**
   * Build the FormData payload for a single device row (deviceToRegister
   * + eSignature + files). Shared by bulk submit and per-row
   * Save & Generate SF-02. Returns null if any file validation failed.
   */
  private buildDeviceFormData(element: any, index: number): FormData | null {
    const formData = new FormData();
    if (this.organizationName != null) {
      element['organizationId'] = this.organizationId;
    }
    const selectedCountry = this.countrylist.find(
      (option: CountryInfo) => option.country === element.countryCodename,
    );
    element['countryCode'] = selectedCountry?.alpha3;

    // Truncate lat/long to 9 decimal places (backend regex limit)
    if (element.latitude) {
      const [intLat, decLat] = String(element.latitude).split('.');
      element.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (element.longitude) {
      const [intLng, decLng] = String(element.longitude).split('.');
      element.longitude = decLng ? `${intLng}.${decLng.slice(0, 20)}` : intLng;
    }

    // OC#37 is a multi-select in the UI but stored as a '; '-joined string
    if (Array.isArray(element.labellingSchemeAccreditation)) {
      element.labellingSchemeAccreditation =
        element.labellingSchemeAccreditation.join('; ') || null;
    }

    formData.append('deviceToRegister', JSON.stringify(element));

    // E-signature evidence
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
    }
    const canvasHash = canvas.toDataURL();

    formData.append(
      'eSignature',
      JSON.stringify({
        browserFingerprint: canvasHash
          ? btoa(canvasHash).substring(0, 64)
          : null,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        signedAt: new Date().toISOString(),
        metadata: {
          colorDepth: screen.colorDepth,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          touchSupport: navigator.maxTouchPoints > 0,
        },
      }),
    );
    if (element.countryCode) {
      formData.append('countryCode', element.countryCode);
    } else {
      console.error('Country code is missing for device:', element);
    }

    const fileFields: FileType[] = [
      DocumentType.FORM_SF_02,
      DocumentType.SF_02C,
      DocumentType.PROOF_OF_OWNERSHIP,
      DocumentType.METERING_EVIDENCE,
      DocumentType.SINGLE_LINE_DIAGRAM,
      DocumentType.PROJECT_PHOTOS,
      DocumentType.COD_PROOF,
      DocumentType.OTHER_DOCUMENTS,
    ];

    const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
    const maxSizeInMB = 20;

    let allErrors: Record<string, string[]> = {};
    fileFields.forEach((fileType: FileType) => {
      const files = this.files[index]?.[fileType];
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
      console.error(
        'One or more files are invalid. Request will not be sent.',
        allErrors,
      );
      return null;
    }
    return formData;
  }

  submitForm() {
    if (this.isEditMode) {
      this.submitEdit();
      return;
    }
    const deviceArray = this.myform.value.devices;
    deviceArray.forEach((element: any, index: number) => {
      // Skip rows already saved via Save & Generate SF-02.
      if (this.savedDeviceIdByIndex[index] != null) return;

      const formData = this.buildDeviceFormData(element, index);
      if (!formData) {
        this.submitButtonText = 'Submit';
        this.isSubmitting = false;
        return;
      }

      this.deviceService.create(formData).subscribe({
        next: (event: any) => {
          // HttpEventType.UploadProgress = 1. Bytes are still going up;
          // surface the percentage in the overlay and keep the safety
          // timer alive so a slow uplink with 17 files doesn't trigger
          // a false "stuck" timeout.
          if (event?.type === 1) {
            if (event.total) {
              this.uploadProgressPct = Math.round(
                (event.loaded / event.total) * 100,
              );
            }
            this.uploadPhase =
              this.uploadProgressPct >= 100
                ? 'processing'
                : 'uploading';
            // Reset the 2-min safety timer as long as bytes are flowing.
            if (this.submitSafetyTimer) {
              clearTimeout(this.submitSafetyTimer);
              this.submitSafetyTimer = setTimeout(
                () => this.safetyTimerFire(),
                120_000,
              );
            }
            return;
          }
          // HttpEventType.Response = 4. The actual response we care about.
          if (event?.type !== 4) return;
          const result = event.body;
          // Always reset isSubmitting on success — don't rely on the
          // router.navigate below to unmount the component. That was the
          // bug that left the overlay forever when navigation no-op'd.
          if (this.submitSafetyTimer) {
            clearTimeout(this.submitSafetyTimer);
            this.submitSafetyTimer = null;
          }
          this.isSubmitting = false;
          this.submitButtonText = 'Submit';
          this.uploadProgressPct = 0;
          this.uploadPhase = 'uploading';

          this.toastrService.success(
            'Added Successfully !!',
            'Device! ' + element.serialNumber,
          );

          // Persist any per-file labels the registrant set in the rename dialog.
          if (result?.id) {
            this.persistStagedLabels(result.id, index);
          }

          const idx = deviceArray.indexOf(element);
          deviceArray.splice(idx, 1);

          if (deviceArray.length === 0) {
            if (this.user.role === OrganizationType.Admin) {
              this.router.navigate(['/admin/All_devices']);
            } else if (this.user.role === OrganizationType.Registrant) {
              this.router.navigate(['/registrant/All_devices']);
            } else {
              this.router.navigate(['/device/AllList']);
            }
          }
        },
        error: (err) => {
          console.error('error caught in component', err.error.message);
          if (this.submitSafetyTimer) {
            clearTimeout(this.submitSafetyTimer);
            this.submitSafetyTimer = null;
          }
          this.submitButtonText = 'Submit';
          this.isSubmitting = false;
          this.uploadProgressPct = 0;
          const message =
            err.error?.message || err.message || 'Failed to register device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else if (err.error?.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to add a device.",
              'Access Denied',
            );
          } else {
            this.toastrService.error(message, 'Please try again.');
          }
        },
      });
    });
  }

  shortenFileName(fileName: string, maxLength: number = 20): string {
    return shortenFileName(fileName, maxLength);
  }

  /**
   * OCR is only meaningful on document images that contain text
   * (meter screens, datasheets, statements, contracts). Site /
   * project photos are visual evidence — running OCR on them
   * yields nothing useful and confuses reviewers, so suppress the
   * OCR affordance for those.
   */
  /**
   * Edit-mode aware "has at least one doc for this slot" check.
   * - Add mode: only the form-control's value matters (newly chosen file).
   * - Edit mode: also count server-saved docs surfaced in existingDocs,
   *   so the (!) "missing" badge doesn't fire when docs are obviously
   *   already attached.
   */
  /**
   * Multi-line tooltip listing every missing/invalid required field
   * with its (NN) form-index prefix. Used by the "Please fill in
   * all required fields" footer notice.
   */
  missingFieldsTooltip(): string {
    const items = this.getMissingFieldsList();
    if (!items.length) {
      // Fallback when the form is invalid but no specific control
      // could be enumerated (e.g. cross-field validator on the
      // FormGroup itself). Always return non-empty so the tooltip
      // doesn't silently no-show.
      return 'One or more required fields are missing or invalid. Look for red borders on the form above.';
    }
    return 'Missing or invalid:\n' + items.map((s) => `  • ${s}`).join('\n');
  }

  /** Map of formControlName → human "(NN) Field name" label, mirroring
   *  the Add/Edit form labels. Static because labels don't change at
   *  runtime; keep in sync if the form labels are re-numbered. */
  /** Numbering aligned with the OC# Registration Checklist (mirrors
   *  OC_ROWS in shared/oc-checklist-panel.component.ts). Fields that
   *  don't have an OC# row (dataSource / dataSourceBrand / SF-02
   *  evidence mode / operatingConfiguration / evidencePathway) get
   *  no leading number — they're internal platform concepts, not
   *  checklist items. */
  private static readonly FIELD_LABELS: Record<string, string> = {
    siteName: '(1) Site name',
    address: '(2) Address',
    stateProvince: '(3) State/Province',
    postcode: '(4) Postcode',
    countryCodename: '(5) Country',
    latitude: '(6) Latitude',
    longitude: '(7) Longitude',
    deviceDescription: '(8) Installation type',
    capacity: '(9) Total AC capacity (kW)',
    commissioningDate: '(10) Commissioning date',
    requestedEffectiveRegDate: '(11) Requested effective registration date',
    defaultAccountCode: '(12) Default Evident account code',
    generatingUnitCount: '(13) Number of generating units',
    serialNumber: '(14) Meter or Measurement ID(s)',
    gridInterconnection: '(15) Grid-connected?',
    gridExportType: '(16) Exports to grid?',
    networkOwner: '(17) Network owner',
    interconnectionVoltage: '(18) Interconnection voltage',
    hasNetworkMeter: '(19) Network meter installed?',
    meterReadsShareable: '(20) Meter reads shareable?',
    nonMeterImportDetails: '(21) Non-meter import details',
    sourceAccessMode: '(22) Metering evidence sharing mode',
    hasCaptiveConsumer: '(23) Captive consumer present?',
    hasAuxiliaryEnergySources: '(24) Auxiliary energy sources?',
    auxiliaryEnergySourceDetails: '(25) Auxiliary energy source details',
    pvSystemOwner: '(27) PV system owner',
    pvSystemOwnerAddress: '(27a) Owner mailing address',
    offTakerName: '(28) Off-taker name',
    offTaker: '(29) Off-taker type',
    offTakerSameCompanyAsOwner: '(30) Off-taker same company as owner?',
    otherEacSchemeRegistration: '(31) Other carbon/energy scheme',
    hasPublicFunding: '(32) Public funding received?',
    publicFundingEndDate: '(33) Public funding end date',
    hasSubsidy: '(34) Subsidy/incentive received?',
    subsidyTypes: '(35) Subsidy types',
    subsidyClaimsEacs: '(36) Subsidy claims environmental attributes?',
    labellingSchemeAccreditation: '(37) Other labelling scheme',
    SDGBenefits: '(38) SDG benefits',
    impactStory: '(39) Impact story',
    additionalInfo: '(40) Additional information',
    signatoryName: '(41) Signatory name',
    // Platform-internal — no OC# row.
    fuelCode: 'Fuel code',
    deviceTypeCode: 'Device type code',
    dataSource: 'Data source',
    dataSourceBrand: 'Data source brand',
    sf02EvidenceMode: 'SF-02 evidence mode',
    operatingConfiguration: 'Operating configuration',
    evidencePathway: 'Evidence pathway',
  };

  /** Per-field value translators for the provenance-report table:
   *  raw form values (enum codes, radio-button keys) get rewritten
   *  into the same human-readable phrasing the form shows in
   *  selects/radios. Without this, fields like `sf02EvidenceMode`
   *  appear in the report as bare codes ("self", "upload"). */
  private static readonly VALUE_FORMATTERS: Record<
    string,
    (v: any) => string
  > = {
    sf02EvidenceMode: (v) =>
      v === 'self' ? 'Self-generated' : v === 'upload' ? 'Uploaded' : String(v),
    // mat-select stores the long form ("No (zero-export)"); Haiku may
    // emit the short token ("zero-export"). Normalise both to a single
    // short label for the report.
    gridExportType: (v) => {
      const s = String(v ?? '').toLowerCase();
      if (!s) return '';
      if (s.includes('zero')) return 'Zero-export (no grid export)';
      if (s.includes('partial')) return 'Partial export';
      if (s.includes('full')) return 'Full export';
      return String(v);
    },
    // YesNo enum from the form / 'Yes'|'No' from the SLD apply path /
    // raw boolean from Haiku — all collapse to the same phrasing.
    hasNetworkMeter: (v) => {
      if (v === true || v === 'Yes' || v === 'yes' || v === 'true') {
        return 'Yes — network meter present';
      }
      if (v === false || v === 'No' || v === 'no' || v === 'false') {
        return 'No — no network meter';
      }
      return String(v ?? '');
    },
  };

  private formatFieldValue(name: string, value: any): any {
    const fmt = AddDevicesComponent.VALUE_FORMATTERS[name];
    return fmt ? fmt(value) : value;
  }

  /** Walk the FormArray and collect labels for every invalid /
   *  required-but-empty control. Falls back to the raw control name
   *  if no label is mapped above. */
  private getMissingFieldsList(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const labelFor = (name: string): string =>
      AddDevicesComponent.FIELD_LABELS[name] ??
      name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const visit = (
      ctl: AbstractControl,
      name: string,
      rowPrefix: string,
    ): void => {
      if (!ctl || ctl.disabled || ctl.valid) return;
      // FormGroup / FormArray: descend into children so we surface
      // the leaf control rather than the parent wrapper.
      if (ctl instanceof FormGroup) {
        Object.entries(ctl.controls).forEach(([n, c]) =>
          visit(c, n, rowPrefix),
        );
        return;
      }
      if (ctl instanceof FormArray) {
        ctl.controls.forEach((c, i) =>
          visit(c, `${name}[${i}]`, rowPrefix),
        );
        return;
      }
      const errs = ctl.errors
        ? Object.keys(ctl.errors).join(', ')
        : 'invalid';
      const key = `${rowPrefix}${labelFor(name)} (${errs})`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    };
    this.deviceForms.controls.forEach((group, deviceIndex) => {
      const prefix =
        this.deviceForms.length > 1 ? `Row ${deviceIndex + 1}: ` : '';
      visit(group, `device[${deviceIndex}]`, prefix);
    });
    return out;
  }

  /**
   * Edit-mode: anything to actually update? Compares current
   * deviceForms[0] values against the snapshot taken at load time
   * (initialValues), plus any newly-staged file or explicit clear.
   * The submit button stays grey until something differs.
   */
  hasUnsavedEditChanges(): boolean {
    if (!this.isEditMode) return true;
    // New files staged?
    const staged = this.files[0];
    if (staged) {
      for (const k of Object.keys(staged)) {
        if (((staged as any)[k] as File[] | undefined)?.length) return true;
      }
    }
    // Any explicit clears?
    if ((this.explicitlyClearedFields[0]?.size ?? 0) > 0) return true;
    // Any form-control value differing from initialValues?
    const fg = this.deviceForms.at(0) as FormGroup | undefined;
    if (!fg) return false;
    const norm = (v: any) => {
      if (v == null) return '';
      if (typeof v === 'string') return v.trim();
      if (Array.isArray(v))
        return JSON.stringify([...v].map((x) => String(x).trim()).sort());
      return v;
    };
    for (const k of Object.keys(fg.controls)) {
      const cur = norm(fg.get(k)?.value);
      const init = norm(this.initialValues[k]);
      if (cur !== init && !(typeof cur === 'object' && typeof init === 'object'
                            && JSON.stringify(cur) === JSON.stringify(init))) {
        return true;
      }
    }
    return false;
  }

  /** Re-entrancy guard so submitEdit doesn't re-prompt during the
   *  same submit cycle after the user resolved conflicts. */
  private formVsDocPromptShown = false;

  /** Build the list of {field, current, candidates[]} entries where
   *  the form's current value disagrees with at least one extractor
   *  source. Empty current values are skipped (extractor would have
   *  silently filled them). */
  private collectFormVsDocConflicts(deviceIndex: number): Array<{
    name: string;
    label: string;
    current: any;
    agreeSources: string[];
    candidates: Array<{ source: string; value: any; confidence: number; selected?: boolean; agreesWithForm?: boolean }>;
  }> {
    const claims = this.collectExtractionClaims(deviceIndex);
    const form = this.deviceForms.at(deviceIndex);
    const norm = (v: any): string => {
      if (v == null || v === '') return '';
      if (typeof v === 'number') return Number(v.toFixed(2)).toString();
      if (typeof v === 'boolean') return String(v);
      if (Array.isArray(v))
        return v.map((x) => String(x).trim().toLowerCase()).sort().join('|');
      return String(v).trim().toLowerCase();
    };
    const out: any[] = [];
    for (const [field, list] of Object.entries(claims)) {
      const cur = form?.get(field)?.value;
      if (cur == null || cur === '') continue;
      // Filter to extractor-only sources (not the synthetic "Current"
      // entry collectExtractionClaims injects), drop low-confidence
      // and any source that already matches the form value.
      // Free-text description fields (auxiliaryEnergySourceDetails,
      // impactStory, address, ...) go through valuesEquivalent so
      // paraphrases — "6× Victron Quattro 10 kVA battery inverters"
      // vs "Victron Quattro 10 kVA battery inverter" — don't get
      // flagged as a discrepancy and bother the reviewer.
      const trusted = list.filter((c) => c.confidence >= 0.7);
      const hasDisagreement = trusted.some(
        (c) => !this.valuesEquivalent(c.value, cur, field),
      );
      if (!hasDisagreement) continue;
      // Dedupe candidates by value so two docs that agree
      // (SF-02c "Viet Nam" + COD "Viet Nam") collapse into one row
      // labelled "SF-02c, COD: Viet Nam" instead of two identical
      // rows that just clutter the conflict view.
      const grouped = new Map<
        string,
        { sources: string[]; value: any; confidence: number }
      >();
      for (const c of trusted) {
        const key = norm(c.value);
        const g = grouped.get(key);
        if (g) {
          if (!g.sources.includes(c.source)) g.sources.push(c.source);
          g.confidence = Math.max(g.confidence, c.confidence);
        } else {
          grouped.set(key, {
            sources: [c.source],
            value: c.value,
            confidence: c.confidence,
          });
        }
      }
      // Keep EVERY dedupe-group as a visible candidate, even when
      // one happens to match the form value. Folding form-matching
      // sources into a "supported by …" sidebar hides the
      // doc-vs-doc split — e.g. Form=250, SLD=250, COD=300.12
      // wants to make clear that SLD also weighed in (agrees) AND
      // COD disagrees, not just "form vs COD".
      const cands = Array.from(grouped.values()).map((g) => ({
        source: g.sources.join(', '),
        value: g.value,
        confidence: g.confidence,
        selected: false,
        agreesWithForm: this.valuesEquivalent(g.value, cur, field),
      }));
      const label =
        AddDevicesComponent.FIELD_LABELS[field] ??
        field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      out.push({
        name: field,
        label,
        current: cur,
        agreeSources: [] as string[],
        candidates: cands,
      });
    }
    return out;
  }

  pendingFormVsDocConflicts: ReturnType<
    AddDevicesComponent['collectFormVsDocConflicts']
  > = [];
  pendingFormVsDocCallback: ((proceed: boolean) => void) | null = null;
  @ViewChild('formVsDocDialog') formVsDocDialog?: TemplateRef<any>;
  private formVsDocDialogRef: MatDialogRef<any> | null = null;

  /** Open the doc-vs-form discrepancy resolver dialog. The user
   *  picks "Keep form value" (default) or one of the doc candidates
   *  per field; on confirm we apply the picks and re-enter submit. */
  private openFormVsDocConflictDialog(
    conflicts: ReturnType<AddDevicesComponent['collectFormVsDocConflicts']>,
    cb: (proceed: boolean) => void,
  ): void {
    this.pendingFormVsDocConflicts = conflicts;
    this.pendingFormVsDocCallback = cb;
    if (!this.formVsDocDialog) {
      cb(true); // dialog not available — proceed without prompting
      return;
    }
    this.formVsDocDialogRef = this.dialog.open(this.formVsDocDialog, {
      width: '760px',
      maxWidth: '95vw',
      panelClass: 'drec-floating-dialog',
    });
  }

  /** Apply the user's picks (selected candidate per row → form
   *  control), then continue submit. Rows where no candidate is
   *  picked keep the form value as-is. */
  /** Template helpers for the radio-group: only one candidate per
   *  row may be selected at a time (or none = keep form value). */
  isAnyDocPicked(row: { candidates: Array<{ selected?: boolean }> }): boolean {
    return row.candidates.some((c) => !!c.selected);
  }
  clearDocPick(row: { candidates: Array<{ selected?: boolean }> }): void {
    row.candidates.forEach((c) => (c.selected = false));
  }
  pickDoc(
    row: { candidates: Array<{ selected?: boolean }> },
    target: { selected?: boolean },
  ): void {
    row.candidates.forEach((c) => (c.selected = c === target));
  }

  /** Source list (comma-joined) of any extractor candidates whose
   *  value already matches the form — surfaced inline next to the
   *  "Keep form value" option as "— supported by …" instead of
   *  cluttering the radio list with a "Switch to: same value" row
   *  that's a no-op when picked. */
  agreeingSources(row: {
    candidates: Array<{ source: string; agreesWithForm?: boolean }>;
  }): string {
    return row.candidates
      .filter((c) => c.agreesWithForm)
      .map((c) => c.source)
      .join(', ');
  }

  applyFormVsDocPicks(): void {
    const form = this.deviceForms.at(0);
    for (const row of this.pendingFormVsDocConflicts) {
      const pick = row.candidates.find((c) => c.selected);
      if (!pick) continue;
      const ctl = form?.get(row.name);
      if (!ctl) continue;
      ctl.setValue(pick.value);
      ctl.markAsDirty();
      if (row.name === 'countryCodename') {
        // Pin against the geocoder so the user's explicit pick
        // isn't reverted on the next coord recompute (was causing
        // "I picked Vietnam, geocoder reset it to India" loop).
        this.userPickedCountry[0] = true;
      }
    }
    this.pendingFormVsDocConflicts = [];
    this.formVsDocDialogRef?.close();
    this.formVsDocDialogRef = null;
    // Don't force the override on here — the conflict picker now runs
    // BEFORE the pre-submit dialog, so the re-entered submitEdit
    // should still surface empty-fields / unextracted hints. The
    // formVsDocPromptShown flag is what prevents the picker re-opening.
    const cb = this.pendingFormVsDocCallback;
    this.pendingFormVsDocCallback = null;
    cb?.(true);
  }

  cancelFormVsDocResolution(): void {
    this.pendingFormVsDocConflicts = [];
    this.formVsDocDialogRef?.close();
    this.formVsDocDialogRef = null;
    const cb = this.pendingFormVsDocCallback;
    this.pendingFormVsDocCallback = null;
    cb?.(false);
  }

  /**
   * Per-device, per-field log of "synthetic source" events — values
   * written by inference helpers that aren't doc-extractors but
   * still represent provenance worth surfacing in the report
   * (geocoder, impactStory keyword scan, metering-evidence presence
   * rule). collectExtractionClaims merges these into the regular
   * extractor claims so the per-field provenance table shows
   * "Geocoder (lat/lng)" / "Impact story" instead of "MANUAL".
   */
  private inferenceClaims: {
    [deviceIndex: number]: {
      [field: string]: Array<{
        source: string;
        value: any;
        confidence: number;
      }>;
    };
  } = {};

  private recordInference(
    deviceIndex: number,
    field: string,
    source: string,
    value: any,
    confidence = 0.95,
  ): void {
    if (value == null || value === '') return;
    if (!this.inferenceClaims[deviceIndex]) {
      this.inferenceClaims[deviceIndex] = {};
    }
    if (!this.inferenceClaims[deviceIndex][field]) {
      this.inferenceClaims[deviceIndex][field] = [];
    }
    // Replace any prior claim from the same source — re-runs of the
    // inference (e.g. coords changed → new geocode) shouldn't pile
    // up duplicates.
    this.inferenceClaims[deviceIndex][field] = this.inferenceClaims[
      deviceIndex
    ][field].filter((c) => c.source !== source);
    this.inferenceClaims[deviceIndex][field].push({
      source,
      value,
      confidence,
    });
    // Inferences are real provenance — persist them so re-edits don't
    // see geocoder/impactStory/metering-evidence-derived values as
    // MANUAL. Same mechanism as the doc-extractor apply paths. Value
    // is captured too so the registrant's edit-page hint can hydrate
    // without re-running the inference.
    this.recordProvenance(deviceIndex, field, source, confidence, value);
  }

  /** Per-device set of fields the user explicitly cleared. submitEdit
   *  consults this to send `null` for these fields rather than
   *  stripping them (the backend's skipMissingProperties otherwise
   *  treats an empty payload key as "no change"). */
  private explicitlyClearedFields: { [deviceIndex: number]: Set<string> } = {};

  private markCleared(deviceIndex: number, name: string): void {
    if (!this.explicitlyClearedFields[deviceIndex]) {
      this.explicitlyClearedFields[deviceIndex] = new Set();
    }
    this.explicitlyClearedFields[deviceIndex].add(name);
  }

  /** Wire the "—" autocomplete option through clearCountry so the
   *  explicit-clear marker fires (mat-autocomplete's default
   *  optionSelected just setValues, bypassing our markCleared
   *  bookkeeping → submitEdit drops the empty value and France
   *  came back). */
  /** Per-device flag: the user explicitly picked a country from the
   *  autocomplete dropdown. Geocoder respects this and won't
   *  overwrite. Cleared via the "—" option / clearCountry. */
  private userPickedCountry: { [deviceIndex: number]: boolean } = {};

  onCountrySelected(
    deviceIndex: number,
    event: { option: { value: string } },
  ): void {
    const v = event?.option?.value;
    if (v === '') {
      this.clearCountry(deviceIndex);
      this.userPickedCountry[deviceIndex] = false;
    } else if (v) {
      this.userPickedCountry[deviceIndex] = true;
    }
  }

  /** Cancel goes "back" — i.e. wherever the user came from
   *  (admin's All_devices, registrant's All_devices, the search
   *  result they clicked from) — instead of always punting to
   *  /device/MyList. Falls back to the role-appropriate list when
   *  there's no in-app history (e.g. user opened the edit URL
   *  directly). */
  cancelEdit(): void {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (this.user?.role === OrganizationType.Admin) {
      this.router.navigate(['/admin/All_devices']);
    } else if (this.user?.role === OrganizationType.Registrant) {
      this.router.navigate(['/registrant/All_devices']);
    } else {
      this.router.navigate(['/device/MyList']);
    }
  }

  /** Clear the country autocomplete value. */
  clearCountry(deviceIndex: number): void {
    const ctl = this.deviceForms.at(deviceIndex).get('countryCodename');
    if (!ctl) return;
    ctl.setValue('');
    ctl.markAsDirty();
    ctl.markAsTouched();
    // submitEdit renames countryCodename → countryCode before the
    // strip loop runs, so flag both keys as cleared.
    this.markCleared(deviceIndex, 'countryCodename');
    this.markCleared(deviceIndex, 'countryCode');
  }

  /** Total project-photo count = staged + already-saved. Used by
   *  the min-3 red-border rule on the Site Photos slot in edit
   *  mode (where the existing 3 might be the only 3). */
  projectPhotosCount(deviceIndex: number): number {
    const staged = this.files[deviceIndex]?.['PROJECT_PHOTOS']?.length ?? 0;
    const existing =
      this.existingDocs[deviceIndex]?.['PROJECT_PHOTOS']?.length ?? 0;
    return staged + existing;
  }

  hasDocFor(deviceIndex: number, docType: string): boolean {
    const ctrlValue = this.deviceForms.at(deviceIndex)?.get(docType)?.value;
    if (ctrlValue) return true;
    const existing = this.existingDocs[deviceIndex]?.[docType];
    return Array.isArray(existing) && existing.length > 0;
  }

  ocrEligibleDocType(docType: string | null | undefined): boolean {
    if (!docType) return true; // unknown context → leave OCR enabled
    return docType !== 'PROJECT_PHOTOS';
  }

  /**
   * Inline OCR button on a staged file row. Show for:
   *   - Metering evidence images (meter screens)
   *   - Contract / declaration PDFs (PROOF_OF_OWNERSHIP, COD_PROOF,
   *     SF_02, SF_02C, OTHER_DOCUMENTS) — text-layer first, raster
   *     fallback.
   * Hidden for site / project photos (no useful text).
   */
  ocrInlineEligible(docType: string, file: File): boolean {
    if (docType === 'PROJECT_PHOTOS') return false;
    const isImage = file.type.startsWith('image/');
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (docType === 'METERING_EVIDENCE') return isImage || isPdf;
    const contractTypes = new Set([
      'PROOF_OF_OWNERSHIP',
      'COD_PROOF',
      'FORM_SF_02',
      'SF_02',
      'SF_02C',
      'SINGLE_LINE_DIAGRAM',
      'OTHER_DOCUMENTS',
    ]);
    if (contractTypes.has(docType)) return isImage || isPdf;
    return false;
  }

  /**
   * Open a server-saved doc in the preview dialog. Edit-mode only —
   * Add flow has nothing to load. Mirrors edit-device.viewExistingDoc().
   */
  viewExistingDoc(
    doc: { url: string; name: string; id: number },
    docType?: string,
  ): void {
    this.currentPreviewDocType = docType ?? null;
    const ext = doc.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };
    this.deviceService.getDocumentBlob(doc.id).subscribe({
      next: (blob: Blob) => {
        const typed = new Blob([blob], { type: mimeMap[ext] || blob.type });
        const objUrl = URL.createObjectURL(typed);
        this.previewData = {
          url: this.sanitizer.bypassSecurityTrustResourceUrl(objUrl),
          type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
          name: doc.name,
        };
        this.currentPreviewFile = new File([typed], doc.name, {
          type: typed.type,
        });
        this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
          width: '95vw',
          maxWidth: '100vw',
          height: '90vh',
          maxHeight: '100vh',
          panelClass: 'file-preview-dialog',
        });
      },
      error: (err) => {
        const status = err?.status ?? '?';
        const apiMsg = err?.error?.message || err?.message || '';
        const text = apiMsg
          ? `Failed to load "${doc.name}" (HTTP ${status}): ${apiMsg}`
          : `Failed to load "${doc.name}" (HTTP ${status})`;
        // eslint-disable-next-line no-console
        console.error('viewExistingDoc error', { docId: doc.id, err });
        this.toastrService.error(text, '', { timeOut: 8000 });
      },
    });
  }

  /** Per-(deviceIndex, doc) in-flight flag for the "Ingest as readings"
   *  button — keyed `<idx>:<docId>` for existing docs and
   *  `<idx>:staged:<filename>` for not-yet-uploaded files. */
  csvIngesting: Record<string, boolean> = {};

  /** Per-key elapsed-seconds counter for the in-flight ingest. Real
   *  progress would need server-side streaming; this is the cheap
   *  "is it still running?" cue. Driven by setInterval(1000). */
  csvIngestElapsed: Record<string, number> = {};
  private csvIngestTickers: Record<string, ReturnType<typeof setInterval>> = {};

  startCsvIngestTicker(key: string): void {
    this.csvIngestElapsed[key] = 0;
    if (this.csvIngestTickers[key]) clearInterval(this.csvIngestTickers[key]);
    this.csvIngestTickers[key] = setInterval(() => {
      this.csvIngestElapsed[key] = (this.csvIngestElapsed[key] || 0) + 1;
    }, 1000);
  }

  stopCsvIngestTicker(key: string): void {
    if (this.csvIngestTickers[key]) {
      clearInterval(this.csvIngestTickers[key]);
      delete this.csvIngestTickers[key];
    }
    delete this.csvIngestElapsed[key];
  }

  /** "Ingesting… 0:42" style label. Public for the template binding. */
  csvIngestLabel(key: string): string {
    const s = this.csvIngestElapsed[key] || 0;
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `Ingesting… ${mm}:${ss}`;
  }

  /** True when an existingDocs entry's name ends in .csv. Used by the
   *  template's *ngIf for the "Ingest as readings" button. */
  isCsvDoc(doc: { name?: string; label?: string | null }): boolean {
    const name = doc?.name || doc?.label || '';
    return /\.csv$/i.test(name);
  }

  isCsvFile(name: string | null | undefined): boolean {
    return /\.csv$/i.test(name || '');
  }

  /** Ingest a server-saved CSV doc as meter readings. Fetches the file
   *  bytes via the document-uploads streaming endpoint (same path as
   *  replayExtractorsOnExistingDocs), POSTs it to /meter-reads/csv-
   *  ingest, and surfaces the result as a toast. */
  ingestMeterCsvFromExistingDoc(
    deviceIndex: number,
    doc: { id: number; name: string; label?: string | null },
  ): void {
    if (!this.editingExternalId) {
      this.toastrService.warning(
        'Save the device first',
        'Ingest as readings',
      );
      return;
    }
    const key = `${deviceIndex}:${doc.id}`;
    if (this.csvIngesting[key]) return;
    this.csvIngesting[key] = true;
    this.fetchExistingDocAsFile(doc)
      .then((file) =>
        this.runCsvIngest(this.editingExternalId!, file, key, doc.name),
      )
      .catch((err) => {
        this.csvIngesting[key] = false;
        this.toastrService.error(
          err?.message || 'Failed to fetch document',
          'Ingest as readings',
        );
      });
  }

  /** Ingest a staged (not yet uploaded) CSV. Uses the File object
   *  directly — no round-trip needed. */
  ingestMeterCsvFromStagedFile(deviceIndex: number, file: File): void {
    if (!this.editingExternalId) {
      this.toastrService.warning(
        'Save the device first',
        'Ingest as readings',
      );
      return;
    }
    const key = `${deviceIndex}:staged:${file.name}`;
    if (this.csvIngesting[key]) return;
    this.csvIngesting[key] = true;
    this.runCsvIngest(this.editingExternalId, file, key, file.name);
  }

  private async fetchExistingDocAsFile(doc: {
    id: number;
    name: string;
  }): Promise<File> {
    const resp = await fetch(
      `${environment.API_URL}document-uploads/${doc.id}/url`,
      {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('access-token') ?? ''}`,
        },
      },
    );
    if (!resp.ok) {
      throw new Error(`Failed to fetch CSV (${resp.status})`);
    }
    const blob = await resp.blob();
    return new File([blob], doc.name, { type: 'text/csv' });
  }

  /** Generalised variant of fetchExistingDocAsFile — infers the MIME
   *  type from the filename so the resulting File works with image /
   *  PDF / spreadsheet extractors, not just CSV. The CSV-specific
   *  helper above is kept for binary compatibility with existing
   *  ingest callers; this one is the path forward for re-extraction. */
  private async fetchAttachedDocAsFile(doc: {
    id: number;
    name: string;
  }): Promise<File> {
    const resp = await fetch(
      `${environment.API_URL}document-uploads/${doc.id}/url`,
      {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('access-token') ?? ''}`,
        },
      },
    );
    if (!resp.ok) {
      throw new Error(`Failed to fetch ${doc.name} (${resp.status})`);
    }
    const blob = await resp.blob();
    const ext = (doc.name.split('.').pop() || '').toLowerCase();
    const mime =
      ext === 'pdf' ? 'application/pdf' :
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif' ? 'image/gif' :
      ext === 'csv' ? 'text/csv' :
      ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
      ext === 'xls' ? 'application/vnd.ms-excel' :
      blob.type || 'application/octet-stream';
    return new File([blob], doc.name, { type: mime });
  }

  /** Re-run the meter-IDs extractor against every METERING_EVIDENCE
   *  doc already attached to this device. Use when the (14) chips
   *  were flushed and the user needs to rebuild them with proper
   *  per-id source attribution — drag-and-drop would hit isDuplicate
   *  and bounce. This bypasses the auto-sort entirely; it just feeds
   *  each attached doc directly to extractMeterIdsForDevice. */
  reextractMeterIdsFromAttached(deviceIndex: number): void {
    const docs = this.existingDocs[deviceIndex]?.['METERING_EVIDENCE'] ?? [];
    if (!docs.length) {
      this.toastrService.info('No metering evidence attached to re-extract from.');
      return;
    }
    // Clear the in-memory state so old per-id docs don't shadow the
    // refresh (otherwise an ID that came from photo_001.jpg before
    // could keep that attribution even after photo_001.jpg is gone).
    this.meterIdsExtractions[deviceIndex] = [];
    this.meterIdsExtractionDocs[deviceIndex] = {};
    // Also reset the dismiss / uncheck sets — "re-extract from
    // attached" means start over. Without this, any ID that was ever
    // removed via the chip X button (or unticked in a prior
    // Reading-documents review) is silently filtered out of the
    // fresh batch, producing the "No new measurement IDs to add"
    // toast even when the extractor returned real values.
    this.dismissedSerialNumbers[deviceIndex] = new Set();
    if (this.uncheckedExtractedFields[deviceIndex]) {
      // Strip only the meterId:* keys; leave non-meter-id unchecks
      // (e.g. sld:capacity dismissals) alone.
      const keep = new Set<string>();
      for (const k of this.uncheckedExtractedFields[deviceIndex]) {
        if (!k.startsWith('meterId:')) keep.add(k);
      }
      this.uncheckedExtractedFields[deviceIndex] = keep;
    }
    this.meterIdsExtracting[deviceIndex] = true;
    let remaining = docs.length;
    let any = false;
    const done = () => {
      if (--remaining > 0) return;
      this.ngZone.run(() => {
        this.meterIdsExtracting[deviceIndex] = false;
        if (any) {
          this.toastrService.success(
            `Re-extracted from ${docs.length} metering doc${docs.length === 1 ? '' : 's'}.`,
          );
        } else {
          this.toastrService.warning(
            'No meter IDs found in the attached metering docs.',
          );
        }
      });
    };
    for (const doc of docs) {
      this.fetchAttachedDocAsFile(doc)
        .then((file) => {
          // Reuse the existing extractor path so docsByValue gets
          // populated the same way it does for fresh uploads.
          this.extractMeterIdsForDevice(file, deviceIndex);
          any = true;
        })
        .catch((err) => {
          this.toastrService.error(
            `Failed to fetch ${doc.name}: ${err?.message ?? err}`,
          );
        })
        .finally(done);
    }
  }

  private runCsvIngest(
    externalId: string,
    file: File,
    busyKey: string,
    displayName: string,
    replaceExisting = false,
  ): void {
    this.startCsvIngestTicker(busyKey);
    this.meterReadService
      .ingestCsv(externalId, file, { replaceExisting })
      .subscribe({
        next: (result) => {
          this.csvIngesting[busyKey] = false;
          this.stopCsvIngestTicker(busyKey);
          const replacedNote = result.deletedOverlapping
            ? ` (replaced ${result.deletedOverlapping} overlapping)`
            : '';
          this.toastrService.success(
            `Inserted ${result.inserted} readings from ${displayName}${replacedNote} ` +
              `(${result.unit}, ${result.intervalMinutes}-min intervals, ` +
              `column: ${result.parsedColumn}). ` +
              `Skipped ${result.skippedEmpty} empty + ${result.skippedZero} zero rows.`,
            'Readings ingested',
            { timeOut: 8000 },
          );
        },
        error: (err) => {
          this.csvIngesting[busyKey] = false;
          this.stopCsvIngestTicker(busyKey);
          const detail =
            err?.error?.message || err?.message || `HTTP ${err?.status}`;
          const isOverlapConflict =
            err?.status === 409 || /historical entries/i.test(detail);
          if (isOverlapConflict && !replaceExisting) {
            if (
              confirm(
                `${displayName}: existing readings overlap this CSV's date range.\n\n` +
                  `Replace the overlapping reads and re-ingest?`,
              )
            ) {
              this.csvIngesting[busyKey] = true;
              this.runCsvIngest(externalId, file, busyKey, displayName, true);
              return;
            }
          }
          this.toastrService.error(detail, 'Ingest failed', { timeOut: 8000 });
        },
      });
  }

  /** Delete a server-saved doc; only invoked from edit mode. */
  deleteExistingDoc(deviceIndex: number, type: string, docIndex: number): void {
    const doc = this.existingDocs[deviceIndex]?.[type]?.[docIndex];
    if (!doc) return;
    if (!confirm(`Delete "${doc.label || doc.name}"?`)) return;
    if (!this.editingDeviceId) return;
    this.deviceService
      .deleteDocument(this.editingDeviceId, doc.id)
      .subscribe({
        next: () => {
          this.existingDocs[deviceIndex][type].splice(docIndex, 1);
          if (!this.existingDocs[deviceIndex][type].length) {
            delete this.existingDocs[deviceIndex][type];
            if (this.filePreviews[deviceIndex]?.[type]) {
              delete this.filePreviews[deviceIndex][type];
            }
          }
          this.toastrService.success('Document deleted');
        },
        error: (err) => {
          this.toastrService.error(
            err?.error?.message || 'Failed to delete document',
          );
        },
      });
  }

  /**
   * Edit-mode submit. PATCH the existing device via deviceService.update
   * with the first FormArray row's value + any newly-staged files.
   * Mirrors edit-device.component.ts's old onSubmit() but reads from
   * `this.deviceForms.at(0)` instead of `updateDeviceForm`.
   */
  private submitEdit(): void {
    const firstRow = this.deviceForms.at(0) as FormGroup;
    if (!firstRow) {
      this.isSubmitting = false;
      return;
    }

    // Run the inference matchers before we build the payload so any
    // retroactively-credited fields (deviceDescription = "Mini Grid"
    // from impactStory, evidencePathway from opConfig × sourceAccess
    // Mode, …) get persisted into appliedProvenance and ship with
    // this PATCH instead of waiting for a second save round-trip.
    this.collectExtractionClaims(0);

    // Step 1: form-vs-doc disagreements get the interactive picker
    // FIRST. Previously the pre-submit dialog showed the same conflicts
    // as a read-only summary and then this picker opened next — two
    // dialogs back-to-back saying the same thing. Now the picker runs
    // first; once the user has resolved each conflict (keep-form or
    // switch-to-doc), the pre-submit dialog only surfaces issues the
    // picker can't address (empty fields, unextracted-but-extractable).
    // Form-vs-doc conflicts: submit button is disabled while
    // disagreements exist, plus an inline "Resolve N disagreements
    // in the sidebar" message sits next to it. So this code only
    // hits via keyboard / programmatic submit. Refuse silently and
    // scroll to the sidebar — no toast, the inline indicator is
    // already loud enough.
    if (!this.presubmitOverride && this.isEditMode) {
      const conflicts = this.collectFormVsDocConflicts(0);
      if (conflicts.length) {
        this.isSubmitting = false;
        this.scrollToLiveIssues();
        return;
      }
    }

    // Step 2: empty required fields / extractable-but-empty hints.
    // The disagrees bucket is empty here either because the user
    // picked through Step 1 or because there were no conflicts to
    // begin with. Reset the prompt flag for next submit.
    if (!this.presubmitOverride && this.isEditMode) {
      const issues = this.collectPresubmitIssues(0);
      issues.disagrees = [];
      if (issues.empty.length + issues.unextracted.length > 0) {
        this.openPresubmitDialog(issues);
        return;
      }
    }

    // Step 3: attribution gate. Every value must be attributed to
    // either a document (extractor ≥0.7 with docName) or a named
    // registrant (Manual: <email>). The override path skips this
    // for the rare case where a session is mid-recovery and we just
    // need to ship — same flag the empty/unextracted check uses.
    if (!this.presubmitOverride && this.isEditMode) {
      this.openEvidenceReview();
      const dialog = this.evidenceReviewDialogRef;
      if (this.evidenceSummary.unattributed > 0) {
        this.isSubmitting = false;
        if (this.submitSafetyTimer) {
          clearTimeout(this.submitSafetyTimer);
          this.submitSafetyTimer = null;
        }
        this.toastrService.warning(
          `${this.evidenceSummary.unattributed} value${this.evidenceSummary.unattributed === 1 ? '' : 's'} ` +
            `need a subject in charge — either a document or your attestation. ` +
            `Use Flush or Attest in the Review evidence dialog.`,
          'Submit blocked',
          { timeOut: 8000 },
        );
        return;
      }
      // No unattributed values — close the just-opened dialog and
      // continue. (openEvidenceReview opens the dialog even when
      // the count is zero so the user can sanity-check; for the
      // gate path that's not the intent.)
      if (dialog) dialog.close();
    }

    // Reset both flags so future submits re-evaluate.
    this.presubmitOverride = false;
    this.formVsDocPromptShown = false;

    // Defensive: extractors / pasted values may have left an ISO code
    // or short form in countryCodename. Normalise to the canonical
    // full name first so the alpha3 lookup below actually matches.
    // Without this, "VN" falls through to formValue.countryCodename
    // and the backend rejects with "Invalid countryCode".
    const normalisedName = this.normalizeCountry(firstRow.value.countryCodename);
    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === normalisedName,
    );

    const formValue: any = { ...firstRow.value };
    if (normalisedName) formValue.countryCodename = normalisedName;
    formValue.countryCode = selectedCountry?.alpha3 ?? formValue.countryCodename;
    delete formValue.countryCodename;
    formValue.organizationId = this.organizationId ?? this.user?.organizationId;
    // Auto-tag every dirty form value that doesn't already have a
    // provenance entry as Manual:<email>. The user touched it, the
    // value is being submitted — they're implicitly attesting. No
    // more orphans saved to the backend that re-load as MANUAL
    // mystery rows in the next session's evidence review.
    const submitterEmail = (this.user?.email ?? '').trim() || 'unknown';
    const submitterSource = `Manual: ${submitterEmail}`;
    for (const name of Object.keys(firstRow.controls)) {
      const ctl = firstRow.get(name);
      if (!ctl || !ctl.dirty) continue;
      const v = ctl.value;
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (this.appliedProvenance[0]?.[name]?.source) continue;
      this.recordProvenance(0, name, submitterSource, 1, v);
      const entry = this.appliedProvenance[0]?.[name];
      if (entry) {
        (entry as any).verifiedBy = {
          email: submitterEmail,
          at: new Date().toISOString(),
        };
      }
    }
    // Persist the OC# walkthrough log (if any) alongside provenance,
    // under the synthetic __ocWalkLog key. Reviewers can replay it.
    if (this.ocWalkLog.length) {
      (this.appliedProvenance[0] = this.appliedProvenance[0] || {});
      (this.appliedProvenance[0] as any)['__ocWalkLog'] = {
        source: 'OC# walkthrough',
        confidence: 1,
        at: new Date().toISOString(),
        value: [...this.ocWalkLog],
      };
    }
    // Persist provenance recorded by Apply paths + the auto-tag pass
    // above (merged with whatever was already on the device from
    // prior edits).
    if (this.appliedProvenance[0] && Object.keys(this.appliedProvenance[0]).length) {
      formValue.fieldProvenance = { ...this.appliedProvenance[0] };
    }
    if (formValue.serialNumber == null) {
      formValue.serialNumber = this.initSerialNumber;
    }

    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat
        ? `${intLat}.${decLat.slice(0, 20)}`
        : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng
        ? `${intLng}.${decLng.slice(0, 20)}`
        : intLng;
    }

    if (Array.isArray(formValue.labellingSchemeAccreditation)) {
      formValue.labellingSchemeAccreditation =
        formValue.labellingSchemeAccreditation.join('; ') || null;
    }

    // Strip null/undefined/''/NaN keys so backend skipMissingProperties
    // treats this as a partial update — EXCEPT:
    //   1. Fields explicitly cleared via the UI (× / "—" affordances).
    //   2. Fields that had a value when the form loaded but are now
    //      empty (the user wiped them).
    // Those go out as `null` so the backend nulls the column; without
    // this, skipMissingProperties keeps the old value and "blank"
    // is not a valid entry in edit mode.
    const cleared = this.explicitlyClearedFields[0] ?? new Set<string>();
    const wasInitiallySet = (k: string) => {
      const init = this.initialValues[k];
      return init != null && init !== '' && !(Array.isArray(init) && init.length === 0);
    };
    for (const k of Object.keys(formValue)) {
      const v = (formValue as any)[k];
      const isEmpty =
        v === null ||
        v === undefined ||
        v === '' ||
        (typeof v === 'number' && isNaN(v));
      if (!isEmpty) continue;
      if (cleared.has(k) || wasInitiallySet(k)) {
        (formValue as any)[k] = null;
      } else {
        delete (formValue as any)[k];
      }
    }

    // Strip the per-doc-type form-control keys — backend doesn't expect
    // them on the device DTO; they're file-input bindings only.
    for (const ft of this.requiredFileTypes) {
      delete (formValue as any)[ft];
    }
    delete (formValue as any).OTHER_DOCUMENTS;
    delete (formValue as any).sf02EvidenceMode;

    const fileBucket = this.files[0] || ({} as DeviceFiles);
    const fileFields: FileType[] = [
      DocumentType.FORM_SF_02,
      DocumentType.SF_02C,
      DocumentType.PROOF_OF_OWNERSHIP,
      DocumentType.METERING_EVIDENCE,
      DocumentType.SINGLE_LINE_DIAGRAM,
      DocumentType.PROJECT_PHOTOS,
      DocumentType.COD_PROOF,
      DocumentType.OTHER_DOCUMENTS,
    ];
    const hasFiles = fileFields.some((ft) => fileBucket[ft]?.length > 0);

    let payload: FormData | Record<string, any>;
    if (hasFiles) {
      const formData = new FormData();
      formData.append('deviceToUpdate', JSON.stringify(formValue));
      const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
      const maxSizeInMB = 20;
      let allErrors: Record<string, string[]> = {};
      fileFields.forEach((fileType: FileType) => {
        const files = fileBucket[fileType];
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
        this.isSubmitting = false;
        return;
      }
      payload = formData;
    } else {
      payload = formValue;
    }

    const serialChanged =
      formValue.serialNumber !== this.initSerialNumber;

    const sf02Mode = firstRow.get('sf02EvidenceMode')?.value;
    const shouldRegenerateSf02 =
      sf02Mode === 'self' && this.editingDeviceId != null;

    const navigateAway = (): void => {
      if (this.user.role === OrganizationType.Admin) {
        this.router.navigate(['/admin/All_devices']);
      } else if (this.user.role === OrganizationType.Registrant) {
        this.router.navigate(['/registrant/All_devices']);
      } else {
        this.router.navigate(['/device/AllList']);
      }
    };

    this.deviceService
      .update(this.editingExternalId, payload, serialChanged)
      .subscribe({
        next: (data: any) => {
          const siteLabel =
            data?.siteName || this.initSiteName || this.editingExternalId;
          this.toastrService.success(`site "${siteLabel}" updated`);
          // Auto-regenerate the EVIDENCE_PROVENANCE report so reviewers
          // always see provenance reflecting the just-saved state.
          // Fire-and-forget; failures don't block submit/navigation.
          this.generateProvenanceReport(0);
          // If there were open reviewer notes when we landed on this
          // page, drop a system message into the device chat so the
          // reviewer gets an unread badge and a concrete "registrant
          // addressed this — please re-check" signal. Otherwise the
          // reviewer would have to keep refreshing.
          this.notifyReviewerOfUpdate(siteLabel);
          // SF-02 regen happens server-side via
          // device.controller's maybeRegenerateAutoSf02 hook on
          // PATCH success — the previous explicit POST from here
          // double-fired the audit (sf02_generated landed twice).
          navigateAway();
        },
        error: (err: any) => {
          console.error('error caught in component', err?.error?.message);
          this.submitButtonText = 'Submit';
          this.isSubmitting = false;
          const message =
            err?.error?.message || err?.message || 'Failed to update device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else {
            this.toastrService.error(
              message,
              'Device ' + this.editingExternalId,
            );
          }
        },
      });
  }

  openPopupDialog() {
    // Legal confirmation dialog removed — submit directly.
    this.submitForm();
    return;
    this.dialogRef = this.dialog.open(this.popupDialog, {
      width: '700px',
    });
    this.dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.submitForm();
      } else {
        this.isSubmitting = false;
      }
    });
  }

  onAgreeClick() {
    this.submitButtonText = 'Submitting...';
    this.dialogRef.close(true);
  }

  mapAdjusting = false;
  coordsDirty = false;
  private mapCenterUpdating = false;
  private savedCoords: { lat: string; lng: string } | null = null;
  private coordDeviceIndex = 0;

  onMapCenterChanged(
    center: { lat: number; lng: number },
    deviceIndex: number,
  ): void {
    if (this.mapCenterUpdating) return;
    this.mapCenterUpdating = true;
    const group = this.deviceForms.at(deviceIndex);
    if (group) {
      if (!this.savedCoords) {
        this.savedCoords = {
          lat: group.get('latitude')?.value || '',
          lng: group.get('longitude')?.value || '',
        };
        this.coordDeviceIndex = deviceIndex;
      }
      group.get('latitude')?.setValue(center.lat, { emitEvent: false });
      group.get('longitude')?.setValue(center.lng, { emitEvent: false });
      // Only mark dirty if coords actually changed from the original
      const origLat = parseFloat(this.savedCoords.lat);
      const origLng = parseFloat(this.savedCoords.lng);
      this.coordsDirty = center.lat !== origLat || center.lng !== origLng;
    }
    this.mapCenterUpdating = false;
  }

  onCoordPaste(event: ClipboardEvent, deviceIndex: number): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const parts = text
      .split(/\t+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length !== 2) return;
    if (isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) return;
    event.preventDefault();
    const group = this.deviceForms.at(deviceIndex);
    group.get('latitude')?.setValue(parts[0]);
    group.get('longitude')?.setValue(parts[1]);
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    this.mapComponent?.recenter(lat, lng);
    this.satelliteMapComponent?.recenter(lat, lng);
  }

  cancelCoordChange(): void {
    if (!this.savedCoords) return;
    const group = this.deviceForms.at(this.coordDeviceIndex);
    if (group) {
      group
        .get('latitude')
        ?.setValue(this.savedCoords.lat, { emitEvent: false });
      group
        .get('longitude')
        ?.setValue(this.savedCoords.lng, { emitEvent: false });
      const lat = parseFloat(this.savedCoords.lat);
      const lng = parseFloat(this.savedCoords.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        this.mapComponent?.recenter(lat, lng);
        this.satelliteMapComponent?.recenter(lat, lng);
      }
    }
    this.savedCoords = null;
    this.coordsDirty = false;
  }

  confirmCoordChange(): void {
    this.savedCoords = null;
    this.coordsDirty = false;
  }

  onScreenshotFromMap(file: File, deviceIndex: number): void {
    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }
    // Map screenshot of the current site (with EXIF GPS) is saved as a Site Photo.
    if (!this.files[deviceIndex][DocumentType.PROJECT_PHOTOS]) {
      this.files[deviceIndex][DocumentType.PROJECT_PHOTOS] = [];
    }
    this.files[deviceIndex][DocumentType.PROJECT_PHOTOS].push(file);

    if (!this.filePreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = {};
    }
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[deviceIndex][DocumentType.PROJECT_PHOTOS] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: 'image',
      name: file.name,
    };

    this.toastrService.success(
      `Map capture "${file.name}" added as a Site Photo (GPS embedded). Submit to upload.`,
      'Captured',
    );
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      const markers = [{ latitude: lat, longitude: lng }];

      if (this.mapComponent) {
        this.mapComponent.markers = [...markers];
        if (this.mapComponent.isMapInitialized) {
          this.mapComponent.update();
          // Recenter so the user's new coords actually come into
          // view — placing a marker without recentring leaves the
          // map sitting on whatever it was last centred on (the
          // hydrated coords, the default, or the last edit), and
          // the registrant has to pan manually. The satellite
          // view is the verification surface so it especially
          // needs to stay in sync with the typed coords.
          this.mapComponent.recenter(lat, lng);
        }
      }

      if (this.satelliteMapComponent) {
        this.satelliteMapComponent.markers = [...markers];
        if (this.satelliteMapComponent.isMapInitialized) {
          this.satelliteMapComponent.update();
          this.satelliteMapComponent.recenter(lat, lng);
        }
      }
    }
  }
}
