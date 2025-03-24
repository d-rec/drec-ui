import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('developerUserSignup', function () {
  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          cy.get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
          break;
        case 'click':
          cy.get(step.selector).click();
          break;
        case 'select':
          cy.get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            });
      }
    });
  });
});
