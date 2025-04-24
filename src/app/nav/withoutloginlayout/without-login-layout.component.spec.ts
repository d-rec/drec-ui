import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WithoutLoginLayoutComponent } from './without-login-layout.component';

describe('WithoutloginlayoutComponent', () => {
  let component: WithoutLoginLayoutComponent;
  let fixture: ComponentFixture<WithoutLoginLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WithoutLoginLayoutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WithoutLoginLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
