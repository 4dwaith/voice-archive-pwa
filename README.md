# Voice Archive PWA

A local React and TypeScript application scaffolded with Vite, styled with
Tailwind CSS 4, and configured as an installable PWA.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
npm run preview
```

## Component development

Run Storybook to view and exercise reusable components in isolation:

```bash
npm run storybook
```

Create a production Storybook build with:

```bash
npm run build-storybook
```

## Voice recordings

The fixed footer records audio with the browser MediaRecorder API. The latest
15 clips are stored locally in IndexedDB through Dexie and can be played from
the Recordings route. Microphone access requires HTTPS in production; localhost
is accepted during development.

The production build generates the web app manifest and service worker in
`dist/`. Camera and microphone APIs require HTTPS in production (localhost is
accepted during development).

## Sample cover images

The bundled sample covers were retrieved from the
[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) using
cover IDs `14348537`, `13335427`, `8775559`, `13859660`, `12356249`, and
`6717853`. They can be replaced when the real library import flow is added.
