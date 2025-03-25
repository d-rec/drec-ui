import 'cypress-file-upload';

Cypress.Commands.add('buyerUserPermissionsSetup', function () {
  cy.fixture('buyer-user-permissions-setup.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).wait(10000).should('be.visible').click();
          break;
        case 'select':
          cy.get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(3)
            .click();
          break;
        case 'check':
          cy.get(step.selector).eq(step.index).click();
          break;
        case 'check-multiple':
          cy.contains('table tr', step.contains).within(() => {
            cy.get(step.selector).each(($el) => {
              cy.wrap($el).click();
            });
          });
          break;
        case 'submit':
          cy.get(step.selector).scrollIntoView().should('be.visible').click();
      }
    });
  });
});
