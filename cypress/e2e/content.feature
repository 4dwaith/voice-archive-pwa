Feature: Structured book synchronization
  Readers open a book and cache version-pinned structured content locally.

  Scenario: Book entry and Home use application history
    Given a book without published text
    When I open the synchronization book from the library
    Then the book stays open with a no-text message
    When I use the header Home button
    Then I return to the synchronization library
    When I go forward in browser history
    Then the book stays open with a no-text message

  Scenario: A directly opened book has a library fallback
    Given a book without published text
    When I open the synchronization book directly
    Then the book stays open with a no-text message
    When I use the header Home button
    Then I return to the synchronization library

  @live
  Scenario: Opening a book synchronizes its structured data and shows its first page
    Given a published synchronization book
    When I open the synchronization book from the library
    And I wait for book synchronization to finish
    Then its complete structured dataset is available locally
    And I see its first reader page
    When I hide and reveal the reader controls
    Then I see its first reader page

  @live
  Scenario: A fully cached book remains available when the network fails
    Given a fully cached synchronization book
    When its manifest becomes unreachable
    Then its cached text remains available offline
    And I see its first reader page

  Scenario: The opening placeholder uses the library cover while waiting for content
    Given a slow synchronization book with a cover
    When I open the synchronization book from the library
    Then I see its cover and loading text
    When I wait for book synchronization to finish
    Then its complete structured dataset is available locally

  Scenario: The first committed batch is readable before the full download completes
    Given a synchronization book with a slow second batch
    When I open the synchronization book from the library
    Then its first batch is readable without marking the book complete
    When I wait for book synchronization to finish
    Then its complete structured dataset is available locally

  Scenario: A failed download preserves its committed local batches
    Given a synchronization book whose first download fails
    When I open the synchronization book from the library
    Then I see a book loading error
    And its committed local batches are retained as incomplete

  Scenario: A failed book load can be retried to show its first page
    Given a synchronization book whose first download fails
    When I open the synchronization book from the library
    Then I see a book loading error
    When I retry the book download
    And I wait for book synchronization to finish
    Then I see its first reader page
    And its complete structured dataset is available locally
    And its committed batches were not downloaded again

  @live
  Scenario: PDF and audio URLs support direct conditional range delivery
    Given a fully cached synchronization book with prepared media
    When I request conditional byte ranges from its media URLs
    Then its media responses honor the range conditions

  @live
  Scenario: A confirmed purge removes cached content
    Given a fully cached synchronization book
    When its published content is purged
    Then reopening shows no text and clears the local dataset

  @live
  Scenario: Fresh import replaces the old dataset without leaving the book
    Given a fully cached synchronization book
    When its published content is imported again
    Then reopening downloads the new dataset without leaving the book
    And I see its first reader page

  Scenario: A book without published text can still be opened
    Given a book without published text
    When I open the synchronization book from the library
    Then the book stays open with a no-text message

  Scenario: A version change during download restarts against the current book
    Given a synchronization book that changes during download
    When I open the synchronization book from the library
    Then the new dataset is downloaded without leaving the book
