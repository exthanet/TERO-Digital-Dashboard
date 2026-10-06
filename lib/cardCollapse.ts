// Collapse / expand every card of the dashboard from one place:
//   level 1 = a section (.panel), toggled by its first <h2>;
//   level 2 = a box inside a section (<article> / .clip-detail-box), toggled by its first <h3>.
// Clicking the heading toggles it. The state is kept per browser (localStorage,
// a convenience only) by a key made of the section and the heading text.
// Only data-* attributes are set, which React leaves alone, so React keeps
// owning the markup; styles/collapse.css hides the content of a collapsed card.

const STORE = "dashboard-collapsed-cards";
/** Cards that stay as they are: number tiles, thumbnails, advice cards. */
const SKIP = ".kpi-card, .thumb-card, .advice-card";

let collapsed = new Set<string>();
const load = () => {
  try {
    collapsed = new Set(JSON.parse(localStorage.getItem(STORE) || "[]") as string[]);
  } catch {
    /* private window / blocked storage: start with everything open */
  }
};
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify([...collapsed]));
  } catch {
    /* per-browser convenience only */
  }
};

/** Heading text without numbers (counts change from day to day). */
const label = (h: Element) => (h.textContent || "").replace(/[\d,.%]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

/** The first heading of this card that is not inside a nested card. */
function headingOf(card: Element, tag: "h2" | "h3"): Element | null {
  for (const h of card.querySelectorAll(tag)) {
    if (h.closest(".panel, article, .clip-detail-box") === card) return h;
  }
  return null;
}

function mark(card: Element, level: 1 | 2) {
  const h = headingOf(card, level === 1 ? "h2" : "h3");
  if (!h) return;
  const panel = level === 1 ? card : card.closest(".panel");
  const panelName = panel ? panel.id || (headingOf(panel, "h2") ? label(headingOf(panel, "h2")!) : "") : "";
  const key = `${level}|${panelName}|${label(h)}`;
  if (card.getAttribute("data-collapse-key") !== key) card.setAttribute("data-collapse-key", key);
  if (!h.hasAttribute("data-collapse-head")) {
    h.setAttribute("data-collapse-head", String(level));
    h.setAttribute("title", "กดเพื่อยุบ / แสดง");
    // The heading and the elements around it down from the card stay visible when collapsed.
    for (let el: Element | null = h; el && el !== card; el = el.parentElement) el.setAttribute("data-collapse-keep", "");
  }
  const want = collapsed.has(key);
  if (card.hasAttribute("data-collapsed") !== want) card.toggleAttribute("data-collapsed", want);
}

/** Mark every card under `root` and apply the stored state. */
export function scanCards(root: ParentNode = document) {
  for (const card of root.querySelectorAll(".workspace .panel")) if (!card.matches(SKIP)) mark(card, 1);
  for (const card of root.querySelectorAll(".workspace .panel article, .workspace .panel .clip-detail-box, .clip-detail .clip-detail-box")) {
    if (!card.matches(SKIP)) mark(card, 2);
  }
}

function setCard(card: Element, on: boolean) {
  const key = card.getAttribute("data-collapse-key");
  if (!key) return;
  if (on) collapsed.add(key);
  else collapsed.delete(key);
  card.toggleAttribute("data-collapsed", on);
}

/** Every section on the page collapsed (true) or opened, boxes inside included. */
export function setAllCards(on: boolean) {
  scanCards();
  for (const card of document.querySelectorAll(".workspace [data-collapse-key]")) {
    if (on ? card.getAttribute("data-collapse-key")?.startsWith("1|") : true) setCard(card, on);
  }
  save();
}

const INTERACTIVE = "button, a, input, select, textarea, label, [role=button]";

function onClick(e: MouseEvent) {
  const target = e.target as Element | null;
  const head = target?.closest("[data-collapse-head]");
  if (!head || target!.closest(INTERACTIVE)) return;
  const card = head.closest("[data-collapse-key]");
  if (!card) return;
  setCard(card, !card.hasAttribute("data-collapsed"));
  save();
}

/** Start once for the page; returns a function that stops it. */
export function startCardCollapse(): () => void {
  load();
  // A short timer, not an animation frame: hidden tabs run no frames.
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      scanCards();
    }, 60);
  };
  // New sections appear when a tab opens or data arrives: mark them too.
  // Chart drawing (SVG) changes all the time and never adds a card: ignored.
  const observer = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !(n instanceof SVGElement)) return schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", onClick);
  scanCards();
  return () => {
    observer.disconnect();
    document.removeEventListener("click", onClick);
    if (timer) clearTimeout(timer);
  };
}
