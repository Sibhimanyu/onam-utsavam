# Design System — Onam Pookalam Quiz

> **The memorable thing: the artwork itself is your score.**
> Every design decision below serves it. If a change makes the pookalam less
> central, less legible, or less earned, the change is wrong.

## Product Context

- **What this is:** A real-time Kerala Onam trivia party game — solo play on
  phones plus host-led live rounds with QR join, a Firebase realtime
  leaderboard, and projector-ready final standings.
- **Who it's for:** Colleagues at an office Onam celebration; players join on
  personal phones, the room watches a projector.
- **Space/industry:** Live audience quiz (peers: Kahoot, Slido, Jackbox,
  Crowdpurr) × festival craft.
- **Project type:** Web app, vanilla HTML/CSS/JS, no build step, Firebase
  Hosting. Fonts must be `<link>`-loadable.

## Aesthetic Direction

- **Direction:** Festival craft — *"a pookalam laid in daylight."*
  Organic/ceremonial, editorial discipline.
- **Decoration level:** Intentional. Governing rule (all three design voices
  agreed): **ornament must represent state.** No stray flower illustrations,
  corner flourishes, or decorative mandalas that don't encode score, progress,
  rank, or status.
- **Mood:** Warm, handmade, quietly ceremonial during play, celebratory at
  the finale. The first-3-seconds target: *"oh — someone made this for us,"*
  the same breath as finding a real athapookalam in the lobby.
- **One palette, every surface.** The solo phone flow, the host projector
  view, and the participant flow all share the warm cream daylight scheme.
  A dark "Dusk" projector variant was built and **rejected by the owner on
  2026-08-30** — cross-surface consistency beats theatrical theming here.
  Do not reintroduce a dark surface without explicit approval.
- **Reference research (2026-08-30):** kahoot.com, sli.do, jackboxgames.com,
  crowdpurr.com. The category converges on saturated gradients and colored
  answer tiles; none has a material/craft identity. That gap is ours.

## Typography

Four voices, strict roles. All Google Fonts, loaded via `<link>` +
`preconnect`, `font-display: swap`. No system-ui as a visible face.

- **Display/Hero — Fraunces** (variable: `opsz 9..144`, `wght 300..900`,
  `SOFT`, `WONK`) — titles, questions, round names, champion names, oversized
  rank numerals. Wonk axis **ON** for celebration screens, **OFF** for
  questions. Replaces Iowan Old Style, which only ships on Apple devices —
  Android phones at the party currently fall back to Georgia. Both outside
  design voices (Codex and Claude subagent) independently chose Fraunces.
- **Body/UI — Anek Malayalam** (variable `wght 300..700`) — questions, answers,
  player names, instructions. Latin + Malayalam drawn as one family by Ek Type:
  Malayalam is a first-class script, not a fallback glyph panic.
- **Data — IBM Plex Sans Condensed** (500/600/700, `font-variant-numeric:
  tabular-nums`) — scores, timers, room codes, leaderboard columns. Tabular
  figures keep the live leaderboard from jittering as scores update. The room
  code is display typography, not a badge: 72–96px, wide tracking.
- **Flourish — Chilanka** — **exactly one use per screen, or none**: the
  "ഓണാശംസകൾ" greeting and the champion's title card. Handwriting = human hand
  = pookalam-making. Anywhere else it becomes theme-park.
- **Code (dev-facing only):** ui-monospace stack (unchanged).
- **Loading:**
  `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@...&family=Anek+Malayalam:wght@300..700&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=Chilanka&display=swap`
- **Scale (phone):** question 20–22px (1.3rem Fraunces), body 16–17px, rail
  labels 12–13px Plex Condensed, min body 14px.
- **Scale (projector @1080p) — hard floors, from the Codex voice:**
  informational text ≥24px; player names 32–40px; questions 48–64px; room code
  72–96px; champion name ≥80px (Fraunces 800–900). Test with long names from
  six metres.

## Color

- **Approach:** Balanced, with a monopoly rule: **the pookalam owns vivid
  color.** UI chrome stays quiet so the artwork is the only cumulative, vivid
  object on screen. Gold is reserved for winning/trophy value — never ordinary
  buttons or routine status.

### The palette (all surfaces)

| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FBF6EC` | background |
| `--paper` | `#FFFDF8` | surface/cards |
| `--earth` | `#F2E9D8` | inset surfaces |
| `--ink` | `#2A2118` | primary text |
| `--muted` | `#6F685D` | secondary text (5.11:1 on cream) |
| `--hair` | `#E2D9C6` | hairline borders |
| `--marigold` | `#F08C00` | accent — primary CTAs (ink text on it, not white) |
| `--red` | `#A8201A` | ceremonial emphasis, wrong-state |
| `--green` | `#1E5B3A` | confirmed success |
| `--gold` | `#C9A227` | decorative only — never body text |
| `--gold-text` | `#8A6A10` | gold-toned labels (4.70:1 on cream) |

- **Semantic:** success = green, warning = gold-text, error = red,
  info = muted. Correct/incorrect must always carry a word or symbol as well
  as color.
- **Depth:** hairlines and spacing over shadows; the soft warm card shadows
  already in `styles.css` are the ceiling, not the floor to build on.
- **Dark mode:** none. A dark "Dusk" projector palette was implemented and
  rejected on 2026-08-30 (owner call: one consistent scheme everywhere). The
  rejected token set lives in git history at commit `836523f` if ever needed.

## Spacing

- **Base unit:** 8px.
- **Density:** comfortable on phones, spacious on projector.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout

