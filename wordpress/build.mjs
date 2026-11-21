#!/usr/bin/env node
// Builds the WordPress plugin's assets and the Elementor page layouts from site.config.json.
//   node wordpress/build.mjs   →  wordpress/ambica-site/assets/ambica.{css,js} and import/pages.json
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PLUGIN = join(HERE, "ambica-site");
const cfg = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const CITY = cfg.baseCity, NAME = cfg.name;
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

mkdirSync(join(PLUGIN, "assets"), { recursive: true });
mkdirSync(join(PLUGIN, "import"), { recursive: true });
copyFileSync(join(HERE, "src/wp.css"), join(PLUGIN, "assets/ambica.css"));
copyFileSync(join(HERE, "src/wp.js"), join(PLUGIN, "assets/ambica.js"));

/* ---------- Elementor element helpers ---------- */
const id = () => randomBytes(4).toString("hex").slice(0, 7);
const con = (settings, elements, inner = true) => ({ id: id(), elType: "container", isInner: inner, settings: { content_width: inner ? "full" : "boxed", flex_direction: "column", ...settings }, elements });
const section = (cls, elements, extra = {}) => con({ css_classes: cls, ...extra }, elements, false);
const w = (widgetType, settings) => ({ id: id(), elType: "widget", widgetType, isInner: false, settings, elements: [] });
const heading = (title, tag = "h2", cls = "", extra = {}) => w("heading", { title, header_size: tag, ...(cls && { _css_classes: cls }), ...extra });
const text = (html, cls = "", extra = {}) => w("text-editor", { editor: html, ...(cls && { _css_classes: cls }), ...extra });
const sc = (shortcode, cls = "") => w("shortcode", { shortcode, ...(cls && { _css_classes: cls }) });
const button = (label, url, cls = "amb-btn") => w("button", { text: label, link: { url, is_external: "", nofollow: "", custom_attributes: "" }, _css_classes: cls });
const image = (key, alt) => w("image", { image: { url: `{{img:${key}}}`, id: `{{imgid:${key}}}`, alt, source: "library" }, image_size: "medium_large", _css_classes: "amb-photo" });
const toggle = faqs => w("toggle", { tabs: faqs.map(([q, a]) => ({ _id: id(), tab_title: q, tab_content: `<p>${esc(a)}</p>` })), faq_schema: "yes", _css_classes: "amb-faq" });
const title = (kicker, h2, sub) => con({ css_classes: "amb-title" }, [heading(kicker, "div", "amb-kicker"), heading(h2, "h2"), ...(sub ? [text(`<p>${sub}</p>`)] : [])]);
const fadeIn = (el, delay = 0) => { el.settings[el.elType === "container" ? "animation" : "_animation"] = "fadeInUp"; if (delay) el.settings[el.elType === "container" ? "animation_delay" : "_animation_delay"] = delay; return el; };

const cars = cfg.cabs;
const carKey = n => slugify(n);
const routes = cfg.routes.map(r => ({ ...r, slug: r.slug || `${slugify(CITY)}-to-${slugify(r.to)}-taxi` }));

