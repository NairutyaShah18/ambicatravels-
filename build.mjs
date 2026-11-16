#!/usr/bin/env node
// Builds the whole site into ./dist from site.config.json. No packages needed: `node build.mjs`.
// Output: home page, one landing page per route, sitemap.xml, robots.txt, 404.html.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, process.argv[2] || "dist");
const read = f => readFileSync(join(ROOT, f), "utf8");
const cfg = JSON.parse(read("site.config.json"));

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const digits = s => String(s || "").replace(/\D/g, "");
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ORIGIN = "https://" + cfg.domain;
const CITY = cfg.baseCity;
const placeholderPhone = /0{5}/.test(digits(cfg.phone));
const warnings = [];
if (placeholderPhone) warnings.push("phone / whatsapp are still placeholders in site.config.json");
if (!Object.values(cfg.tracking).some(Boolean)) warnings.push("no tracking IDs set: ads conversions will not be recorded");

const routes = cfg.routes.map(r => ({ ...r, slug: r.slug || `${slugify(CITY)}-to-${slugify(r.to)}-taxi` }));
const L = {
  tel: "tel:" + cfg.phone.replace(/\s/g, ""),
  wa: "https://wa.me/" + digits(cfg.whatsapp),
  mail: "mailto:" + cfg.email,
};

/* ---------- assets (hashed file names so browsers can cache them for a year) ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
const asset = (src, ext) => {
  const body = read(src);
  const name = `site.${createHash("sha256").update(body).digest("hex").slice(0, 10)}.${ext}`;
  writeFileSync(join(OUT, "assets", name), body);
  return "/assets/" + name;
};
const CSS = asset("src/site.css", "css");
const JS = asset("src/site.js", "js");
const SPRITE = read("src/sprite.svg");
if (existsSync(join(ROOT, "src/static"))) cpSync(join(ROOT, "src/static"), OUT, { recursive: true });
const hasOg = existsSync(join(ROOT, "src/static/og.png"));

/* ---------- small pieces ---------- */
const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const car = `<svg class="car" viewBox="0 0 200 78" aria-hidden="true"><use href="#car"/></svg>`;
const ext = `target="_blank" rel="noopener"`;

const tracking = () => {
  const t = cfg.tracking, out = [];
  if (t.googleSiteVerification) out.push(`<meta name="google-site-verification" content="${esc(t.googleSiteVerification)}">`);
  if (t.gtmId) {
    out.push(`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(t.gtmId)}');</script>`);
  } else if (t.ga4Id || t.googleAdsId) {
    const first = t.ga4Id || t.googleAdsId;
    out.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(first)}"></script>`);
    out.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());${[t.ga4Id, t.googleAdsId].filter(Boolean).map(id => `gtag('config','${esc(id)}');`).join("")}</script>`);
  }
  if (t.metaPixelId) {
    out.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(t.metaPixelId)}');fbq('track','PageView');</script>`);
  }
  return out.join("\n");
};
const conv = () => {
  const t = cfg.tracking, c = {};
  if (t.googleAdsId && t.googleAdsLeadLabel) c.generate_lead = `${t.googleAdsId}/${t.googleAdsLeadLabel}`;
  if (t.googleAdsId && t.googleAdsCallLabel) c.call_click = `${t.googleAdsId}/${t.googleAdsCallLabel}`;
  if (t.googleAdsId && t.googleAdsWhatsappLabel) c.whatsapp_click = `${t.googleAdsId}/${t.googleAdsWhatsappLabel}`;
  return c;
};

const business = () => {
  const a = cfg.address, b = {
    "@type": "LocalBusiness", "@id": ORIGIN + "/#business", name: cfg.name, url: ORIGIN + "/",
    description: `Taxi service in ${CITY}: one-way, round-trip, outstation and airport transfers.`,
    email: cfg.email, areaServed: [CITY, ...routes.map(r => r.to)],
    address: { "@type": "PostalAddress", addressLocality: a.locality, addressRegion: a.region, addressCountry: "IN" },
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" },
  };
  if (!placeholderPhone) b.telephone = cfg.phone.replace(/\s/g, "");
  if (a.street) b.address.streetAddress = a.street;
  if (a.postalCode) b.address.postalCode = a.postalCode;
  if (cfg.geo.lat && cfg.geo.lng) b.geo = { "@type": "GeoCoordinates", latitude: cfg.geo.lat, longitude: cfg.geo.lng };
  if (hasOg) b.image = ORIGIN + "/og.png";
  const same = Object.values(cfg.social).filter(Boolean);
  if (same.length) b.sameAs = same;
  return b;
};

