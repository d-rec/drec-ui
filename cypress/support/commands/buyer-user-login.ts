import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('buyerUserLogin', function () {
  cy.fixture('buyer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy.get(step.selector).type(step.value);
      }
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
    });
  });
});
