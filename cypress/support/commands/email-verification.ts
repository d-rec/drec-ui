import Mailosaur from 'mailosaur';

const MAILOSAUR_API_KEY = '01FD0WG620yCxzdEtTRSTxXuX18DUUij';
const MAILOSAUR_SERVER_ID = 'ceuazndf';

declare global {
  namespace Cypress {
    interface Chainable {
      createTestInbox(): Chainable<{
        id: string;
        fullEmailAddress: string;
        shortEmailAddress: string;
      }>;
      waitForVerificationEmail(options: {
        serverId: string;
        emailAddress: string;
      }): Chainable<any>;
    }
  }
}

Cypress.Commands.add('createTestInbox', () => {
  const shortEmailAddress = `test6@${MAILOSAUR_SERVER_ID}.mailosaur.net`;
  return cy.wrap({
    id: MAILOSAUR_SERVER_ID,
    fullEmailAddress: shortEmailAddress,
    shortEmailAddress,
  });
});

Cypress.Commands.add(
  'waitForVerificationEmail',
  ({ serverId, emailAddress }: { serverId: string; emailAddress: string }) => {
    return cy.wait(5000).then(() => {
      const apiUrl = `https://mailosaur.com/api/messages?server=${serverId}&sentTo=${emailAddress}`;

      const checkDirectApiWithRetry = (
        retriesLeft = 5,
      ): Cypress.Chainable<any> => {
        return cy
          .request({
            method: 'GET',
            url: apiUrl,
            headers: {
              Authorization: `Basic ${btoa(MAILOSAUR_API_KEY + ':')}`,
              'Content-Type': 'application/json',
            },
            failOnStatusCode: false,
          })
          .then((response) => {
            const matchingEmailSummary = response.body.items.find((item: any) =>
              item.to.some(
                (recipient: any) => recipient.email === emailAddress,
              ),
            );

            if (
              response.status >= 200 &&
              response.status < 300 &&
              matchingEmailSummary?.id
            ) {
              cy.log(`✅ Found email summary for: ${emailAddress}`);
              cy.log(
                `response body=======${JSON.stringify(
                  matchingEmailSummary,
                )}=========`,
              );

              // ✅ Now fetch the full email content using the ID
              const messageId = matchingEmailSummary.id;
              const getEmailUrl = `https://mailosaur.com/api/messages/${messageId}`;

              return cy
                .request({
                  method: 'GET',
                  url: getEmailUrl,
                  headers: {
                    Authorization: `Basic ${btoa(MAILOSAUR_API_KEY + ':')}`,
                    'Content-Type': 'application/json',
                  },
                  failOnStatusCode: false,
                })
                .then((fullEmailResponse) => {
                  const fullEmail = fullEmailResponse.body;
                  cy.log(
                    `✅ Retrieved full email content: ${JSON.stringify(
                      fullEmail,
                    )}`,
                  );
                  return cy.wrap(fullEmail); // ✅ Return the full email object
                });
            } else {
              if (retriesLeft > 1) {
                cy.log(
                  `No matching email summary found. Retrying... (${
                    retriesLeft - 1
                  } left)`,
                );
                return cy
                  .wait(3000)
                  .then(() => checkDirectApiWithRetry(retriesLeft - 1));
              }

              throw new Error(
                'Failed to retrieve matching email summary after multiple attempts',
              );
            }
          });
      };

      return checkDirectApiWithRetry();
    });
  },
);
