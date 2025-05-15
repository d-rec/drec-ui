import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

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

          // Set up interception for the OTP send endpoint
          // Using the correct URL structure based on your error message
          cy.intercept('POST', `${UI_BASE_URL}/api/otp/send`, {
            statusCode: 201,
            body: { message: 'OTP sent (mock)', testCode: MOCK_OTP_CODE },
          }).as('sendOtp');

          // Set up interception for the OTP verify endpoint
          cy.intercept('POST', `${UI_BASE_URL}/api/otp/verify`, (req) => {
            const { code } = req.body;

            // Optional: log or assert the code
            expect(code, 'OTP code is sent').to.exist;

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

          // Click the button to trigger the send OTP request
          cy.get('[test-id="resend-otp"]').should('be.visible').click();

          // Fill OTP fields using the intercepted code
          for (let i = 0; i < MOCK_OTP_CODE.length; i++) {
            cy.get('[test-id="otp-inputs"]').eq(i).type(MOCK_OTP_CODE[i]);
          }

          // Submit the OTP form
          cy.get('.otp-container').submit();

          // Wait for verification request
          cy.wait('@verifyOtp');
      }
    });
  });
});
