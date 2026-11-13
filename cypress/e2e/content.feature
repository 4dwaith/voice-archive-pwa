Feature: Structured book synchronization
  Readers open a book and cache version-pinned structured content locally.

  Scenario Outline: Reader settings stay separate from account details
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    Then the reader header separates navigation, settings and account details at <width> pixels

    Examples:
      | width |
      | 1100  |
      | 700   |

  @touch
  Scenario: Two-finger swipes switch modes without turning text pages
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I swipe left with two fingers across the reader
    Then only the PDF surface is open
    When I swipe right with two fingers across the reader
    Then the original text page is restored
    And the reader controls are hidden

  @live
  Scenario: Selected text opens PDF regions and manual browsing uses byte ranges
    Given a synchronization book with PDF regions
    When I open the book from the library
    And I wait for the book to finish loading
    And I tap exposed book text
    And I select a text segment
    And I open the source PDF
    Then the selected PDF pages render through partial delivery
    When I browse a distant physical PDF page
    Then PDF browsing fetches more ranges without navigating text

  Scenario: A failed PDF can be retried without losing selected text
    Given a synchronization book whose PDF initially fails
    When I open the book from the library
    And I wait for the book to finish loading
    And I select book text with the keyboard
    And I open the source PDF
    Then I can retry the PDF while keeping selected text

  Scenario: Book entry and Home use application history
    Given a book without published text
    When I open the book from the library
    Then the book stays open with a no-text message
    When I use the header Home button
    Then I am back in the library
    When I go forward in browser history
    Then the book stays open with a no-text message

  Scenario: A directly opened book has a library fallback
    Given a book without published text
    When I open the synchronization book directly
    Then the book stays open with a no-text message
    When I use the header Home button
    Then I am back in the library

  @live
  Scenario: Opening a book synchronizes its structured data and shows its first page
    Given a published synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    Then its complete structured dataset is available locally
    And I see its first reader page

  @live
  Scenario: Tapping book text hides controls and keyboard interaction reveals them
    Given a published synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    Then I see its first reader page
    And the reader controls are visible
    When I tap exposed book text
    Then the reader controls are hidden
    And I see its first reader page
    When I reveal the reader controls
    Then the reader controls are visible
    And I see its first reader page

  @live
  Scenario: Collapsing the ToC preserves the text viewport and footer
    Given a published synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    Then the ToC fills the reader below the header
    When I collapse the table of contents
    Then the ToC shrinks to its toggle without moving the text or footer
    When I expand the table of contents
    Then the ToC fills the reader below the header

  @live
  Scenario: Selecting text keeps the reader controls hidden
    Given a published synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I select a text segment
    Then the text segment is selected
    And the reader controls are hidden

  @live
  Scenario: A fully cached book remains available when the network fails
    Given a fully cached synchronization book
    When its manifest becomes unreachable
    Then its cached text remains available offline
    And I see its first reader page

  @live
  Scenario: Offline reload reuses committed reader measurements
    Given a fully cached synchronization book
    And its reader measurements are committed
    When its manifest becomes unreachable
    And I reload the reader
    Then the offline reader reuses its stored measurements
    And I see its first reader page

  Scenario: The opening placeholder uses the library cover while waiting for content
    Given a slow synchronization book with a cover
    When I open the book from the library
    Then I see its cover and loading text
    When I wait for the book to finish loading
    Then its complete structured dataset is available locally

  Scenario: The first committed batch is readable before the full download completes
    Given a book that takes time to finish loading
    When I open the book from the library
    Then I can start reading while the rest of the book loads
    And book search is unavailable
    When I wait for the book to finish loading
    Then its complete structured dataset is available locally
    And book search is available

  Scenario: A failed download preserves its committed local batches
    Given a synchronization book whose first download fails
    When I open the book from the library
    Then I see a book loading error
    And its committed local batches are retained as incomplete

  Scenario: A failed book load can be retried to show its first page
    Given a synchronization book whose first download fails
    When I open the book from the library
    Then I see a book loading error
    When I retry the book download
    And I wait for the book to finish loading
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
    When I open the book from the library
    Then the book stays open with a no-text message

  Scenario: A version change during download restarts against the current book
    Given a synchronization book that changes during download
    When I open the book from the library
    Then the new dataset is downloaded without leaving the book

  Scenario: A nested ToC destination opens its text
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    And I select the nested ToC destination
    Then I see the nested section text

  Scenario: Footer navigation moves within a chapter
    Given a synchronization book with two chapters
    When I open the book from the library
    And I wait for the book to finish loading
    And I move forward one chapter page
    Then the second chapter page is displayed

  Scenario: Book navigation jumps across chapters within the index
    Given a synchronization book with two chapters
    When I open the book from the library
    And I wait for the book to finish loading
    And I jump to the last indexed book page
    Then the second chapter opens at the indexed book boundary

  @touch
  Scenario: A touch swipe turns the page without revealing controls
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I swipe left across the book text
    Then the text shows page 2
    And the reader controls are hidden

  Scenario: PageUp turns back without revealing controls
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    And I move to chapter page 2
    And I focus the text and hide the controls
    And I press the previous-page key
    Then the text shows page 1
    And the reader controls are hidden

  Scenario Outline: Repeated <direction> arrow presses preserve reader focus
    Given a book with a nested chapter
    When I open the book from the library
    And I wait for the book to finish loading
    And I move to chapter page <start>
    And I focus a text segment and hide the controls
    And I press the <direction> arrow key
    Then the text shows page <next>
    And the reader keeps keyboard focus
    When I press the <direction> arrow key
    Then the text shows page <last>
    And the reader controls are hidden

    Examples:
      | direction | start | next | last |
      | right     | 1     | 2    | 3    |
      | left      | 3     | 2    | 1    |

  Scenario: Reload restores text size and an interior segment position
    Given a synchronization book with two chapters
    When I open the book from the library
    And I wait for the book to finish loading
    And I enlarge the text and move to an interior position
    And I reload the reader
    Then the saved interior position and text size are restored

  Scenario: A saved position from another version falls back on reload
    Given a fully cached synchronization book
    When I save a position for an obsolete version and reload
    Then I see its first reader page

  Scenario: Search results protect the reader from modal keyboard input
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    Then the search modal protects the reader and shows both occurrences

  Scenario: Dismissing search returns keyboard focus to Search
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I dismiss search with Escape
    Then focus returns to the search button

  Scenario: Choosing a later search result opens its exact position
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I open the later matching occurrence
    Then the exact later match is displayed

  Scenario: Dismissing search preserves the results
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I dismiss search with Escape
    And I reopen search results
    Then both matching occurrences remain available

  Scenario: Opening a match preserves the search results
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I open the later matching occurrence
    And I reopen search results
    Then both matching occurrences remain available

  Scenario: Clearing search allows another submission by button
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I clear search and submit it again by button
    Then both matching occurrences remain available

  Scenario: Leaving the book clears its search results
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I submit a book search with Enter
    And I dismiss search with Escape
    And I use the header Home button
    Then I am back in the library
    When I go forward in browser history
    Then the book search results are cleared

  Scenario: Search remains usable at maximum text size
    Given a searchable synchronization book
    When I open the book from the library
    And I wait for the book to finish loading
    And I open search at maximum text size
    Then the search field and actions remain usable

  @live
  Scenario: Narration skips untimed text and uses native audio range delivery
    Given a book whose narration starts after an introduction
    When I open the book from the library
    And I wait for the book to finish loading
    And I play the page narration
    Then the browser plays narration and replaces page steps with second skips
    When I skip five seconds and pause narration
    Then narration pauses and the page controls return

  Scenario Outline: Reader navigation controls pause narration
    Given a book whose narration starts after an introduction
    When I open the book from the library
    And I wait for the book to finish loading
    And I play the page narration
    Then the browser plays narration and replaces page steps with second skips
    When I navigate using the <control> control during narration
    Then narration pauses and the page controls return

    Examples:
      | control  |
      | contents |
      | search   |

  Scenario: A failed narration file stops playback and can be retried
    Given a book whose narration starts after an introduction
    And its narration file initially fails
    When I open the book from the library
    And I wait for the book to finish loading
    And I play the page narration
    Then narration reports the file failure without continuing
    When I play the page narration
    Then the browser plays narration and replaces page steps with second skips
