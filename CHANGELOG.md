# Changelog

All notable changes are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository documentation set: README, architecture and BLE guides, contribution rules,
  security policy, issue/PR templates and a CI workflow (lint, types, tests, build).
- Unit test suite (Vitest) covering CBOR/SMP encoding, session-control packet framing,
  hex/base64 packet ingestion, respiration signal processing and AI response parsing.
- `typecheck`, `test`, `test:watch`, `test:coverage` and `format:check` package scripts.
- CI split into parallel Lint & format / Type check / Unit tests / Production build jobs with
  a single required status check and a bundle-size step summary.
- CodeQL security analysis, dependency review on pull requests, grouped Dependabot updates,
  automatic pull-request labelling and stale triage.
- Release note categories (`.github/release.yml`), `CODEOWNERS`, `CODE_OF_CONDUCT.md`,
  `SUPPORT.md`, `docs/TESTING.md` and `docs/RELEASING.md`.

### Changed

- Consolidated the app onto a single `/app` route.
- Whole codebase formatted to a single Prettier standard; generated backend clients are
  excluded from linting.
- Replaced loose `any` annotations in Coach, History, live-metrics and sleep code with
  explicit types.
- Home screen uses progressive disclosure to reduce information density.

### Fixed

- Sign-up accepts any password of 8+ characters.
