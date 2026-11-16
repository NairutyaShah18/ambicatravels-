/* Ambica Travels: page behaviour. Business details come from site.config.json at build time. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const digits = s => (s || "").replace(/\D/g, "");
  const S = window.SITE || {};

  /* ---- ad and analytics events (only fire if tags are configured) ---- */
  const track = (name, params = {}) => {
    try {
      if (window.dataLayer && !window.gtag) window.dataLayer.push({ event: name, ...params });
      if (window.gtag) {
        window.gtag("event", name, params);
        const conv = (S.conv || {})[name];
        if (conv) window.gtag("event", "conversion", { send_to: conv });
      }
      if (window.fbq) window.fbq("track", name === "generate_lead" ? "Lead" : "Contact", params);
    } catch (e) {}
  };
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    if (a.id === "sendlink") track("generate_lead", { method: "whatsapp_form", route: S.route || "" });
    else if (a.href.startsWith("tel:")) track("call_click", { route: S.route || "" });
    else if (a.href.includes("wa.me")) track("whatsapp_click", { route: S.route || "" });
  });

  /* ---- Enquire buttons pre-fill the booking form ---- */
  document.addEventListener("click", e => {
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
  const onScroll = () => head.classList.toggle("solid", scrollY > 40 || drawer.classList.contains("open"));
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setMenu = o => { drawer.classList.toggle("open", o); menuBtn.setAttribute("aria-expanded", o); menuBtn.textContent = o ? "Close" : "Menu"; onScroll(); };
  menuBtn.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
  drawer.addEventListener("click", e => { if (e.target.tagName === "A") setMenu(false); });

  /* ---- hero: night highway drawn on canvas (no video or photo to download) ---- */
  const c = $("#road");
  if (c) {
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
  }
})();
