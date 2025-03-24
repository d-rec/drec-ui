import 'cypress-file-upload';

Cypress.Commands.add('developerUserPermissionsSetup', function () {
  cy.fixture('developer-user-permissions-setup.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).should('be.visible').click();
          break;
        case 'select':
          cy.get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(1)
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
