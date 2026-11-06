// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Book } from '../../src/components/atoms/Book/Book'
import { titleInitials } from '../../src/components/atoms/Book/titleInitials'
import { book } from '../api-client/fixtures/book'

afterEach(cleanup)

describe('Book', () => {
  it('shows the series and its book number below the title', () => {
    render(<Book book={book} isSelected={false} onSelect={vi.fn()} />)

    const title = screen.getByRole('heading', { name: book.title })
    expect(title.nextElementSibling).toHaveTextContent(
      'Collected works · Book 2',
    )
    expect(title.nextElementSibling).toBeVisible()
  })

  it('shows the title without a series line for a standalone book', () => {
    render(
      <Book
        book={{
          ...book,
          series_id: null,
          series_title: null,
          series_index: null,
        }}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    const title = screen.getByRole('heading', { name: book.title })
    expect(title).toBeVisible()
    expect(title.nextElementSibling).toBeNull()
  })

  it.each([
    ['ಗೀತಾಭಾವಧಾರೆ', 'ಗೀ'],
    ['ರುದ್ರ ಚಮಕ', 'ರುಚ'],
    ['日本語の本', '日'],
    ['كتاب الحكمة', 'كا'],
    ['e\u0301cole française', 'E\u0301F'],
    ['👩‍👩‍👧‍👦 Stories', '👩‍👩‍👧‍👦S'],
    ['  Pride   and Prejudice ', 'PA'],
  ])('derives intact graphemes from %s', (title, expected) => {
    expect(titleInitials(title)).toBe(expected)
  })

  it('falls back after a cover fails, and tries a changed cover URL', () => {
    const props = {
      book: { ...book, id: 7, title: 'ಗೀತಾಭಾವಧಾರೆ', cover_url: '/one.jpg' },
      isSelected: false,
      onSelect: vi.fn(),
    }
    const view = render(<Book {...props} />)

    fireEvent.error(view.container.querySelector('img')!)

    expect(view.container.querySelector('img')).toBeNull()
    expect(screen.getByText('ಗೀ')).toBeVisible()

    view.rerender(
      <Book {...props} book={{ ...props.book, cover_url: '/two.jpg' }} />,
    )

    expect(view.container.querySelector('img')).toHaveAttribute(
      'src',
      '/two.jpg',
    )
  })

  it('uses the fallback without a cover and preserves accessible selection', async () => {
    const select = vi.fn()

    render(
      <Book
        book={{ ...book, id: 1, title: 'ಗೀತಾಭಾವಧಾರೆ' }}
        isSelected
        onSelect={select}
      />,
    )
    const button = screen.getByRole('button', { name: 'Select ಗೀತಾಭಾವಧಾರೆ' })

    expect(button).toHaveAttribute('aria-pressed', 'true')

    await userEvent.setup().click(button)

    expect(select).toHaveBeenCalledWith(1)
    expect(screen.getByRole('heading', { name: 'ಗೀತಾಭಾವಧಾರೆ' })).toBeVisible()
  })
})
