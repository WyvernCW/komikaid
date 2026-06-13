<div align="center">
  <img src="./public/icons/icon-192.png" width="112" alt="KomikaID logo">

  # KomikaID

  **An Indonesian comic reader built for fast, uninterrupted reading.**

  Web and Android support, offline chapters, reading progress, personal
  collections, authentication, and release notifications in one dark
  editorial experience.

  [![React](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
  [![Android](https://img.shields.io/badge/Android-supported-3ddc84?logo=android&logoColor=white)](https://developer.android.com/)
  [![License](https://img.shields.io/badge/license-MIT-f0c93d)](./LICENSE)
</div>

---

## What Is KomikaID?

KomikaID is a mobile-first Indonesian comic application for readers who want
their library to remain useful even when the network does not. Catalog data,
comic details, chapter progress, and downloaded pages are stored locally and
shown immediately while fresh data loads quietly in the background.

The interface puts comic artwork and reading first: compact navigation,
searchable chapter lists, clear release information, and a distraction-free
vertical reader.

## Highlights

### Discover

- Browse daily releases and paginated comic catalogs.
- Search by title and filter genres with include or exclude rules.
- See the latest two chapters directly beneath each comic cover.
- Open complete comic details, descriptions, tags, and searchable chapter lists.

### Read

- Smooth vertical chapter reader with page preloading.
- Jump to any chapter from the reader without leaving the page.
- Continue from the exact chapter and page previously viewed.
- Navigate naturally using browser history or Android back navigation.
- Adjust reader brightness and move between adjacent chapters.

### Keep It Offline

- Download complete chapters for permanent offline reading.
- Resume interrupted downloads without restarting completed pages.
- Keep explicit downloads until they are manually removed.
- Cache catalog, details, chapter lists, and images for low-connectivity use.
- Use bounded temporary caching to keep storage and loading predictable.

### Personalize

- Automatically add read comics to the collection.
- Track favorites, history, chapter progress, and download status.
- Use KomikaID without an account, then merge local history after signing in.
- Synchronize signed-in collection data across supported devices.

### Stay Updated

- Follow individual comics for release notifications.
- Receive Android push notifications through OneSignal and Firebase.
- Open notification links directly to the relevant comic or chapter.
- Review recent releases in the in-app notification inbox.

## Design

KomikaID uses a dark editorial system built around charcoal surfaces, warm
off-white typography, and a controlled yellow accent. The interface is
mobile-first, uses accessible touch targets, supports reduced motion, and
keeps navigation available without covering reading content.

## Architecture

```text
React application
    |
    +-- TanStack Query       Remote data and cache lifecycle
    +-- Zustand              Transient interface state
    +-- IndexedDB / SQLite   Library, history, progress, and metadata
    +-- Capacitor Filesystem Downloaded chapter pages
    |
KomikaID API
    |
    +-- Runtime validation
    +-- Request timeout and bounded retry
    +-- Stale-cache fallback
    +-- Rate limiting
    +-- Restricted image proxy and caching
    |
Shinigami content provider
```

The client talks only to KomikaID's normalized API routes. Upstream behavior
is isolated behind a provider adapter so response validation, caching,
security restrictions, and future provider changes do not leak into the
interface.

## Technology

| Area | Technology |
| --- | --- |
| Interface | React, TypeScript, Vite, React Router |
| Mobile | Capacitor, Android, iOS project |
| Data | TanStack Query, Zustand, Zod |
| Offline storage | SQLite, IndexedDB, Capacitor Filesystem |
| Authentication | Clerk |
| Notifications | OneSignal, Firebase Cloud Messaging |
| Backend | Express, first-party provider adapter |
| Verification | Vitest, Playwright, ESLint |

## Platforms

| Platform | Status |
| --- | --- |
| Web / PWA | Supported |
| Android | Supported |
| iOS | Capacitor project available; final signing requires macOS |

## Project Status

KomikaID includes catalog browsing, genre filtering, comic details, complete
chapter navigation, offline downloads, reading restoration, collections,
account synchronization, authentication, and Android notification support.

---

<div align="center">
  Built for readers who should not have to choose between speed, reliability,
  and a clean reading experience.
</div>
