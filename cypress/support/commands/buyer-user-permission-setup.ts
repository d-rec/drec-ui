import 'cypress-file-upload';

Cypress.Commands.add('buyerUserPermissionsSetup', function () {
  cy.fixture('buyer-user-permissions-setup.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).wait(10000).should('be.visible').click();
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(3)
          .click()
          .wait(1000);
      }
      if (step.action === 'check') {
        return cy.get(step.selector).eq(step.index).click();
      }
      if (step.action === 'check-multiple') {
        return cy.contains('table tr', step.contains).within(() => {
          cy.get(step.selector).each(($el) => {
            cy.wrap($el).click();
          });
        });
      }
      if (step.action === 'submit') {
        return cy
          .get(step.selector)
          .scrollIntoView()
          .should('be.visible')
          .click();
      }
    });
  });
});
