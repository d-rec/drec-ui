import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
const MAILOSAUR_SERVER_ID = 'ceuazndf';
const shortEmailAddress = `test6@${MAILOSAUR_SERVER_ID}.mailosaur.net`;

Cypress.Commands.add('developerUserLogin', function () {
  cy.fixture('developer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          if (step.selector === "[test-id='login-username']") {
            return cy
              .get(step.selector)
              .should('be.visible')
              .type(shortEmailAddress)
              .should('have.value', shortEmailAddress);
          } else {
            return cy.get(step.selector).type(step.value);
          }
        case 'click':
          return cy.get(step.selector).click().wait(1000);
      }
    });
  });
});
