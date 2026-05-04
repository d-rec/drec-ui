import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
  AdminService,
  UserService,
  InvitationService,
} from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-invitationform',
  templateUrl: './invitationform.component.html',
  styleUrls: ['./invitationform.component.scss'],
})
export class InvitationformComponent {
  title: string;
  message: string;
  inviteForm: FormGroup;
  invitaionlist: any;

  emailregex: RegExp =
    // eslint-disable-next-line no-useless-escape
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  orgtype: any[] = [
    { value: 'SiteOperator', viewValue: 'SiteOperator' },
    { value: 'User', viewValue: 'User' },
  ];
  orgtypebuyer: any[] = [
    { value: 'SubBuyer', viewValue: 'SubBuyer' },

    { value: 'User', viewValue: 'User' },
  ];
  loginuser: any;
  role: any;
  orgs: any[] = [];
  preselectedOrg: any;
  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private inveiteService: InvitationService,

    public dialogRef: MatDialogRef<InvitationformComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.preselectedOrg = data.orginfo ?? null;
    this.data = this.preselectedOrg;
    this.applyOrgType(this.preselectedOrg?.organizationType);
  }
  ngOnInit() {
    this.inviteForm = this.fb.group({
      orgId: [this.preselectedOrg?.id ?? null, [Validators.required]],
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });

    if (!this.preselectedOrg) {
      this.adminService.GetAllOrganization().subscribe((data: any) => {
        this.orgs = (data?.organizations ?? []).filter(
          (o: any) =>
            o.organizationType === 'Registrant' ||
            o.organizationType === 'Buyer',
        );
      });
      this.inviteForm.get('orgId')?.valueChanges.subscribe((id: number) => {
        const org = this.orgs.find((o) => o.id === id);
        this.data = org ?? null;
        this.applyOrgType(org?.organizationType);
        // role options depend on org type — clear selection
        this.inviteForm.get('role')?.setValue(null);
      });
    }
  }

  private applyOrgType(type: string | undefined) {
    this.role =
      type === 'Registrant' ? 'Registrant' : type === 'Buyer' ? 'Buyer' : null;
  }
  emaiErrors() {
    return this.inviteForm.get('email')?.hasError('required')
      ? 'This field is required'
      : this.inviteForm.get('email')?.hasError('pattern')
        ? 'Not a valid emailaddress'
        : '';
  }
  start() {
    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });
  }
  async onSubmit() {
    const targetOrgId = this.inviteForm.value.orgId ?? this.data?.id;
    if (!targetOrgId) {
      this.toastrService.error(
        'Pick an organization first.',
        'Invitation Fail',
      );
      return;
    }
    const { orgId: _orgId, ...payload } = this.inviteForm.value;
    this.inveiteService.Postuserinvitation(payload, targetOrgId).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastrService.success('Invitation Sent');
          this.dialogRef.close(true);
        }
      },
      error: (err) => {
        if (err.error.statusCode === 403) {
          this.toastrService.error('You are Unauthorized');
        }
        this.toastrService.error(
          'Error:' + err.error.message,
          'Invitation Fail',
        );
      },
    });
  }
  getinvitationList() {
    this.inveiteService.getinvitaion().subscribe({
      next: (data) => {
        this.invitaionlist = data;
      },
      error: (err) => {
        this.toastrService.error('failed', err);
      },
    });
  }
}