const layout = ({ title, description, path, body, jsonld = [], route = "" }) => `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${ORIGIN}${path}">
<meta name="robots" content="${path === "/404.html" ? "noindex" : "index,follow,max-image-preview:large"}">
<meta name="theme-color" content="#16122A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${path}">
${hasOg ? `<meta property="og:image" content="${ORIGIN}/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${CSS}">
${tracking()}
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...j }).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
${cfg.tracking.gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(cfg.tracking.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ""}
${SPRITE}
<header class="site-head" id="top">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${esc(cfg.name)} home">
      <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
      <span><b>${esc(cfg.name)}</b><small>${esc(CITY)} · Taxi Service</small></span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/#services">Services</a><a href="/#routes">Routes</a><a href="/#fleet">Fleet</a><a href="#book">Book</a>
    </nav>
    <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="drawer">Menu</button>
  </div>
  <div class="drawer" id="drawer">
    <a href="/#services">Services</a><a href="/#routes">Routes</a><a href="/#fleet">Fleet</a><a href="#book">Book</a>
    <p class="quick">Quick contact</p>
    <p class="quick">${esc(cfg.phone)}</p>
    <p class="quick">${esc(cfg.email)}</p>
  </div>
</header>
<main>
${body}
</main>
<footer>
  <div class="wrap">
    <nav aria-label="Taxi routes">${routes.map(r => `<a href="/${r.slug}/">${esc(CITY)} to ${esc(r.to)} taxi</a>`).join("")}</nav>
    <span>© ${new Date().getFullYear()} <b>${esc(cfg.name)}</b>. All rights reserved.</span><span>${esc(cfg.address.display)} · ${esc(cfg.phone)}</span>
  </div>
</footer>
<div class="float">
  <a class="w" href="${L.wa}" ${ext} aria-label="Chat on WhatsApp">${icon("i-wa")}</a>
  <a class="c" href="${L.tel}" aria-label="Call ${esc(cfg.name)}">${icon("i-call")}</a>
</div>
<script>window.SITE=${JSON.stringify({ name: cfg.name, city: CITY, wa: digits(cfg.whatsapp), route, conv: conv() })}</script>
<script src="${JS}" defer></script>
</body>
</html>
`;

const bookSection = ({ to = "", heading = "Book a Ride", sub = "Fill in your trip and send it to us on WhatsApp. We reply with the fare and confirm your car." } = {}) => `
<section id="book">
  <div class="wrap">
    <div class="title"><h2>${esc(heading)}</h2><p>${esc(sub)}</p></div>
    <div class="book-grid">
      <aside class="hours">
        <h3>Booking Hours</h3>
        <p class="big">Open all day, every day</p>
        <p>Early-morning airport drop or a late-night return, tell us the time and a car will be there.</p>
        <ul>
          <li>${icon("i-call")}<a href="${L.tel}" style="color:inherit;text-decoration:none">${esc(cfg.phone)}</a></li>
          <li>${icon("i-wa")}<a href="${L.wa}" ${ext} style="color:inherit;text-decoration:none">${esc(cfg.whatsapp)}</a></li>
          <li>${icon("i-mail")}<a href="${L.mail}" style="color:inherit;text-decoration:none">${esc(cfg.email)}</a></li>
        </ul>
      </aside>
      <div class="card-form">
        <form id="bookForm" novalidate>
          <div class="f"><label for="f-name">Name</label><input id="f-name" name="name" placeholder="Your name" required autocomplete="name"></div>
          <div class="f"><label for="f-mobile">Mobile number</label><input id="f-mobile" name="mobile" type="tel" inputmode="tel" placeholder="10-digit mobile" required autocomplete="tel"></div>
          <div class="f"><label for="f-from">Pickup</label><input id="f-from" name="from" placeholder="${esc(CITY)}" value="${esc(CITY)}"></div>
          <div class="f"><label for="f-to">Drop</label><input id="f-to" name="to" placeholder="Where to?" value="${esc(to)}"></div>
          <div class="f"><label for="f-date">Travel date</label><input id="f-date" name="date" type="date"></div>
          <div class="f"><label for="f-time">Pickup time</label><input id="f-time" name="time" type="time"></div>
          <div class="f"><label for="f-trip">Trip type</label><select id="f-trip" name="trip">${cfg.trips.map(t => `<option>${esc(t)}</option>`).join("")}</select></div>
          <div class="f"><label for="f-cab">Car</label><select id="f-cab" name="cab">${cfg.cabs.map(c => `<option>${esc(c.name)}</option>`).join("")}</select></div>
          <div class="f full"><label for="f-msg">Message</label><textarea id="f-msg" name="msg" placeholder="Passengers, luggage, stops on the way"></textarea></div>
          <div class="f full"><button class="btn block" type="submit">Prepare my booking request</button></div>
          <div class="sendbox" id="sendbox" role="status">
            <p id="sendmsg"></p>
            <pre id="sendpre"></pre>
            <a class="btn wa" id="sendlink" href="${L.wa}" ${ext}>${icon("i-wa")}Send on WhatsApp</a>
          </div>
          <p class="form-note">Nothing is sent until you press Send in WhatsApp.</p>
        </form>
      </div>
    </div>
  </div>
</section>`;

/* ---------- home page ---------- */
const home = () => layout({
  title: `${cfg.name} | ${CITY} Taxi Service: One Way, Round Trip & Airport Cabs`,
  description: `${cfg.name} is a ${CITY} taxi service for one-way drops, round trips, outstation journeys and airport transfers. Clean cars, experienced drivers. Call or WhatsApp to book.`,
  path: "/",
  jsonld: [business(), { "@type": "WebSite", "@id": ORIGIN + "/#website", url: ORIGIN + "/", name: cfg.name }],
  body: `
<section class="hero" style="padding:0">
  <canvas id="road" aria-hidden="true"></canvas>
  <div class="hero-in">
    <span class="eyebrow">${esc(cfg.name)}</span>
    <h1>Every road,<br>an <em>easy</em> ride.</h1>
    <p>One-way drops, round trips, airport runs and outstation journeys from ${esc(CITY)}. Clean cars, drivers who know the highway, and fares agreed before you set off.</p>
    <div class="hero-cta">
      <a class="btn" href="#book">Book your ride</a>
      <a class="btn light" href="${L.wa}" ${ext}>${icon("i-wa")}WhatsApp us</a>
    </div>
  </div>
  <div class="wrap hero-foot"><span>${esc(CITY)}, ${esc(cfg.region)}</span><span>One way · Round trip · Outstation</span></div>
</section>

<section class="intro">
  <div class="wrap">
    <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
    <h2>${esc(cfg.name)}</h2>
    <p class="tagline">${esc(cfg.tagline)}</p>
    <p class="lede">From a quick ride across the city to a long highway run, we plan the trip around your timing and get you there rested. You sit back; we mind the road.</p>
    <div class="roundlinks">
      <a href="${L.wa}" ${ext} aria-label="WhatsApp">${icon("i-wa")}</a>
      <a href="${L.tel}" aria-label="Call">${icon("i-call")}</a>
      <a href="${L.mail}" aria-label="Email">${icon("i-mail")}</a>
    </div>
    <div class="contact-cards">
      <a class="ccard" href="${L.tel}">${icon("i-call")}<b>Call</b><span>${esc(cfg.phone)}</span></a>
      <a class="ccard" href="${L.wa}" ${ext}>${icon("i-wa")}<b>WhatsApp</b><span>${esc(cfg.whatsapp)}</span></a>
      <a class="ccard" href="${L.mail}">${icon("i-mail")}<b>Email</b><span>${esc(cfg.email)}</span></a>
    </div>
  </div>
</section>

<section id="services" style="padding-left:0;padding-right:0">
  <div class="wrap title"><h2>Our Services</h2><p>Pick the kind of trip. Tap Enquire and the booking form fills itself in.</p></div>
  <div class="rail-wrap">
    <div class="rail" id="svcRail">${cfg.services.map(s => `
      <article class="svc">
        <div class="svc-art"><span class="glow"></span><span class="badge">${icon(s.icon)}</span>${car}</div>
        <h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>
        <button class="btn ghost block" type="button" data-enq-trip="${esc(s.trip)}" data-enq-note="Enquiry: ${esc(s.name)}">Enquire</button>
      </article>`).join("")}
    </div>
    <div class="rail-nav"><button type="button" data-rail="svcRail" data-dir="-1" aria-label="Previous services">${icon("i-left")}</button><button type="button" data-rail="svcRail" data-dir="1" aria-label="More services">${icon("i-right")}</button></div>
  </div>
</section>

<section id="routes" style="padding-top:20px;padding-left:0;padding-right:0">
  <div class="wrap title"><h2>Taxi Routes</h2><p>Popular trips from ${esc(CITY)}. Going somewhere else? Ask and we will quote it.</p></div>
  <div class="rail-wrap">
    <div class="rail" id="routeRail">${routes.map(r => `
      <article class="route">
        <div class="route-head"><span class="pill">Popular taxi route</span><h3><a href="/${r.slug}/">${esc(CITY)} to ${esc(r.to)}</a></h3></div>
        <div class="leg"><div><small>Pickup city</small><b>${esc(CITY)}</b></div><i aria-hidden="true"></i><div><small>Drop city</small><b>${esc(r.to)}</b></div></div>
        <div class="route-body">
          <div class="lbl"><span>Choose your cab</span><span>About ${r.km} km</span></div>
          <ul class="cabs">${cfg.cabs.map(c => `<li>${esc(c.name)}</li>`).join("")}</ul>
          <button class="btn block" type="button" data-enq-to="${esc(r.to)}">Enquire</button>
          <a class="route-more" href="/${r.slug}/">${esc(CITY)} to ${esc(r.to)} taxi details</a>
        </div>
      </article>`).join("")}
    </div>
    <div class="rail-nav"><button type="button" data-rail="routeRail" data-dir="-1" aria-label="Previous routes">${icon("i-left")}</button><button type="button" data-rail="routeRail" data-dir="1" aria-label="More routes">${icon("i-right")}</button></div>
  </div>
</section>

<section id="fleet" style="padding-top:20px">
  <div class="wrap">
    <div class="title"><h2>Our Fleet</h2><p>Choose the car that fits your group and your luggage.</p></div>
    <div class="fleet-grid">${cfg.cabs.map(f => `
      <div class="fleet">${car}<b>${esc(f.name)}</b><span>${esc(f.seats)}</span><span>${esc(f.note)}</span><em>${esc(f.tag)}</em></div>`).join("")}
    </div>
  </div>
</section>

<section class="why">
  <div class="wrap">
    <div class="title"><h2>Why ride with Ambica</h2><p>What you can count on, every trip.</p></div>
    <div class="why-grid">
      <div>${icon("i-clock")}<b>On time</b><p>Your driver reaches the pickup point before the agreed time.</p></div>
      <div>${icon("i-rupee")}<b>Fare fixed first</b><p>You get the full fare before the trip starts. Tolls and extras are spelled out.</p></div>
      <div>${icon("i-spark")}<b>Clean cars</b><p>Every car is cleaned and checked before it leaves for your pickup.</p></div>
      <div>${icon("i-shield")}<b>Seasoned drivers</b><p>Drivers who know Gujarat and Maharashtra highways and drive them safely.</p></div>
    </div>
  </div>
</section>
${bookSection()}`,
});

/* ---------- one landing page per route (these are the ad landing pages) ---------- */
const routePage = r => {
  const name = `${CITY} to ${r.to}`;
  const cabNames = cfg.cabs.map(c => c.name);
  const faqs = [
    [`How far is ${r.to} from ${CITY} by road?`, `${r.to} is about ${r.km} km from ${CITY} by road. The drive usually takes ${r.hours}, depending on traffic and the stops you want to make.`],
    [`Can I book a one-way taxi from ${CITY} to ${r.to}?`, `Yes. With a one-way booking you pay for the drop only. If you are coming back, a round trip keeps the same car and driver with you.`],
    [`Which cars can I choose for ${name}?`, `You can pick from ${cabNames.slice(0, -1).join(", ")} or ${cabNames.at(-1)}, depending on how many people are travelling and how much luggage you have.`],
    [`How do I get the fare for ${name}?`, `Send us your travel date, pickup time and car choice on WhatsApp or call ${cfg.phone}. We confirm the full fare before the trip, and tell you up front what is included.`],
  ];
  return layout({
    title: `${name} Taxi | One Way & Round Trip Cab | ${cfg.name}`,
    description: `Book a ${name} taxi with ${cfg.name}. About ${r.km} km, ${r.hours}. ${cabNames.join(", ")}. One way or round trip. Call or WhatsApp for the fare.`,
    path: `/${r.slug}/`,
    route: name,
    jsonld: [
      business(),
      { "@type": "Service", name: `${name} taxi`, serviceType: "Taxi service", provider: { "@id": ORIGIN + "/#business" }, areaServed: [CITY, r.to], url: `${ORIGIN}/${r.slug}/`, description: r.blurb },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" }, { "@type": "ListItem", position: 2, name: `${name} taxi`, item: `${ORIGIN}/${r.slug}/` }] },
      { "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
    body: `
<section class="hero sub" style="padding:0">
  <canvas id="road" aria-hidden="true"></canvas>
  <div class="hero-in">
    <p class="crumbs"><a href="/">Home</a> / <a href="/#routes">Routes</a> / ${esc(name)}</p>
    <span class="eyebrow">${esc(cfg.name)}</span>
    <h1>${esc(CITY)} to <em>${esc(r.to)}</em> Taxi</h1>
    <p>${esc(r.blurb)} One way or round trip, with the fare confirmed before you travel.</p>
    <div class="hero-cta">
      <a class="btn" href="${L.tel}">${icon("i-call")}Call ${esc(cfg.phone)}</a>
      <a class="btn light" href="${L.wa}?text=${encodeURIComponent(`Hi, I need a taxi from ${name}. Please share the fare.`)}" ${ext}>${icon("i-wa")}WhatsApp for fare</a>
    </div>
  </div>
</section>

<section style="padding-bottom:30px">
  <div class="wrap">
    <div class="facts">
      <div><small>Distance</small><b>About ${r.km} km</b></div>
      <div><small>Travel time</small><b>${esc(r.hours)}</b></div>
      <div><small>Trip types</small><b>One way · Round trip</b></div>
      <div><small>Pickup</small><b>Any time, any day</b></div>
    </div>
  </div>
</section>

<section style="padding-top:30px">
  <div class="wrap">
    <div class="title"><h2>Cars for ${esc(name)}</h2><p>Pick a car and we will send you the fare for your date.</p></div>
    <div class="cabrows">${cfg.cabs.map(c => `
      <div class="cabrow">${car}<div><b>${esc(c.name)}</b><span>${esc(c.seats)} · ${esc(c.note)}</span></div>
        <div class="act"><span class="fare">${r.fares && r.fares[c.name] ? esc(r.fares[c.name]) : ""}</span> <button class="btn ghost" type="button" data-enq-to="${esc(r.to)}" data-enq-cab="${esc(c.name)}">Get fare</button></div>
      </div>`).join("")}
    </div>
  </div>
</section>
${bookSection({ to: r.to, heading: `Book your ${name} cab`, sub: "Fill in your trip and send it to us on WhatsApp. We reply with the fare and confirm your car." })}
<section style="padding-top:20px">
  <div class="wrap">
    <div class="title"><h2>${esc(name)}: common questions</h2></div>
    <div class="faq">${faqs.map(([q, a], i) => `
      <details${i === 0 ? " open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="title"><h2>More routes from ${esc(CITY)}</h2></div>
    <div class="others">${routes.filter(o => o.slug !== r.slug).map(o => `<a href="/${o.slug}/">${esc(CITY)} to ${esc(o.to)}<small>${o.km} km</small></a>`).join("")}</div>
  </div>
</section>`,
  });
};

const notFound = () => layout({
  title: `Page not found | ${cfg.name}`, description: "This page does not exist.", path: "/404.html",
  body: `<section class="notfound"><div><h1>Wrong turn.</h1><p>That page does not exist. Head back and pick your route.</p><a class="btn" href="/">Go to the home page</a><div id="book"></div></div></section>`,
});

/* ---------- write everything ---------- */
const put = (p, html) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
put("index.html", home());
routes.forEach(r => put(`${r.slug}/index.html`, routePage(r)));
put("404.html", notFound());
const today = new Date().toISOString().slice(0, 10);
put("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...routes.map(r => `/${r.slug}/`)].map(p => `  <url><loc>${ORIGIN}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
put("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

console.log(`Built ${routes.length + 1} pages into ${OUT}`);
warnings.forEach(w => console.log("  note: " + w));
