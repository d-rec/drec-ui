import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');

Cypress.Commands.add('developerUserSignup', function () {
  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy
            .get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            })
            .wait(2000);
        case 'browse-documents':
          cy.get(step.selector).each(($input) => {
            cy.wrap($input).attachFile('files/meter_reads_2025-05-14.pdf', {
              force: true,
            });
          });
          break;

        case 'verify-phone':
          cy.visit(`${UI_BASE_URL}/verify-otp`).wait(5000);
          const MOCK_OTP_CODE = '123456';

          cy.intercept('POST', `${UI_BASE_URL}/api/otp/send`, {
            statusCode: 201,
          }).as('sendOtp');

          cy.intercept('POST', `${UI_BASE_URL}/api/otp/verify`, {
            statusCode: 200,
          }).as('verifyOtp');

          cy.get('[test-id="resend-otp"]').click();

          for (let i = 0; i < MOCK_OTP_CODE.length; i++) {
            cy.get('[test-id="otp-inputs"]').eq(i).type(MOCK_OTP_CODE[i]);
          }

          cy.get('.otp-container').submit();
          break;

        case 'verify-email':
          const MOCK_EMAIL_CODE = '123456';

          cy.get('[test-id="resend-confirmation-email"]').click();
          cy.wait(1000);
          cy.request({
            method: 'PUT',
            url: `${REACT_APP_BACKEND_URL}/api/user/confirm-email/${MOCK_EMAIL_CODE}`,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.eq(200);
          });
          break;
        case 'submit':
          cy.get(step.selector).click().wait(20000);
          return cy.contains('successfully');
      }
    });
  });
});
