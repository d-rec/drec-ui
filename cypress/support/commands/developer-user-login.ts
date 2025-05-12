import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
const testEmailAddress = `dev1@${Cypress.env('MAILISK_NAMESPACE')}.mailisk.net`;

Cypress.Commands.add('developerUserLogin', function () {
  cy.fixture('developer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          if (step.selector === "[test-id='login-username']") {
            return cy
              .get(step.selector)
              .type(testEmailAddress)
              .should('have.value', testEmailAddress);
          }
          return cy.get(step.selector).type(step.value);
        case 'click':
          return cy.get(step.selector).click().wait(1000);
      }
    });

    // cy.get('[test-id="terms-and-conditions"]')
    //   .should('exist')
    //   .then(($checkbox) => {
    //     if ($checkbox.length > 0) {
    //       cy.wrap($checkbox).click({ force: true });
    //     } else {
    //       cy.log('Terms and conditions checkbox not found.');
    //     }
    //   });
    // cy.get('[test-id="accept-terms-and-conditions"]')
    //   .should('exist')
    //   .then(($button) => {
    //     if ($button.length > 0) {
    //       cy.wrap($button).click({ force: true });
    //     } else {
    //       cy.log('Accept terms and conditions button not found.');
    //     }
    //   });
  });
});
