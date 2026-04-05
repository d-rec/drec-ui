import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrantClientReponseComponent } from './registrant-client-reponse.component';

describe('RegistrantClientReponseComponent', () => {
  let component: RegistrantClientReponseComponent;
  let fixture: ComponentFixture<RegistrantClientReponseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistrantClientReponseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrantClientReponseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
