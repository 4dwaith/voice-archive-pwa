import type { BookModel } from '../models/book'

export const books: BookModel[] = [
  {
    id: 1,
    title: 'Pride and Prejudice',
    coverImage: '/covers/pride-and-prejudice.jpg',
    mark: 'P&P',
  },
  {
    id: 2,
    title: 'The Wind in the Willows',
    coverImage: '/covers/wind-in-the-willows.jpg',
    mark: 'WW',
  },
  {
    id: 3,
    title: 'Little Women',
    coverImage: '/covers/little-women.jpg',
    mark: 'LW',
  },
  {
    id: 4,
    title: 'Treasure Island',
    coverImage: '/covers/treasure-island.jpg',
    mark: 'TI',
  },
  {
    id: 5,
    title: 'Frankenstein',
    coverImage: '/covers/frankenstein.jpg',
    mark: 'FR',
  },
  {
    id: 6,
    title: 'The Adventures of Sherlock Holmes',
    coverImage: '/covers/sherlock-holmes.jpg',
    mark: 'SH',
  },
]
