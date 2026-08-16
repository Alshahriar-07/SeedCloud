# Seed Cloud — Design System

## Design goal

Simple, calm, familiar, and highly functional.

The UI should feel as easy to understand as a mainstream file manager.

## Main layout

```text
+----------------------------------------------------------+
| Seed Cloud | Search files...                    Account |
+-------------+--------------------------------------------+
| + New       |                                            |
|             | My Drive                                   |
| Home        |                                            |
| My Files    | Folders / Files                            |
| Starred     |                                            |
| Trash       |                                            |
|             |                                            |
| Clouds      |                                            |
| Google      |                                            |
| OneDrive    |                                            |
| Dropbox     |                                            |
| ...         |                                            |
|             |                                            |
| Storage     |                                            |
+-------------+--------------------------------------------+
```

## UX principles

- No unnecessary animations.
- No clutter.
- Important actions should be obvious.
- Upload should be one of the easiest actions.
- File context menu should contain common operations.
- Provider complexity should remain mostly hidden.
- Show useful status when routing occurs.
- Errors should explain what happened and what the user can do.

## Responsive design

Desktop is the primary target.

Mobile should remain usable for:

- Browsing
- Search
- Download
- Share
- Basic file management

## Brand direction

Seed Cloud has its own icon and should not reuse the Seed Code icon.

The Seed Cloud icon uses a cloud/connectivity concept with a seed motif while remaining visually related to the Seed ecosystem.

Assets:

- `assets/logo.png`
- `assets/icon.png`