/* ---------- home ---------- */
const home = [
  section("amb-hero amb-hero-home", [
    con({ css_classes: "amb-hero-copy" }, [
      heading(`${CITY} taxi service`, "div", "amb-eyebrow"),
      heading("Every journey,<br>a <em>better</em> experience.", "h1"),
      text(`<p>One-way drops, round trips, airport runs and outstation journeys from ${CITY}. Clean cars, drivers who know the highway, and fares agreed before you set off.</p>`, "amb-lead"),
      sc("[ambica_home_buttons]"),
    ]),
    con({ css_classes: "amb-card-col" }, [sc("[ambica_fare_card]")]),
  ], { flex_direction: "row", flex_direction_tablet: "column", flex_direction_mobile: "column" }),

  con({ content_width: "full", css_classes: "amb-ticker-wrap" }, [sc("[ambica_ticker]")], false),

  section("amb-sec amb-how", [
    title("How it works", "Booked in three steps"),
    con({ css_classes: "amb-steps", flex_direction: "row", flex_direction_tablet: "column", flex_direction_mobile: "column" }, [
      ["1", "Tell us the trip", "Pickup, drop, date and the car you want. A WhatsApp message or a call is enough."],
      ["2", "Get the fare", "We send the full fare for your date and say what it includes."],
      ["3", "Ride", "Your driver arrives before the pickup time. You settle up as agreed."],
    ].map(([n, h, p], i) => fadeIn(con({ css_classes: "amb-step" }, [heading(n, "div", "amb-step-num"), heading(h, "h3"), text(`<p>${p}</p>`)]), i * 120))),
  ]),

  section("amb-sec amb-services", [
    con({ css_classes: "amb-svc-side" }, [title("Services", "Whatever the trip, there is a car for it", "Tap Enquire on any service and the booking form fills itself in.")]),
    con({ css_classes: "amb-svc-list" }, cfg.services.map((s, i) => fadeIn(con({ css_classes: "amb-srow", flex_direction: "row" }, [
      heading(String(i + 1).padStart(2, "0"), "div", "amb-num"),
      sc(`[ambica_icon i="${s.icon.replace(/^i-/, "")}"]`),
      con({ css_classes: "amb-srow-text" }, [heading(esc(s.name), "h3"), text(`<p>${esc(s.text)}</p>`)]),
      button("Enquire", `#enquire?trip=${encodeURIComponent(s.trip)}&note=${encodeURIComponent(s.name)}`, "amb-btn amb-btn-ghost"),
    ]), (i % 4) * 80))),
  ], { flex_direction: "row", flex_direction_tablet: "column", flex_direction_mobile: "column", _element_id: "services" }),

  section("amb-sec amb-routes-sec", [
    title("Routes", `Popular trips from ${CITY}`, "Going somewhere else? Ask and we will quote it."),
    sc("[ambica_routes]"),
  ], { _element_id: "routes" }),

  section("amb-sec amb-fleet-sec", [
    title("Fleet", "Pick the car that fits", "By group size and luggage."),
    con({ css_classes: "amb-fleet-grid", flex_direction: "row", flex_wrap: "wrap" }, cars.map((c, i) => fadeIn(con({ css_classes: "amb-fleet" }, [
      image(carKey(c.name), `${c.name} taxi (${c.note})`),
      heading(esc(c.name), "h3"),
      text(`<p>${esc(c.seats)}<br>${esc(c.note)}</p>`),
      heading(esc(c.tag), "div", "amb-tag"),
    ]), i * 100))),
    text(`<p>${esc(cfg.photoCredits)}</p>`, "amb-credits"),
  ], { _element_id: "fleet" }),

  section("amb-sec amb-dark amb-why", [
    title("Why Ambica", "What you can count on, every trip"),
    con({ css_classes: "amb-why-grid", flex_direction: "row", flex_direction_mobile: "column" }, [
      ["clock", "On time", "Your driver reaches the pickup point before the agreed time."],
      ["rupee", "Fare fixed first", "You get the full fare before the trip starts. Tolls and extras are spelled out."],
      ["spark", "Clean cars", "Every car is cleaned and checked before it leaves for your pickup."],
      ["shield", "Seasoned drivers", "Drivers who know Gujarat and Maharashtra highways and drive them safely."],
    ].map(([ic, h, p], i) => fadeIn(con({ css_classes: "amb-why-card" }, [sc(`[ambica_icon i="${ic}"]`), heading(h, "h3"), text(`<p>${p}</p>`)]), i * 100))),
  ]),

  section("amb-sec amb-book", [
    title("Book", "Book a Ride", "Fill in your trip and send it to us on WhatsApp. We reply with the fare and confirm your car."),
    sc("[ambica_booking]"),
  ], { _element_id: "book" }),
];

