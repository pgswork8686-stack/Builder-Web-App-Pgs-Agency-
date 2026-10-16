# UI/UX, Accessibility & Responsive Audit

**Browser-based review at 1440 / 1024 / 768 / 375 px was NOT performed.** The web app could not be built or started on the audit machine (native Next.js/SWC binaries are blocked by Windows Application Control), and no authenticated session was available. No before/after screenshots exist. Everything below is from code reading.

## Applied in new components (code-level, unrendered)

- Labelled controls (`aria-label` on search and filters), table with `<caption class="sr-only">` and `scope="col"` headers.
- Loading (`aria-busy`, spinner text), error (`role="alert"` + retry) and empty states for List/Kanban/Calendar.
- Kanban: keyboard/touch alternative to drag-and-drop (← / → buttons with descriptive `aria-label`); columns are `<section aria-label>`.
- Overdue is conveyed with text ("quá hạn"), not colour alone.
- Visible focus rings on inputs/selects (`focus-visible:ring-2`).
- List table is wrapped in `overflow-x-auto` for narrow widths; Kanban collapses to one column below `md`.

## Open / unverified

| ID  | Severity | Item                                                                                                                                                                                    |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-1 | Unknown  | Colour contrast of the new badges, `text-[#7C879D]` on white (≈ 3.9:1 by estimate — likely **below** WCAG AA 4.5:1 for 10–12 px text; this grey is used throughout the existing design) |
| U-2 | Medium   | Calendar day cells show ≤3 items with "+N nữa" but the overflow is not clickable (no day-detail view)                                                                                   |
| U-3 | Unknown  | Dragging on touch devices (HTML5 DnD is unreliable on mobile; the ←/→ buttons are the fallback)                                                                                         |
| U-4 | Unknown  | Layout, overflow and typography on every other screen                                                                                                                                   |
| U-5 | Low      | Source contained mojibake-looking Vietnamese only in console output, not in files; files are valid UTF-8 (new/edited strings verified via edit round-trip)                              |

Remaining risk: all items require a rendered review (axe/Lighthouse + manual keyboard pass) in staging.
