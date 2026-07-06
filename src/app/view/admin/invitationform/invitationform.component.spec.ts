import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { InvitationformComponent } from './invitationform.component';
import {
  AdminService,
  UserService,
  InvitationService,
} from '../../../auth/services';

describe('InvitationformComponent', () => {
  let component: InvitationformComponent;
  let fixture: ComponentFixture<InvitationformComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Standalone component → imports, not declarations.
      imports: [InvitationformComponent, NoopAnimationsModule],
      providers: [
        // A preselected org keeps ngOnInit off the GetAllOrganization
        // path, so the service stubs can stay empty.
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Invite a user',
            orginfo: { id: 1, organizationType: 'Registrant' },
          },
        },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: AdminService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: InvitationService, useValue: {} },
        {
          provide: ToastrService,
          useValue: { success: () => undefined, error: () => undefined },
        },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the dialog title from MAT_DIALOG_DATA', () => {
    expect(component.title).toBe('Invite a user');
  });
});
