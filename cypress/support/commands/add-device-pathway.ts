Cypress.Commands.add('addDevicePathway', function () {
  cy.fixture('add-device-pathway.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click({ multiple: true }).wait(1000);

        case 'type':
          return cy
            .get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });
        case 'select':
          if (step.option === '[country-test-id]') {
            return cy
              .get(step.selector)
              .click({ force: true })
              .get(step.option)
              .contains('Rwanda')
              .eq(0)
              .click('center', { force: true });
          } else {
            return cy
              .get(step.selector)
              .click({ force: true })
              .get(step.option)
              .should('have.length.greaterThan', 0)
              .eq(0)
              .click('center', { force: true });
          }
        case 'check':
          return cy.get(step.selector).wait(3000).eq(step.index).click();
        case 'continue':
          return cy.get(step.selector).click('center', { force: true });
      }
    });
  });
});
