import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'
import { requestApi } from '../support/api'

const user = { id: 2, email: 'reader@example.com', display_name: null }

Given('I have not signed in', () => {
  if (Cypress.expose('mode') === 'live') {
    requestApi('POST', `${Cypress.expose('apiUrl')}/api/v1/auth/logout`)
  } else {
    let signedIn = false
    cy.intercept('GET', '**/api/v1/auth/me', (request) =>
      request.reply({
        body: JSON.stringify(signedIn ? user : null),
        headers: { 'content-type': 'application/json' },
      }),
    )
    cy.intercept('POST', '**/api/v1/auth/login', (request) => {
      if (request.body.password !== 'e2e-password') {
        request.reply({ statusCode: 401 })
        return
      }
      signedIn = true
      request.reply({ body: user })
    })
    cy.intercept('POST', '**/api/v1/auth/logout', (request) => {
      signedIn = false
      request.reply({ statusCode: 204 })
    })
    cy.intercept('GET', '**/api/v1/books?*', {
      items: [],
      total: 0,
      offset: 0,
      limit: 24,
    })
  }
  cy.visit('/')
  cy.contains('Guest').should('be.visible')
})

function fillSignInForm(password: string) {
  cy.visit('/login')
  cy.findByLabelText('Email').type(user.email)
  cy.findByLabelText('Password').type(password, { log: false })
  cy.get('form').findByRole('button', { name: 'Sign in' }).click()
}

When('I sign in with my email and password', () =>
  fillSignInForm('e2e-password'),
)

When('I try to sign in with the wrong password', () =>
  fillSignInForm('incorrect'),
)

Then('my email is shown in the header', () =>
  cy.contains(user.email).should('be.visible'),
)

Then('I am told that sign-in failed', () =>
  cy.findByRole('alert').should('contain.text', 'Sign-in failed'),
)

When('I sign out', () => cy.findByRole('button', { name: 'Sign out' }).click())

Then('I am browsing as a guest', () => {
  cy.contains('Guest').should('be.visible')
})

Then('Live conversation is unavailable', () => {
  cy.intercept('POST', '**/api/v1/live/token', { statusCode: 500 }).as(
    'guestLive',
  )
  cy.get('body').trigger('keydown', { key: 'MediaPlay' })
  cy.findByRole('button', { name: /Start Live|Continue Live/ }).should(
    'not.exist',
  )
  cy.get('@guestLive.all').should('have.length', 0)
})

Given('I am signed in', () => {
  if (Cypress.expose('mode') !== 'live')
    cy.intercept('GET', '**/api/v1/books?*', {
      items: [],
      total: 0,
      offset: 0,
      limit: 24,
    })
  cy.visit('/')
  cy.contains(user.email).should('be.visible')
})

When('I return to the app after my sign-in expires', () => {
  if (Cypress.expose('mode') === 'live')
    cy.setCookie('voice_archive_session', 'invalid', { path: '/api' })
  else cy.intercept('GET', '**/api/v1/auth/me', { statusCode: 401 })
  cy.reload()
})

Then('I am asked to sign in again', () => {
  cy.location('pathname').should('eq', '/login')
  cy.findByRole('status').should('contain.text', 'session expired')
})

Given('sign-in is disabled', () => {
  cy.intercept('GET', '**/api/v1/auth/config', {
    body: { login_enabled: false },
  })
  cy.reload()
})

When('I request to sign in', () => {
  cy.findByRole('button', { name: 'Sign in' }).click()
})

Then('the demo restrictions explain how to set up locally', () => {
  cy.location('pathname').should('eq', '/login')
  cy.findByRole('complementary', { name: 'Demo restrictions' }).within(() => {
    cy.contains('Sign-in is restricted during this demo').should('be.visible')
    cy.contains('set up Voice Archive locally').should('be.visible')
    cy.findByRole('link', { name: 'Frontend setup on GitHub' }).should(
      'have.attr',
      'href',
      'https://github.com/4dwaith/voice-archive-pwa',
    )
    cy.findByRole('link', { name: 'Backend setup on GitHub' }).should(
      'have.attr',
      'href',
      'https://github.com/4dwaith/voice-archive-api',
    )
  })
  cy.findByLabelText('Email').should('be.disabled')
  cy.findByLabelText('Password').should('be.disabled')
  cy.get('form').findByRole('button', { name: 'Sign in' }).should('be.disabled')
})

When('I continue without signing in', () => {
  cy.findByRole('button', { name: 'Continue without signing in' }).click()
  cy.location('pathname').should('eq', '/')
})
