Feature: Library
  Readers can browse their books and recover from loading failures.

  @live
  Scenario: Books load from the API
    Given a library containing books
    When I open the library
    Then I can select a book

  @live
  Scenario: A book without a cover shows a fallback
    Given a library containing books
    When I open the library
    Then the Kannada book shows its title initials

  Scenario: An empty library is explained
    Given an empty library
    When I open the library
    Then I see that there are no books yet

  Scenario: A server failure can be retried
    Given a library which will fail to load once
    When I open the library
    Then I see a library loading error
    When I retry
    Then I can select a book

  Scenario: An invalid response is rejected at the contract boundary
    Given the library returns an invalid book
    When I open the library
    Then I see a library loading error
    And the invalid book is not displayed

  Scenario: Readers see progress while waiting for their books
    Given a slow library
    When I open the library
    Then I see the library loading status
    When I wait for the library to finish loading
    Then the books eventually appear

  Scenario: A broken cover shows title initials
    Given a library with a broken cover
    When I open the library
    Then the Kannada book shows its title initials

  Scenario: Scrolling loads the rest of the library
    Given a library with more than one page
    When I open the library
    And I scroll to the end of the shelf
    Then the remaining books appear
    And I reach the end of the library

  Scenario: A later loading failure keeps existing books
    Given the next page fails to load once
    When I open the library
    And I scroll to the end of the shelf
    Then I see a loading more error with existing books

  Scenario: A failed later page can be retried
    Given a library whose next page has failed to load
    When I retry
    Then the remaining books appear

  Scenario: Readers can load more books when automatic scrolling is unavailable
    Given a library with more than one page and no automatic scrolling
    When I open the library
    And I use the load more button
    Then the remaining books appear

  Scenario: Saved books survive a failed reload and refresh when the connection returns
    Given a library containing books
    When I open the library
    Then I can select a book
    When the library connection fails and I reload
    Then the saved library is marked "complete"
    When the library connection returns with no books
    And I retry
    Then I see that there are no books yet

  Scenario: An incomplete saved catalog explains that other books may exist
    Given a library with more than one page and no automatic scrolling
    When I open the library
    Then I can select a book
    When the library connection fails and I reload
    Then the saved library is marked "partial"
