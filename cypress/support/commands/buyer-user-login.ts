import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('buyerUserLogin', function () {
  cy.fixture('buyer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy.get(step.selector).type(step.value);

        case 'click':
          return cy.get(step.selector).click({ multiple: true }).wait(3000);

        case 'browse-documents':
          cy.get(step.selector).each(($input) => {
            cy.wrap($input).attachFile('files/meter_reads_2025-05-14.pdf', {
              force: true,
            });
          });
          break;

        case 'verify-phone':
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
      }
    });
  });
});
