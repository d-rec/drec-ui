import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiuserClientReponseComponent } from './apiuser-client-reponse.component';

describe('ApiuserClientReponseComponent', () => {
  let component: ApiuserClientReponseComponent;
  let fixture: ComponentFixture<ApiuserClientReponseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApiuserClientReponseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiuserClientReponseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
