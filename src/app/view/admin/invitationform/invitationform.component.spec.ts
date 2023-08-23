import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvitationformComponent } from './invitationform.component';

describe('InvitationformComponent', () => {
  let component: InvitationformComponent;
  let fixture: ComponentFixture<InvitationformComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InvitationformComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvitationformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
