// Add this new command to your cypress/support/commands.js
Cypress.Commands.add('mockPhoneVerified', () => {
  cy.intercept('GET', `${Cypress.env('REACT_APP_BACKEND_URL')}/api/user/me`, {
    statusCode: 200,
    body: {
      createdAt: '2025-05-15T07:31:13.346Z',
      updatedAt: '2025-05-15T07:31:13.346Z',
      id: 9,
      firstName: 'BYISHIMO',
      lastName: 'CEDRICK',
      phoneNumber: '+250784496094',
      email: 'byishimocedric4@gmail.com',
      termsAcceptedAt: '2025-05-15T07:31:13.338Z',
      notifications: true,
      status: 'Active',
      role: 'OrganizationAdmin',
      api_user_id: '4d8bb894-18c6-4979-be99-34f4d8a68502',
      phoneNumberVerifiedAt: new Date().toISOString(), // The critical modification
      emailVerifiedAt: '2025-05-14T15:47:22.761Z',
      organization: {
        createdAt: '2025-05-15T07:31:13.157Z',
        updatedAt: '2025-05-15T10:19:15.559Z',
        id: 9,
        name: 'Org',
        address: 'Kigali,kabuga, Kigali,karama',
        zipCode: null,
        city: null,
        country: null,
        blockchainAccountAddress: null,
        blockchainAccountSignedMessage: null,
        organizationType: 'Developer',
        orgEmail: 'byishimocedric4@gmail.com',
        status: 'Active',
        documentIds: null,
        api_user_id: '4d8bb894-18c6-4979-be99-34f4d8a68502',
        verifiedAt: '2025-05-15T10:19:15.556Z',
        users: [
          {
            createdAt: '2025-05-15T07:31:13.346Z',
            updatedAt: '2025-05-15T07:31:13.346Z',
            id: 9,
            firstName: 'BYISHIMO',
            lastName: 'CEDRICK',
            phoneNumber: '+250784496094',
            email: 'byishimocedric4@gmail.com',
            termsAcceptedAt: '2025-05-15T07:31:13.338Z',
            notifications: true,
            status: 'Active',
            role: 'OrganizationAdmin',
            api_user_id: '4d8bb894-18c6-4979-be99-34f4d8a68502',
            phoneNumberVerifiedAt: new Date().toISOString(), // Also update in nested user
            emailVerifiedAt: '2025-05-14T15:47:22.761Z',
          },
        ],
        invitations: [],
      },
      emailConfirmed: false,
    },
  })
    .as('getUserProfile')
    .wait(10000);
});
