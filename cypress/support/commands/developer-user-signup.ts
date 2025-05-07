// cypress/support/commands/developer-user-signup.ts

import 'cypress-file-upload';

const UI_BASE_URL = Cypress.env('UI_BASE_URL');

/**
 * Waits for a specific email with given subject in the Mailisk inbox.
 */
function waitForMailiskEmail(
  email: string,
  subject: string,
  timeout = 15000,
  interval = 2000,
): Cypress.Chainable<any> {
  const start = Date.now();

  const checkInbox = (): Cypress.Chainable<any> => {
    return cy.mailiskSearchInbox({ to: email }).then((response: any) => {
      const emails = Array.isArray(response)
        ? response
        : response?.emails || [];

      const match = emails.find((e: any) => e.subject === subject);
      if (match) return cy.wrap(match);

      if (Date.now() - start > timeout) {
        throw new Error(
          `Timeout: Email with subject "${subject}" not received within ${timeout}ms`,
        );
      }

      return cy.wait(interval).then(checkInbox);
    });
  };

  return checkInbox();
}

Cypress.Commands.add('developerUserSignup', function () {
  const testEmail = `test.${Date.now()}@${Cypress.env('MAILISK_NAMESPACE')}.mailisk.net`;

  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      const value = step.value === '{{email}}' ? testEmail : step.value;
      switch (step.action) {
        case 'type':
          return cy.get(step.selector).type(value).should('have.value', value);
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            });
      }
    });

    // Wait for email and extract verification code
    waitForMailiskEmail(testEmail, 'Verify your email').then((email: any) => {
      cy.mailiskGetEmail(email.id).then((fullEmail: any) => {
        const codeMatch = fullEmail.text?.match(/code is (\w+)/);
        expect(codeMatch).to.exist;

        const code = codeMatch![1];

        cy.visit('/verify-email');
        cy.get('#verification-code').type(code);
        cy.get('button[type=submit]').click();
        cy.contains('Email verified successfully').should('be.visible');
      });
    });
  });
});
