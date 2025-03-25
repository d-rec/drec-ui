import 'cypress-file-upload';
Cypress.Commands.add('addHistoryMeterRead', function () {
  cy.fixture('add-history-meter-read.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click().wait(1000);
          break;

        case 'selected':
          cy.get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .should('be.visible')
            .click({ force: true })
            .wait(1000);
          break;

        case 'select-timezone':
          cy.get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });
          break;

        case 'select':
          cy.get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });
          break;

        case 'type':
          cy.get(step.selector)
            .click({ force: true })
            .type(step.value, { force: true });
          break;

        case 'start-date':
          cy.get(step.selector)
            .eq(0)
            .click('center', { force: true })
            .get(step.option)
            .eq(0)
            .click()
            .get('.mat-stroked-button')
            .click();
          break;

        case 'end-date':
          cy.get(step.selector)
            .eq(1)
            .click('center', { force: true })
            .get(step.option)
            .eq(5)
            .click()
            .get('.mat-stroked-button')
            .click();
      }
    });
  });
});
