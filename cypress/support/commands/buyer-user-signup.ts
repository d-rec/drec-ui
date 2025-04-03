import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('buyerUserSignup', function () {
  cy.fixture('buyer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy
            .get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
        case 'click':
          return cy.get(step.selector).click();
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            });

        case 'submit':
          cy.get(step.selector).scrollIntoView().should('be.visible').click();
          return cy.contains('login Success').should('be.visible');

          return cy.document().then((doc) => {
            if (doc.body.innerText.includes('login Success')) {
              cy.contains('login Success').should('be.visible');
            } else {
              cy.contains('User with email').should('be.visible');
            }
          });
      }
    });
  });
});
