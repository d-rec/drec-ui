describe('Buyer User Signup', () => {
  it('signs up and verifies email using Mailosaur', () => {
    cy.createTestInbox().then(({ id, fullEmailAddress, shortEmailAddress }) => {
      cy.fixture('buyer-user-signup.json').then((data) => {
        const emailStep = data.find(
          (step) => step.selector === "[test-id='email']",
        );

        if (!emailStep) {
          throw new Error('Email selector not found in the JSON fixture');
        }

        emailStep.value = shortEmailAddress;

        cy.visit(`${Cypress.env('UI_BASE_URL')}/login`);
        cy.get('[test-id="register"]').click();

        data.forEach((step) => {
          switch (step.action) {
            case 'type':
              return cy
                .get(step.selector)
                .type(step.value)
                .should('have.value', step.value);
            case 'click':
              return cy.get(step.selector).click().wait(1000);
            case 'select':
              return cy
                .get(step.selector)
                .click()
                .then(() => {
                  cy.get('mat-option').contains(step.value).click();
                })
                .wait(2000);
          }
        });
      });

      cy.log('Waiting for verification email to arrive...');

      cy.waitForVerificationEmail({
        serverId: id,
        emailAddress: fullEmailAddress,
      }).then((email: any) => {
        if (!email) {
          throw new Error('Email is undefined or null');
        }

        cy.log(
          `Received email with subject: ${email.subject || '[No subject]'}`,
        );

        const verificationLink = email.html?.links?.[0]?.href;

        if (verificationLink) {
          cy.log(` Verification link found: ${verificationLink}`);

          cy.visit(verificationLink);
        }

        return cy.wrap(email);
      });
    });
  });
});
