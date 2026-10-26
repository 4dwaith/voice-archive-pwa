import {
  Before,
  Given,
  When,
  Then,
} from '@badeball/cypress-cucumber-preprocessor'
import {
  BookList,
  BookResponse,
  InternalErrorResponse,
  type BookResponseOutput,
} from '../../src/api-client/generated/schemas'
import fixtures from '../fixtures/books.json'

const books = fixtures.map((book) => BookResponse.parse(book))
const bookName = 'Select ರುದ್ರ ಚಮಕ'
const failure = InternalErrorResponse.parse({
  error: { code: 'internal_error', message: 'An unexpected error occurred' },
})
let liveBooks: number[] = []

function page(items = books, offset = 0, total = items.length) {
  return BookList.parse({ items, offset, total, limit: 24 })
}

function interceptLibrary(
  items = books,
  options: { slow?: boolean; failOnce?: boolean; paginated?: boolean } = {},
) {
  let failed = false
  cy.intercept(
    'GET',
    `${Cypress.expose('apiUrl')}/api/v1/books*`,
    (request) => {
      const offset = Number(
        new URL(request.url).searchParams.get('offset') ?? 0,
      )
      if (options.failOnce && !failed && (!options.paginated || offset > 0)) {
        failed = true
        request.reply({ statusCode: 500, body: failure })
        return
      }
      const batch = options.paginated ? items.slice(offset, offset + 24) : items
      request.reply({
        body: page(batch, offset, items.length),
        delay: options.slow ? 1200 : 0,
      })
    },
  ).as('library')
}

function paginatedBooks(): BookResponseOutput[] {
  return Array.from({ length: 30 }, (_, index) =>
    BookResponse.parse({
      ...books[index % books.length],
      id: index + 1,
      title: index === 0 ? books[0].title : `Library volume ${index + 1}`,
    }),
  )
}

Before(() => {
  liveBooks = []
})

// Cleanup uses the API even after an assertion failure. The launcher also drops
// the entire run's disposable database after Chrome exits.
afterEach(() => {
  for (const id of liveBooks) {
    cy.request('DELETE', `${Cypress.expose('apiUrl')}/api/v1/books/${id}`)
  }
})

Given('a library containing books', () => {
  if (Cypress.expose('mode') !== 'live') {
    interceptLibrary()
    return
  }
  for (const book of books) {
    cy.request('POST', `${Cypress.expose('apiUrl')}/api/v1/books`, {
      title: book.title,
      language: book.language,
      description: book.description,
    }).then(({ body }) => {
      liveBooks.push(BookResponse.parse(body).id)
    })
  }
})
Given('an empty library', () => interceptLibrary([]))
Given('a library which will fail to load once', () =>
  interceptLibrary(books, { failOnce: true }),
)
Given('a slow library', () => interceptLibrary(books, { slow: true }))
Given('the library returns an invalid book', () => {
  const invalid = { ...books[0], title: 'Invalid book', id: 'wrong-type' }
  expect(BookList.safeParse({ ...page(), items: [invalid] }).success).to.equal(
    false,
  )
  cy.intercept('GET', `${Cypress.expose('apiUrl')}/api/v1/books*`, {
    body: { ...page(), items: [invalid] },
  }).as('library')
})
Given('a library with a broken cover', () => {
  interceptLibrary([
    BookResponse.parse({
      ...books[0],
      cover_file_id: 1,
      cover_url: '/api/v1/files/1',
    }),
  ])
  cy.intercept('GET', `${Cypress.expose('apiUrl')}/api/v1/files/1`, {
    statusCode: 404,
  }).as('cover')
})
Given('a library with more than one page', () =>
  interceptLibrary(paginatedBooks(), { paginated: true }),
)
Given('the next page fails to load once', () =>
  interceptLibrary(paginatedBooks(), { paginated: true, failOnce: true }),
)
Given('a library with more than one page and no automatic scrolling', () => {
  interceptLibrary(paginatedBooks(), { paginated: true })
  cy.on('window:before:load', (window) => {
    Reflect.deleteProperty(window, 'IntersectionObserver')
  })
})
Given('a library whose next page has failed to load', () => {
  interceptLibrary(paginatedBooks(), { paginated: true, failOnce: true })
  cy.visit('/')

  cy.findByRole('button', { name: bookName }).should('be.visible')
  cy.scrollTo('bottom')

  // Start the retry scenario from a confirmed failure with the first page intact.
  cy.findByRole('alert').should('contain.text', 'More books couldn’t be loaded')
  cy.findAllByRole('article').should('have.length', 24)
})

When('I wait for the library to finish loading', () => {
  cy.wait('@library')
})

When('I open the library', () => {
  cy.visit('/')
})
When('I retry', () => {
  cy.findByRole('button', { name: 'Try again' }).click()
})
When('I scroll to the end of the shelf', () => {
  cy.findByRole('button', { name: bookName }).should('be.visible')
  cy.scrollTo('bottom')
})
When('I use the load more button', () => {
  cy.findByRole('button', { name: 'Load more books' }).click()
})
Then('I can select a book', () => {
  cy.findByRole('button', { name: bookName }).should('be.enabled')
})
Then('the Kannada book shows its title initials', () => {
  cy.findByRole('button', { name: bookName })
    .should('contain.text', 'ರುಚ')
    .find('img')
    .should('not.exist')
})
Then('I see that there are no books yet', () => {
  cy.findByRole('heading', { name: 'Your shelf is waiting' }).should(
    'be.visible',
  )
  cy.contains('There are no books in your library yet.').should('be.visible')
})
Then('I see a library loading error', () => {
  cy.findByRole('alert').should(
    'contain.text',
    'Your library couldn’t be loaded',
  )
})
Then('the invalid book is not displayed', () => {
  cy.findByRole('button', { name: 'Select Invalid book' }).should('not.exist')
})
Then('I see the library loading status', () => {
  cy.findByRole('status').should('contain.text', 'Loading your library…')
})
Then('the books eventually appear', () => {
  cy.findByRole('button', { name: bookName }).should('be.visible')
})
Then('the remaining books appear', () => {
  cy.findByRole('button', { name: 'Select Library volume 30' }).should('exist')
  cy.findAllByRole('article').should('have.length', 30)
})
Then('I reach the end of the library', () => {
  cy.contains('You’ve reached the end of your library.').should('be.visible')
})
Then('I see a loading more error with existing books', () => {
  cy.findByRole('alert').should('contain.text', 'More books couldn’t be loaded')
  cy.findAllByRole('article').should('have.length', 24)
})