/* ---------- one page per route ---------- */
const routePage = r => {
  const name = `${CITY} to ${r.to}`;
  const carNames = cars.map(c => c.name);
  const faqs = [
    [`How far is ${r.to} from ${CITY} by road?`, `${r.to} is about ${r.km} km from ${CITY} by road. The drive usually takes ${r.hours}, depending on traffic and the stops you want to make.`],
    [`Can I book a one-way taxi from ${CITY} to ${r.to}?`, `Yes. With a one-way booking you pay for the drop only. If you are coming back, a round trip keeps the same car and driver with you.`],
    [`Which cars can I choose for ${name}?`, `You can pick from ${carNames.slice(0, -1).join(", ")} or ${carNames.at(-1)}, depending on how many people are travelling and how much luggage you have.`],
    [`How do I get the fare for ${name}?`, `Send us your travel date, pickup time and car choice on WhatsApp or call ${cfg.phone}. We confirm the full fare before the trip, and tell you up front what is included.`],
  ];
  return [
    section("amb-hero amb-hero-sub", [
      text(`<p><a href="/">Home</a> / <a href="/#routes">Routes</a> / ${esc(name)}</p>`, "amb-crumbs"),
      heading(NAME, "div", "amb-eyebrow"),
      heading(`${esc(CITY)} to <em>${esc(r.to)}</em> Taxi`, "h1"),
      text(`<p>${esc(r.blurb)} One way or round trip, with the fare confirmed before you travel.</p>`, "amb-lead"),
      sc("[ambica_route_buttons]"),
    ]),
    section("amb-sec-tight", [sc("[ambica_route_facts]")]),
    section("amb-sec", [title("Cars", `Cars for ${esc(name)}`, "Pick a car and we will send you the fare for your date."), sc("[ambica_route_cars]")]),
    section("amb-sec amb-about", [
      title("About this trip", `${esc(name)} by taxi`),
      text(`<p>${NAME} runs taxis from ${CITY} to ${esc(r.to)} on any day of the week, one way or as a round trip. The drive is about ${r.km} km and usually takes ${esc(r.hours)}, depending on traffic and the stops you want to make.</p><p>Choose a Sedan for up to 4 people, an SUV or Innova Crysta for families and extra luggage, or a Tempo Traveller for larger groups. We pick you up from your address in ${CITY} and confirm the full fare before you travel.</p>`, "amb-prose"),
    ]),
    section("amb-sec amb-book", [title("Book", `Book your ${esc(name)} cab`, "Fill in your trip and send it to us on WhatsApp. We reply with the fare and confirm your car."), sc("[ambica_booking]")], { _element_id: "book" }),
    section("amb-sec", [title("Questions", `${esc(name)}: common questions`), toggle(faqs)]),
    section("amb-sec", [title("More routes", `More routes from ${CITY}`), sc("[ambica_other_routes]")]),
  ];
};

const pages = [
  {
    slug: "home", title: "Home", front: true,
    text: `${NAME}: taxi service in ${CITY} for one-way drops, round trips, outstation journeys and airport transfers.`,
    seo: {
      title: `${NAME} | ${CITY} Taxi Service: One Way, Round Trip & Airport Cabs`,
      description: `${NAME} is a ${CITY} taxi service for one-way drops, round trips, outstation journeys and airport transfers. Clean cars, experienced drivers. Call or WhatsApp to book.`,
      focus: `taxi service in ${CITY.toLowerCase()}`,
    },
    elementor: home,
  },
  ...routes.map(r => ({
    slug: r.slug, title: `${CITY} to ${r.to} Taxi`,
    text: `${CITY} to ${r.to} taxi: about ${r.km} km, ${r.hours}. ${r.blurb}`,
    route: { to: r.to, km: r.km, hours: r.hours, blurb: r.blurb },
    seo: {
      title: `${CITY} to ${r.to} Taxi | One Way & Round Trip Cab | ${NAME}`,
      description: `Book a ${CITY} to ${r.to} taxi with ${NAME}. About ${r.km} km, ${r.hours}. ${cars.map(c => c.name).join(", ")}. One way or round trip. Call or WhatsApp for the fare.`,
      focus: `${CITY} to ${r.to} taxi`.toLowerCase(),
    },
    elementor: routePage(r),
  })),
];

writeFileSync(join(PLUGIN, "import/pages.json"), JSON.stringify(pages, null, 1));
console.log(`Plugin assets copied; ${pages.length} Elementor pages written to import/pages.json`);
