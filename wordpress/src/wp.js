/* Ambica Travels (WordPress): page behaviour. Business details come from Settings → Ambica Travels via window.SITE. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const digits = s => (s || "").replace(/\D/g, "");
  const S = window.SITE || {};

  /* ---- ad and analytics events (only fire if tags are configured) ---- */
  /* Events go to the dataLayer, so whoever runs Google Tag Manager can turn them into Google Ads / Meta conversions. */
  const track = (name, params = {}) => {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
      if (window.fbq && !window.google_tag_manager) window.fbq("track", name === "generate_lead" ? "Lead" : "Contact", params);
    } catch (e) {}
  };
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    if (a.id === "sendlink") track("generate_lead", { method: "whatsapp_form", route: S.route || "" });
    else if (a.href.startsWith("tel:")) track("call_click", { route: S.route || "" });
    else if (a.href.includes("wa.me")) track("whatsapp_click", { route: S.route || "" });
  });

  /* ---- Enquire buttons pre-fill the booking form ----
     Shortcode buttons carry data-enq-*; Elementor buttons use a link like  #enquire?trip=Round trip&note=Round Trip  */
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href*="#enquire"]');
    if (a) {
      e.preventDefault();
      const q = new URLSearchParams((a.getAttribute("href").split("#enquire")[1] || "").replace(/^\?/, ""));
      if (!$("#bookForm")) { location.href = "/#book"; return; }
      if (q.get("trip")) $("#f-trip").value = q.get("trip");
      if (q.get("to")) $("#f-to").value = q.get("to");
      if (q.get("note") && !$("#f-msg").value) $("#f-msg").value = "Enquiry: " + q.get("note");
      $("#book").scrollIntoView(); $("#f-name").focus({ preventScroll: true });
      return;
    }
    const b = e.target.closest("[data-enq-to],[data-enq-trip]");
    if (!b || !$("#bookForm")) return;
    if (b.dataset.enqTo) { $("#f-to").value = b.dataset.enqTo; $("#f-from").value = S.city || ""; }
    if (b.dataset.enqTrip) $("#f-trip").value = b.dataset.enqTrip;
    if (b.dataset.enqCab) $("#f-cab").value = b.dataset.enqCab;
    if (b.dataset.enqNote && !$("#f-msg").value) $("#f-msg").value = b.dataset.enqNote;
    $("#book").scrollIntoView();
    $("#f-name").focus({ preventScroll: true });
  });

  /* ---- booking form: builds a WhatsApp message the visitor sends themselves ---- */
  const form = $("#bookForm");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    const v = id => $("#f-" + id).value.trim();
    const box = $("#sendbox"), msg = $("#sendmsg"), pre = $("#sendpre"), link = $("#sendlink");
    box.classList.add("show");
    if (!v("name") || digits(v("mobile")).length < 10) {
      msg.textContent = "Please add your name and a 10-digit mobile number so we can call you back.";
      pre.style.display = link.style.display = "none";
      (v("name") ? $("#f-mobile") : $("#f-name")).focus();
      return;
    }
    const lines = ["Booking request for " + (S.name || ""), "Name: " + v("name"), "Mobile: " + v("mobile"),
      "Trip: " + (v("from") || S.city) + " to " + (v("to") || "(to be decided)"), "Type: " + v("trip"), "Car: " + v("cab")];
    if (v("date")) lines.push("Date: " + v("date"));
    if (v("time")) lines.push("Pickup time: " + v("time"));
    if (v("msg")) lines.push("Note: " + v("msg"));
    const text = lines.join("\n");
    msg.textContent = "Your request is ready. Press the button to open WhatsApp and send it to us.";
    pre.textContent = text; pre.style.display = ""; link.style.display = "";
    link.href = "https://wa.me/" + S.wa + "?text=" + encodeURIComponent(text);
    track("booking_form_prepared", { route: S.route || "" });
  });

  /* ---- rails, header, drawer ---- */
  $$("[data-rail]").forEach(b => b.addEventListener("click", () => {
    const r = $("#" + b.dataset.rail);
    r.scrollBy({ left: b.dataset.dir * (r.firstElementChild.offsetWidth + 26), behavior: "smooth" });
  }));
  const head = $(".site-head"), drawer = $("#drawer"), menuBtn = $("#menuBtn");
  if (!head || !drawer || !menuBtn) return;
  const onScroll = () => head.classList.toggle("solid", scrollY > 40 || drawer.classList.contains("open"));
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setMenu = o => { drawer.classList.toggle("open", o); menuBtn.setAttribute("aria-expanded", o); menuBtn.textContent = o ? "Close" : "Menu"; onScroll(); };
  menuBtn.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
  drawer.addEventListener("click", e => { if (e.target.tagName === "A") setMenu(false); });


  /* ---- scroll motion: progress car, reveals, step line, hero drift ---- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prog = $("#prog"), copy = $(".amb-hero-copy"), stepsEl = $(".amb-steps");
  let fill = null;
  if (stepsEl) { /* dotted line behind the three steps, filled as you scroll */
    const line = document.createElement("div"); line.className = "steps-line"; line.setAttribute("aria-hidden", "true");
    fill = document.createElement("i"); line.append(fill); stepsEl.prepend(line);
  }
  if (!reduce) {
    document.documentElement.classList.add("js");
    const els = $$("[data-reveal]");
    els.forEach(el => { const sibs = [...el.parentElement.children].filter(c => c.hasAttribute("data-reveal")); el.style.setProperty("--d", (sibs.indexOf(el) % 6) * 0.09 + "s"); });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
      els.forEach(el => io.observe(el));
    } else els.forEach(el => el.classList.add("in"));
  }
  let tick = false;
  const onMove = () => {
    tick = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (prog) prog.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + "%";
    if (reduce) return;
    if (stepsEl && fill) { const r = stepsEl.getBoundingClientRect(); fill.style.setProperty("--p", Math.max(0, Math.min(1, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.25)))); }
    if (copy && scrollY < 900) { copy.style.transform = `translateY(${scrollY * 0.18}px)`; copy.style.opacity = Math.max(0, 1 - scrollY / 620); }
  };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(onMove); } }, { passive: true });
  addEventListener("resize", onMove); onMove();


  /* ---- routes rail: drifts on its own, pauses when touched or hovered, loops forever ---- */
  const rr = $("#routeRail");
  if (rr && !reduce) {
    const originals = [...rr.children];
    originals.forEach(k => { const c = k.cloneNode(true); c.setAttribute("aria-hidden", "true"); c.querySelectorAll("a,button").forEach(x => x.tabIndex = -1); rr.append(c); });
    const loop = () => rr.children[originals.length].offsetLeft - originals[0].offsetLeft;
    let paused = false, onScreen = false, timer, pos = 0, last = 0;
    const pause = () => { paused = true; clearTimeout(timer); };
    const resume = (ms = 2200) => { clearTimeout(timer); timer = setTimeout(() => { pos = rr.scrollLeft; paused = false; }, ms); };
    rr.addEventListener("pointerenter", pause); rr.addEventListener("pointerleave", () => resume(600));
    rr.addEventListener("touchstart", pause, { passive: true }); rr.addEventListener("touchend", () => resume(), { passive: true });
    rr.addEventListener("focusin", pause); rr.addEventListener("focusout", () => resume());
    $$('[data-rail="routeRail"]').forEach(b => b.addEventListener("click", () => { pause(); resume(3000); }));
    new IntersectionObserver(en => { onScreen = en[0].isIntersecting; }).observe(rr);
    const step = t => {
      const dt = Math.min(50, t - last); last = t;
      if (!paused && onScreen) { pos += dt * 0.045; const L = loop(); if (L > 0 && pos >= L) pos -= L; rr.scrollLeft = pos; }
      else if (rr.scrollLeft >= loop() && loop() > 0) rr.scrollLeft -= loop();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---- hero fare card: one WhatsApp message with the trip in it ---- */
  const quick = $("#quick");
  if (quick) {
    const send = $("#q-send");
    const build = () => {
      const to = $("#q-to").value, d = $("#q-date").value;
      const text = `Hi ${S.name}, please share the fare.\nTrip: ${S.city} to ${to || "(I will tell you)"}\nCar: ${$("#q-cab").value}` + (d ? `\nDate: ${d}` : "");
      send.href = "https://wa.me/" + S.wa + "?text=" + encodeURIComponent(text);
    };
    quick.addEventListener("input", build); quick.addEventListener("submit", e => e.preventDefault()); build();
  }

  /* ---- hero: night highway drawn on canvas behind any container with the class amb-hero ---- */
  $$(".amb-hero").forEach(hero => {
    if (hero.querySelector(":scope > canvas.road")) return;
    const c = document.createElement("canvas"); c.className = "road"; c.setAttribute("aria-hidden", "true"); hero.prepend(c);
    const x = c.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, visible = true, running = false;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = c.clientWidth; h = c.clientHeight; c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); };
    const draw = t => {
      const vx = w / 2, vy = h * 0.44, T = t / 1000;
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0C0919"); g.addColorStop(.44, "#231A45"); g.addColorStop(.45, "#15102A"); g.addColorStop(1, "#08060F");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const halo = x.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * .5);
      halo.addColorStop(0, "rgba(246,178,60,.55)"); halo.addColorStop(.18, "rgba(226,98,14,.28)"); halo.addColorStop(1, "rgba(226,98,14,0)");
      x.fillStyle = halo; x.fillRect(0, 0, w, h);
      const spread = Math.max(w * .9, 700);
      x.fillStyle = "#0E0B1C"; x.beginPath(); x.moveTo(vx, vy); x.lineTo(vx - spread, h); x.lineTo(vx + spread, h); x.closePath(); x.fill();
      const N = 16;
      for (let i = 0; i < N; i++) {
        const p = ((i / N) + T * .22) % 1, z = Math.pow(p, 2.6), y = vy + (h - vy) * z;
        x.fillStyle = `rgba(255,255,255,${.15 + z * .75})`;
        const dw = 2 + z * 12, dl = 4 + z * 70; x.fillRect(vx - dw / 2, y, dw, dl);
        x.fillStyle = `rgba(246,178,60,${.2 + z * .8})`;
        const ex = spread * z * .98, r = 1 + z * 5;
        x.beginPath(); x.arc(vx - ex, y, r, 0, 7); x.arc(vx + ex, y, r, 0, 7); x.fill();
        const ly = vy - (h * .5) * z, lx = (w * .62) * z, lr = 1.5 + z * 16;
        for (const s of [-1, 1]) {
          const gl = x.createRadialGradient(vx + s * lx, ly, 0, vx + s * lx, ly, lr * 3);
          gl.addColorStop(0, `rgba(255,236,200,${.25 + z * .7})`); gl.addColorStop(.3, `rgba(246,150,50,${z * .5})`); gl.addColorStop(1, "rgba(246,150,50,0)");
          x.fillStyle = gl; x.beginPath(); x.arc(vx + s * lx, ly, lr * 3, 0, 7); x.fill();
        }
      }
      if (!still && visible) requestAnimationFrame(draw); else running = false;
    };
    const start = () => { if (!running && !still) { running = true; requestAnimationFrame(draw); } };
    size(); draw(900);
    addEventListener("resize", () => { size(); if (still || !visible) draw(900); });
    /* stop animating once the hero is scrolled away, to save battery */
    if ("IntersectionObserver" in window) new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible) start(); }).observe(c);
    start();
  });
})();
