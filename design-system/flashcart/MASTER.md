# FlashCart design system

**Product:** Consumer electronics marketplace for shoppers, sellers, and operations staff in India.
**Stack:** Express-served HTML, Tailwind utility classes, plain JavaScript, Lucide icons.
**Direction:** Vibrant retail blocks with a calm, trustworthy base. Make the sale signal memorable; keep search, prices, and checkout clear.

## Design principles

- Lead with real products and current catalog data. Never invent reviews, stock, delivery promises, or price claims.
- Use green for marketplace trust and completion; use orange and warm yellow only for deals, savings, and priority actions.
- Build clear page hierarchy with strong section headers, one main action per panel, and consistent grid gaps.
- Keep customer shopping surfaces warm and legible. Give seller and admin views a denser operational layout while sharing the same tokens.
- Use short, direct labels. Keep engineering and diagnostic language out of customer views.
- Preserve the existing API, authentication, cart, checkout, payment, and dashboard interactions.

## Tokens

| Role | Token | Value |
|---|---|---|
| Primary action | `--fc-green` | `#08745A` |
| Primary hover | `--fc-green-hover` | `#075E49` |
| Deep campaign surface | `--fc-green-deep` | `#104C3F` |
| Light green surface | `--fc-green-light` | `#E4F2EB` |
| Sale emphasis | `--fc-orange` | `#C84E20` |
| Highlight surface | `--fc-sun` | `#F5C75C` |
| Page background | `--fc-bg` | `#EAF1EC` |
| Surface | `--fc-surface` | `#FFFFFF` |
| Main text | `--fc-ink` | `#162A2A` |
| Muted text | `--fc-muted` | `#627572` |
| Border | `--fc-line` | `#D7E2DB` |

Text on green and orange actions meets 4.5:1 contrast against white; ink on yellow is used for campaign CTAs. Keep muted text on the page background at or above 4.5:1.

## Type

- Headings: Rubik, 600–800; use sentence case and tight tracking.
- Body and controls: Nunito Sans, 400–700.
- Hero: clamp from 2.8rem on narrow screens to about 5rem on wide screens.
- Product titles: 13–15px; prices: 15–17px with tabular numerals; labels: 12–13px.

## Layout and components

- Header: white utility row with brand, a usable search field, wishlist, cart, and account; deep-green secondary nav rail. Keep the search field wide and the actions easy to reach at tablet widths. Browse categories through the home shortcuts and catalog chips.
- Home: green campaign hero with real catalog imagery, a concise value proposition, and sale CTA. Place free delivery, secure payment, and return-policy cards in a separate benefits section beneath the hero. The featured-product carousel advances every five seconds, pauses on pointer hover/focus or hidden tabs, and exposes previous/next/dot controls. Keep each featured image clickable to open that product's details. Follow with the category shortcut panel, live deals, trending products, and existing promotions.
- Canvas and surfaces: use a sage base with soft green and citrus radial washes. Keep white cards distinct with a visible border and shadow; avoid a flat white page. Empty states may use a restrained green-to-citrus gradient, line-art rings, and one clear action.
- Catalog: lead with quick category chips so browsing starts with products and categories. Use a deep-green title banner and a sage-tinted page canvas to separate the page from white product cards. Put compact sorting beside the expandable advanced filters in a secondary toolbar above results. Keep filters collapsed by default; when opened, give category its own full-width row before the other filters and use clear switch controls for stock and sale toggles. Preserve all filter, sort, pagination, and product actions.
- Wishlist: pair the saved-items heading with a colored bookmark motif. When empty, show a friendly illustrated state and a short shelf of real popular catalog picks.
- App views: only the current view is visible. Display utilities must preserve responsive visibility classes; the catalog's grid layout applies only while its hidden state is absent.
- Product cards: pale image well, brand and title, rating, price/savings, wishlist, and a high-contrast 44px add action with a persistent visible plus sign.
- Account and operations: white panels on a pale green canvas; metrics, lists, tables, and warehouse status retain their existing data bindings.
- Dialogs and drawer: use in-app dialogs for confirmations and text entry; avoid native browser `confirm` and `prompt` popups. Use white surfaces, clear headings, visible focus, a strong scrim, keyboard dismissal, and a clear primary action. Checkout actions remain visually distinct from secondary actions.
- Grid rhythm: use consistent 8px multiples and `gap` for repeated layouts. Radius 8–16px by hierarchy; reserve the largest radius for campaign surfaces.

## Interaction and accessibility

- Use Lucide SVG icons consistently at a shared 1.9px outline weight; hide decorative SVGs from assistive technology, label icon-only buttons, and expose active navigation with `aria-current`.
- Keep controls at least 44px high on mobile. Use visible `:focus-visible` rings.
- Keep transitions between 150–200ms; do not shift surrounding layout on hover. Honor `prefers-reduced-motion` by avoiding added movement effects.
- Let filter chips and category shortcuts scroll or wrap without clipping. Keep tables inside their existing horizontal-scroll container.
- Connect form labels to fields, use numeric input modes for price entry, and retain browser validation feedback.
- Keep DOM reading order aligned with the visual order at 375px, 768px, 1024px, and 1440px. Check landscape phone layouts and avoid horizontal page overflow.

## Responsive behavior

- Below 760px, the search field takes its own row; navigation remains horizontally scrollable; category chips wrap; advanced filters stay collapsed until requested; hero and operations grids stack; dialogs anchor to the bottom with a `dvh` height cap.
- At 768–1023px, keep the hero split only when both columns remain readable; otherwise stack it.
- Keep the catalog filter panel above products on narrow screens and tables scrollable within their panel.

## Motion

Use motion only for feedback to user actions. Do not add scroll-driven reveals to commerce content. Reduced motion disables transitions and smooth scrolling.
