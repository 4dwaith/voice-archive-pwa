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

The production build generates the web app manifest and service worker in
`dist/`. Camera and microphone APIs require HTTPS in production (localhost is
accepted during development).

## Sample cover images

The bundled sample covers were retrieved from the
[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) using
cover IDs `14348537`, `13335427`, `8775559`, `13859660`, `12356249`, and
`6717853`. They can be replaced when the real library import flow is added.
