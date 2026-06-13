# KomikaID

KomikaID is an Indonesian comics reader built for fast, uninterrupted reading
across the web and Android. It combines a responsive editorial interface with
offline downloads, reading progress, personal collections, and release
notifications.

## Reading Experience

- Browse daily comic updates and search the catalog by title or genre.
- Read chapters in a distraction-free vertical reader.
- Jump directly to any chapter with searchable chapter navigation.
- Continue from the exact chapter and page previously viewed.
- Keep reading during weak connections or completely offline.
- Move naturally through reading history with browser and Android back
  navigation.

## Personal Library

- Comics enter the collection automatically after reading.
- Favorites, reading history, and chapter progress remain available locally.
- Signed-in readers can synchronize their library between devices.
- Explicit chapter downloads are retained until the reader removes them.
- Temporary image data uses bounded caching for consistently fast loading.

## Releases And Notifications

- Comic cards display the latest release time and highlight fresh updates.
- Readers can follow individual comics for new-chapter notifications.
- OneSignal provides Android push delivery and notification identity mapping.
- Notification links open the relevant comic or chapter directly.

## Offline First

KomikaID treats local data as a first-class source rather than a fallback.
Cached catalog pages, comic details, chapter lists, progress, and downloaded
pages render immediately while online updates happen in the background.
Interrupted downloads can resume without discarding completed pages.

## Interface

The interface uses a dark editorial visual system designed around comic cover
art. Navigation is optimized for mobile touch targets, reader controls remain
out of the artwork's way, and motion is limited to short transform and opacity
transitions with reduced-motion support.

## Technology

- React, TypeScript, Vite, and React Router
- Capacitor for Android and iOS projects
- Clerk authentication with Google sign-in
- OneSignal and Firebase Cloud Messaging for Android notifications
- SQLite, IndexedDB, and Capacitor Filesystem for offline storage
- TanStack Query and Zustand for remote and interface state
- Express, Zod, and a first-party Shinigami provider adapter
- Vitest and Playwright for automated verification

## API Architecture

KomikaID exposes its own normalized API routes instead of coupling the client
to an upstream implementation. The provider layer validates Shinigami
responses, applies bounded retries and caching, and restricts external image
requests through explicit host and content checks.

## Platforms

- Progressive web application
- Android application package
- Capacitor iOS project for compatibility and future distribution

## Status

KomikaID currently includes catalog browsing, search and genre filters, comic
details, complete chapter navigation, reading progress, collections,
downloads, offline startup, account synchronization, Google authentication,
and Android push notification integration.
