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
          cy.wait(5000);
          cy.get(step.selector).each(($input) => {
            cy.wrap($input).attachFile('files/meter_reads_2025-05-14.pdf', {
              force: true,
            });
          });
          break;

        case 'verify-phone':
          cy.visit(`${UI_BASE_URL}/verify-otp`);
          const MOCK_OTP_CODE = '123456';

          cy.intercept('POST', `${UI_BASE_URL}/api/otp/send`, {
            statusCode: 201,
            body: { message: 'OTP sent (mock)', testCode: MOCK_OTP_CODE },
          }).as('sendOtp');

          cy.intercept('POST', `${UI_BASE_URL}/api/otp/verify`, (req) => {
            const { code } = req.body;

            if (code === MOCK_OTP_CODE) {
              req.reply({
                statusCode: 200,
                body: { message: 'Phone number verified successfully.' },
              });
            } else {
              req.reply({
                statusCode: 400,
                body: { message: 'Invalid OTP' },
              });
            }
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
          cy.wait(5000);
          cy.request({
            method: 'PUT',
            url: `${REACT_APP_BACKEND_URL}/api/user/confirm-email/${MOCK_EMAIL_CODE}`,
            failOnStatusCode: false, // optional: if you're testing both success/failure cases
          });
          break;
      }
    });
  });
});
