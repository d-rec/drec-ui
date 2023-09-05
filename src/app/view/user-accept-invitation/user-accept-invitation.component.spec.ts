import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAcceptInvitationComponent } from './user-accept-invitation.component';

describe('UserAcceptInvitationComponent', () => {
  let component: UserAcceptInvitationComponent;
  let fixture: ComponentFixture<UserAcceptInvitationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserAcceptInvitationComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserAcceptInvitationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
