// Card dimensions fed to both Dagre (lib/orgChart/layout.ts) and the
// EmployeeNode's rendered box, so layout math and the actual DOM box never
// drift apart. Mobile drops the department line, so it gets a shorter card.
//
// These must fit the tallest real content EmployeeNode renders: a 48px
// avatar + up to a 2-line name + up to 2 more single-line rows
// (position/department, desktop only) + the flex gaps between them + the
// card's own padding and border. Getting this too small clips the text
// instead of ellipsizing it. Width is deliberately unchanged — a long name
// wraps to a second line rather than growing the card sideways.
export const CARD_WIDTH = 200;
export const CARD_HEIGHT_DESKTOP = 152;
export const CARD_HEIGHT_MOBILE = 130;
export const MOBILE_BREAKPOINT_PX = 640; // Tailwind `sm`

// Above this many chart members, start with depth-1 managers collapsed so
// first paint stays legible; at or below it, show the whole chart expanded.
export const AUTO_COLLAPSE_THRESHOLD = 30;

// Below this many chart members, a minimap adds clutter without payoff.
export const MINIMAP_THRESHOLD = 40;
