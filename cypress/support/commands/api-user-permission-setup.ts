Cypress.Commands.add('ApiUserPermissionsSetup', function () {
  cy.fixture('api-user-permission-setup.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'check':
          return cy.get(step.selector).eq(step.index).click();
        case 'check-multiple':
          return cy.contains('table tr', step.contains).within(() => {
            cy.get(step.selector).each(($el) => {
              if (!$el.hasClass('mdc-checkbox--disabled')) {
                cy.wrap($el).click({ force: true });
              } else {
                cy.log(`Skipping disabled checkbox: ${$el.attr('id')}`);
              }
            });
          });
        case 'submit':
          cy.get(step.selector).scrollIntoView().should('be.visible').click();
      }
    });
  });
});
