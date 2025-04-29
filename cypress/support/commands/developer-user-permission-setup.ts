import 'cypress-file-upload';

Cypress.Commands.add('developerUserPermissionsSetup', function () {
  cy.fixture('developer-user-permissions-setup.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).should('be.visible').click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(1)
            .click()
            .wait(1000);
        case 'check':
          return cy.get(step.selector).eq(step.index).click();
        case 'check-multiple':
          return cy.contains('table tr', step.contains).within(() => {
            cy.get(step.selector).each(($el) => {
              cy.wrap($el).click();
            });
          });
        case 'submit':
          cy.get(step.selector).scrollIntoView().should('be.visible').click();
          return cy.contains('SuccessFul').should('be.visible');
      }
    });
  });
});
