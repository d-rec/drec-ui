Cypress.Commands.add('addAggregateMeterRead', function () {
  cy.fixture('add-aggregate-meter-read.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);

        case 'selected':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .should('be.visible')
            .click({ force: true })
            .wait(1000);

        case 'select-timezone':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });

        case 'select':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(2)
            .click('center', { force: true });

        case 'type':
          return cy
            .get(step.selector)
            .click({ force: true })
            .type(step.value, { force: true });

        case 'date-picker':
          const currentTime = new Date();
          currentTime.setMinutes(currentTime.getMinutes() + -1);

          const formattedTime = currentTime.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });

          return cy
            .get(step.selector)
            .click({ force: true })
            .type(formattedTime, { force: true })
            .click();
        case 'submit':
          cy.get(step.selector).click('center', { force: true });

          return cy
            .contains(
              'In this device you can add read for Delta type but you are sending Aggregate',
            )
            .should('be.visible');
      }
    });
  });
});
