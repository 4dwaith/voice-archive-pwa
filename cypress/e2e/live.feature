Feature: Live voice conversation
  Background:
    Given Live is available

  Scenario: Live can use newly published summaries after reopening a book
    Given a book with a nested chapter
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I use the header Home button
    And English book summaries are published
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I ask Live for summaries of the book, its chapters and the first passage
    Then Live receives the refreshed English summaries
    When I stop Live
    Then Live has released the microphone

  Scenario: A book answer leads to its supporting passage
    Given a book with a nested chapter
    And the book answer is "available"
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I use the header Home button
    And I ask Live about the nested destination
    Then Live receives the grounded answer and supporting passage
    When I ask Live to open the supporting passage
    Then I see the nested section text
    When I stop Live
    Then Live has released the microphone

  Scenario: An unavailable book answer keeps its qualification
    Given a book with a nested chapter
    And the book answer is "unavailable"
    And I have not downloaded the book
    When I start Live from the library
    And I ask Live about the nested destination
    Then Live receives the answer unavailability and its limitation
    And Live has not opened or downloaded the book
    When I stop Live
    Then Live has released the microphone

  Scenario: A series question receives supporting passages
    Given a book with a nested chapter
    And the book answer is "available"
    When I start Live from the library
    And I ask Live about the nested destination across its series
    Then Live receives the grounded answer and supporting passage
    When I stop Live
    Then Live has released the microphone

  Scenario: Live can explicitly request a whole-book answer
    Given a book with a nested chapter
    And the book answer is "whole book"
    When I start Live from the library
    And I ask Live to use the whole book for the question
    Then Live receives the grounded answer and supporting passage
    When I stop Live
    Then Live has released the microphone

  Scenario: Supporting passages can be unavailable on this device
    Given a book with a nested chapter
    And the book answer is "available"
    And I have not downloaded the book
    When I start Live from the library
    And I ask Live about the nested destination
    Then Live receives the grounded answer and supporting passage
    When I ask Live about the book and its chapters
    Then Live knows the book has not been downloaded
    And Live has not opened or downloaded the book
    When I stop Live
    Then Live has released the microphone

  Scenario: A supporting passage belongs to a different edition than the local book
    Given a book with a nested chapter
    And the book answer is "another edition"
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I ask Live about the nested destination
    And I ask Live about the book and its chapters
    Then Live can identify that the supporting passage belongs to another edition
    And I see its first reader page
    When I stop Live
    Then Live has released the microphone

  Scenario: The turner starts and stops Live from the library
    Given a book with a nested chapter
    When I open the library
    And I use the turner "left double tap" gesture
    And I use the turner "right double tap" gesture
    Then Live offers a fresh conversation
    When I use the turner "right hold" gesture
    Then I can talk with Live and hear its reply
    When I use the turner "right hold" gesture
    Then Live has released the microphone

  Scenario: Turner controls coordinate narration, Live and PDF
    Given a book whose narration starts after an introduction
    And its narrated text spans pages
    When I open the book from the library
    And I wait for the book to finish loading
    And I focus the Live control
    And I use the turner "right hold" gesture
    Then I can talk with Live and hear its reply
    When I focus the Live control
    And I use the turner "left double tap" gesture
    Then Live has released the microphone
    And turner narration is playing
    When I use the turner "left double tap" gesture
    Then turner narration is paused
    When I focus the Live control
    And I use the turner "left double tap" gesture
    Then turner narration is playing
    When I use the turner "right hold" gesture
    Then narration stops and the modal closes
    When I focus the Live control
    And I use the turner "right double tap" gesture
    Then only the PDF surface is open
    When I use the turner "left double tap" gesture
    Then I can talk with Live and hear its reply
    And turner narration is paused
    When I use the turner "right hold" gesture
    Then Live has released the microphone
    When I use the turner "right double tap" gesture
    Then the turner restores Text mode

  Scenario: Stop and reload preserve the conversation until discard
    Given a book with a nested chapter
    And the conversation can be continued later
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I stop Live
    Then Live has released the microphone
    When I reload the Live app
    Then Live waits for explicit continuation
    When I continue Live
    Then Live resumes the same conversation
    When I stop Live
    And I discard the Live conversation
    Then Live offers a fresh conversation
    When I use the turner "right hold" gesture
    Then I can talk with Live and hear its reply
    When I use the turner "right hold" gesture
    Then Live has released the microphone

  Scenario: Discard returns focus so every turner gesture still works
    Given a book whose narration starts after an introduction
    And its narrated text spans pages
    And the conversation can be continued later
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I open the book while talking with Live
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I stop Live
    And I tap Discard on the touchscreen
    Then Live offers a fresh conversation
    And the reader has keyboard focus
    And the reader controls are hidden
    When I use the turner "right hold" gesture
    Then I can talk with Live and hear its reply
    When I use the turner "right hold" gesture
    Then Live has released the microphone
    When I use the turner "right double tap" gesture
    Then only the PDF surface is open
    When I use the turner "right double tap" gesture
    Then the turner restores Text mode
    When I use the turner "left double tap" gesture
    Then turner narration is playing

  Scenario: A conversation that can no longer continue offers a fresh start
    Given a book with a nested chapter
    And the conversation can be continued later
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When the conversation can no longer be continued
    And I stop Live
    Then Live offers a fresh conversation
    And Live has released the microphone

  Scenario: Live stays available while reading and closes quietly on narration
    Given a book whose narration starts after an introduction
    And its narrated text spans pages
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I open the book while talking with Live
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    Then the corner Live control remains reachable
    When I play the page narration
    Then Live has released the microphone
    When I start Live from the narration modal
    Then narration stops and the modal closes
    When I stop Live
    Then Live has released the microphone

  Scenario: A failed start releases the microphone and allows retry
    Given a book with a nested chapter
    And starting Live fails once
    When I start Live from the library
    Then Live reports failure and releases the microphone
    When I retry Live
    Then I can talk with Live and hear its reply
    When I stop Live
    Then Live has released the microphone

  Scenario: Live reads current settings after a manual change
    Given a book with a nested chapter
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I ask Live whether I have a book open
    Then Live knows I am in the library
    When I open the book while talking with Live
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I use the turner "right double tap" gesture
    Then only the PDF surface is open
    When I ask Live which view I am using
    Then Live knows I am viewing the PDF
    When I stop Live
    Then Live has released the microphone

  Scenario: Ending Live by voice preserves the conversation for later
    Given a book with a nested chapter
    And the conversation can be continued later
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I ask Live to end the conversation
    Then Live has released the microphone
    When I reload the Live app
    And I continue Live
    Then Live resumes the same conversation
    When I stop Live
    Then Live has released the microphone

  Scenario: Live identifies books without downloading them
    Given a book with a nested chapter
    And I have not downloaded the book
    When I start Live from the library
    And I ask Live which books I can read
    Then Live knows the book is in my library
    When I ask Live about the book and its chapters
    Then Live knows the book has not been downloaded
    And Live has not opened or downloaded the book
    When I stop Live
    Then Live has released the microphone

  Scenario: Live reads nearby Text without navigating
    Given a book with a nested chapter
    When I start Live from the library
    And I ask Live to read the current text page
    Then Live knows there is no text page open
    When I open the book while talking with Live
    And I wait for the book to finish loading
    Then I see its first reader page
    When I ask Live to read the next text page without turning the page
    Then Live receives the next page text
    And I see its first reader page
    When I stop Live
    Then Live has released the microphone

  Scenario: Live changes settings, moves one page and returns Home
    Given a book with a nested chapter
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    Then I see its first reader page
    When I ask Live to set the text size to 112.5 percent
    Then Live knows the text size is 112.5 percent
    When I ask Live to turn to the next text page
    Then the text shows page 2
    When I ask Live to return to the library
    Then I am back in the library
    When I ask Live to turn to the next text page
    Then Live is told to open Text view first
    When I stop Live
    Then Live has released the microphone

  Scenario: Live opens a new book while the rest of it loads
    Given a book that takes time to finish loading
    When I start Live from the library
    Then I can talk with Live and hear its reply
    When I ask Live to open the book
    Then I can start reading while the rest of the book loads
    When I wait for the book to finish loading
    Then I see its first reader page
    And I can talk with Live and hear its reply
    When I stop Live
    Then Live has released the microphone

  Scenario: Live opens chapters and passages and remembers my reading place
    Given a book with a nested chapter
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I use the header Home button
    Then I am back in the library
    When I ask Live to open the nested chapter
    Then I see the nested section text
    When I use the header Home button
    Then I am back in the library
    When I ask Live to open the nested passage
    Then I see the nested section text
    When I use the header Home button
    Then I am back in the library
    When I ask Live to open the book
    Then I see the nested section text
    When I stop Live
    Then Live has released the microphone

  Scenario Outline: Live downloads an uncached destination before navigating
    Given a nested chapter book that takes time to finish loading
    When I start Live from the library
    And I ask Live to open the nested <target>
    Then I can start reading while the rest of the book loads
    And I see the nested section text
    And I can talk with Live and hear its reply
    When I stop Live
    Then Live has released the microphone

    Examples:
      | target  |
      | chapter |
      | passage |

  Scenario: Live plays the selected passage in the open book
    Given a book whose narration starts after an introduction
    And its narrated text spans pages
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I focus the text and hide the controls
    And I select a text segment
    Then the text segment is selected
    When I ask Live to play the selected passage
    Then Live has released the microphone
    And turner narration is playing

  Scenario: Live opens a cached narration destination and yields to playback
    Given a book whose narration starts after an introduction
    And its narrated text spans pages
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I use the header Home button
    Then I am back in the library
    When I ask Live to read the first chapter aloud
    Then Live has released the microphone
    And turner narration is playing

  Scenario: Voice changes speaking speed and reveals reading controls
    Given a book with a nested chapter
    When I start Live from the library
    And I open the book while talking with Live
    And I wait for the book to finish loading
    And I ask Live to set the speaking speed to 1.25 times normal
    Then the speaking speed is 1.25 times normal
    When I ask Live to set the speaking speed to 1.30 times normal
    Then the speaking speed is 1.30 times normal
    When I decrease speaking speed using the header
    Then the speaking speed is 1.25 times normal
    When I ask Live to hide the reading controls
    Then the reading controls are hidden
    When I ask Live to show the reading controls
    Then the reading controls are visible
    When I reload the reader
    Then the speaking speed is 1.25 times normal

  Rule: Playback handoff keeps Live available until narration starts
    Background:
      Given a book whose narration starts after an introduction
      And its narrated text spans pages
      And the narration takes time to start
      When I start Live from the library
      Then I can talk with Live and hear its reply
      When I open the book while talking with Live
      And I wait for the book to finish loading
      And I play the page narration
      Then Live waits silently for narration

    Scenario: Live stops once narration starts
      When the narration starts
      Then Live has released the microphone
      And turner narration is playing

    Scenario: Failed narration lets the conversation continue
      When the narration cannot start
      Then Live is told narration could not start and the conversation continues

    Scenario: Pausing while narration is loading keeps the conversation going
      When I cancel delayed narration
      Then Live continues without delayed narration