- **Approach:** Composition-first poster, not component-first document. Every
  primary state occupies one viewport and reads in under two seconds — no
  scrolling dashboards during play.
- **Phone (portrait handbill):** utility rail (round, score, timer) on top; the
  pookalam ~40% of viewport, may bleed/crop past an edge to feel larger than
  the phone; question below in Fraunces; answers as one vertical ballot within
  thumb reach. **Never shrink question type to preserve the artwork — crop the
  pookalam more aggressively instead.**
- **Projector lobby (16:9 split-stage):** left ~55–58% one enormous pookalam,
  cropped by edges; right panel: room title, join code, QR (≥280px square on
  1080p with a clean quiet zone), player count, latest arrivals.
- **In-round projector:** the right column becomes the question stage; the live
  leaderboard is a narrow lower strip (max 5 ranked players at once), never the
  whole screen.
- **Final standings — "The Room Blooms":** the climax is communal, then
  personal. (1) Composite every player's rings into one shared pookalam —
  the room sees itself as one artwork. (2) Reveal ranks rim-inward,
  accelerating toward the center. (3) The champion IS the center: their name
  across the artwork's lower edge in ≥80px Fraunces (wonk on), Chilanka title
  card above, podium (2nd/3rd) stacked right, everyone else in one restrained
  bottom ticker. Near-symmetry is allowed **only here** — ceremony earns it.
- **Max content width:** 1080px for any document-style page; game screens are
  viewport-fit.
- **Border radius:** 4px (cards, buttons) or square. Pills only for compact
  status chips. **Only the pookalam is circular.** Answer petals may use
  organic asymmetric radii (e.g. `62% 38% 55% 45% / 48% 60% 40% 52%`).

## Signature Components

- **Answer ballot (the anti-Kahoot):** quiet typographic full-width rows marked
  **൧ ൨ ൩ ൪** (Malayalam numerals) with small Latin subscripts — never the
  four-color tile grid. Color is withheld from answers so the pookalam keeps
  its monopoly. On answer, the selected row compresses slightly and the earned
  ring blooms.
- **Pookalam as progress:** unfinished rings render as pale engraved outlines —
  players see the artwork waiting to emerge. Correct = full-color ring; wrong =
  muted ring. Ring count literally is "Question N of M."
- **Rank as craft:** leaderboards lead with each player's bloom-completeness;
  numeric scores are subordinate annotations (kept in the utility rail on
  phones, revealed fully only at final standings).

## Motion

- **Approach:** Intentional. Max two simultaneous areas of motion on the
  projector.
- **Signature transition — the ring bloom (320ms):** petal segments appear
  clockwise → the completed ring settles inward by 2% → one restrained gold
  pulse travels the perimeter. Wrong answers: the next engraved ring gets one
  short red heartbeat. No screen shake, no per-answer confetti, no continuous
  rotation.
- **Finale:** the communal pookalam assembles center-outward over ~1.8s, then
  the champion's name. Confetti exactly once, here only — falling marigold and
  chethi petals with air resistance that **settle at the bottom of the frame
  and stay** for the rest of the party.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 50–100ms · short 150–250ms · medium 250–400ms ·
  long 400–700ms · ceremonial (finale only) up to 1.8s.
- Respect `prefers-reduced-motion`: blooms become opacity fades.

## Anti-slop Constraints

No gradients as decoration (the existing warm radial "festival floor" wash is
the one grandfathered exception — it encodes place, not polish). No decorative
blobs, no 3-column icon grids, no universal center alignment, no glassmorphism,
no floating-card shadow stacks, no gradient CTA buttons, no system-ui as a
visible face, no floral ornament that doesn't encode state.

## Safe Choices vs. Risks

**Safe (category table stakes):** giant join code + QR always visible in the
lobby; one question per viewport with huge type; live leaderboard;
thumb-reach answers.

**Risks (the product's own face):**
1. **Ballot rows over colored tiles** — costs instant Kahoot familiarity; buys
   the pookalam a monopoly on color.
2. **Rank as craft** — costs at-a-glance numeracy mid-round; buys the memorable
   thing.
3. **One palette everywhere** — costs the theatrical dark-finale option; buys
   a product that reads as one crafted object from phone to projector.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-30 | Initial design system created | /design-consultation: codified the existing pookalam identity, researched Kahoot/Slido/Jackbox/Crowdpurr, synthesized three design voices (Claude main + Codex + Claude subagent) |
| 2026-08-30 | Fraunces replaces Iowan Old Style | Iowan is Apple-only; Android falls back to Georgia. Both outside voices independently chose Fraunces |
| 2026-08-30 | Anek Malayalam as UI face | Malayalam first-class in one variable family; both outside voices agreed |
| 2026-08-30 | Day/Dusk split by surface | Codex kept daylight, subagent proposed all-dark "Nilavilakku"; synthesis assigns light to phones, dark to projector |
| 2026-08-30 | Numeric score kept in phone rail, hidden from mid-round projector | Subagent proposed killing all numbers during play; softened — party players ask "what's my score" |
| 2026-08-30 | **Dusk projector theme removed** | Owner rejected the dark host view after seeing it live: "where is the consistency?" One warm cream palette on every surface. Supersedes the Day/Dusk split above; rejected tokens preserved at commit `836523f` |
| 2026-08-30 | Home button on every non-start screen | Owner request: players and hosts must be able to return to the main page after entering solo, host, or join |

*Preview artifact: `~/.gstack/projects/Sibhimanyu-onam-utsavam/designs/design-system-20260830/preview.html` (specimens + mockups; its Day/Dusk toggle predates the Dusk rejection — Day is canonical).*
