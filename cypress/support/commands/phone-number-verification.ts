import { generateOtp, getOtp } from './mock-sms-service';

Cypress.Commands.add('verifyPhoneNumber', () => {
  cy.fixture('buyer-user-signup.json').then((steps) => {
    const phoneStep = steps.find(
      (step) => step.selector === "[test-id='phone-number']",
    );
    const phoneNumber = phoneStep?.value;

    if (!phoneNumber) {
      throw new Error('Phone number not found in fixture!');
    }

    cy.intercept('POST', '/api/send-otp', (req) => {
      const otp = generateOtp(phoneNumber);
      req.reply({ success: true, otp });
    }).as('sendOtp');

    cy.get('[data-test=submit-phone]').click();
    cy.wait('@sendOtp');

    const otp = getOtp(phoneNumber);
    cy.get('[data-test=otp-input]')
      .should('be.visible')
      .type(otp || '');
    cy.get('[data-test=verify-otp]').click();
    cy.get('[data-test=verification-success]').should('be.visible');
  });
});
