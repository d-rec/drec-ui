import 'cypress-file-upload';
Cypress.Commands.add('addDevice', function () {
  cy.fixture('add-device.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click().wait(1000);
          break;

        case 'type':
          cy.get(step.selector).should('be.visible').type(step.value);
          break;

        case 'write':
          cy.get(step.selector)
            .should('be.visible')
            .clear()
            .type(step.value + '{enter}');
          break;

        case 'select':
          cy.get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click();
          break;

        case 'submit':
          cy.get(step.selector).click('center', { force: true });
      }
    });
  });
});
