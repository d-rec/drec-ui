import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');
const MAILOSAUR_SERVER_ID = 'ceuazndf';

Cypress.Commands.add('developerUserLogin', function () {
  cy.fixture('developer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy.get(step.selector).type(step.value);
        case 'click':
          return cy.get(step.selector).click({ multiple: true }).wait(3000);
        case 'browse-documents':
          cy.visit(`${UI_BASE_URL}/documents-upload`).wait(3000);
          cy.get(step.selector).each(($input) => {
            cy.wrap($input).attachFile('files/meter_reads_2025-05-14.pdf', {
              force: true,
            });
          });
          break;

        case 'verify-phone':
          const MOCK_OTP_CODE = '123456'; // Assuming 6-digit OTP
          // Intercept OTP send request
          cy.intercept('POST', '/api/otp/send', {
            statusCode: 201,
            body: { message: 'OTP sent (mock)', testCode: MOCK_OTP_CODE },
          }).as('sendOtp');
          cy.intercept('POST', '/api/otp/verify', (req) => {
            if (req.body.code === MOCK_OTP_CODE) {
              req.reply({ message: 'Phone number verified successfully.' });
            } else {
              req.reply({ statusCode: 400, body: { message: 'Invalid OTP' } });
            }
          }).as('verifyOtp');

          // Fixed the typo in the selector from "resend-opt" to "resend-otp"
          cy.get('[test-id="resend-otp"]').should('be.visible').click();

          // Wait for and log the intercepted response
          cy.wait('@sendOtp').then((interception) => {
            const testCode = interception.response?.body?.testCode;
            cy.log(`Intercepted test OTP: ${testCode}`);
            console.log('Intercepted test OTP:', testCode);
          });

          // Fill OTP fields using the code
          for (let i = 0; i < MOCK_OTP_CODE.length; i++) {
            cy.get('[test-id="otp-inputs"]').eq(i).type(MOCK_OTP_CODE[i]);
          }

          // Submit the OTP form
          cy.get('.otp-container').submit();

          // Wait for verification
          cy.wait('@verifyOtp');
          break;

        case 'mockPhoneVerified':
          cy.mockPhoneVerified();
      }
    });
  });
});
