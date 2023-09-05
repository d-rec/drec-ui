import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AdminService, OrganizationService } from '../../auth/services'
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
  title: string;
  message: string;
  showchangeform: boolean = false;
  user: any;
  alluserlist: any
  roleForm:FormGroup
  userId:number;
  role:string='OrganizationAdmin'
  constructor(private fb: FormBuilder,
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private adminService: AdminService,
    private organizationService: OrganizationService) {
    if (data.showchangeform) {
      this.showchangeform = true;
      this.user = data.data;
    }
  }
  ngOnInit() {
    this.getAlluseroforg();
    this.roleForm = this.fb.group({
      role: [null, Validators.required],
    })
  }

  getAlluseroforg() {
    this.adminService.GetAllOrgnaizationUsers(this.user.organization.id).subscribe({
      next: data => {

        this.alluserlist = data
      }
    })
  }
  onUpdateorgadminrole() {

    this.organizationService.changeOrguserRole(this.user.organization.id,this.user.id,this.roleForm.value).subscribe((data) => {
      console.log(data);

      //this.toastrService.success("User Updated", "Successfully")
      // this.dialogRef.close;

    })

  }
}
