import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('buyerUserSignup', function () {
  cy.fixture('buyer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .type(step.value)
          .should('have.value', step.value);
      }
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .then(() => {
            cy.get('mat-option').contains(step.value).click();
          });
      }
    });
  });
});
