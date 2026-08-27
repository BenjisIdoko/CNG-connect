/* ═══════════════════════════════════════════════════════════════════
   Pi-CNG & EV  |  shared.js
   Nav + Footer injection, animations, newsletter, testimonials
   ═══════════════════════════════════════════════════════════════════ */

/* All site forms (footer newsletter, mailing-list forms, contact form) post here */
var FORM_ENDPOINT = 'https://formspree.io/f/xgoglbel';

/* ── NAV HTML ────────────────────────────────────────────────────── */
var NAV_HTML = `
<nav class="site-nav" id="site-nav">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo" aria-label="Pi-CNG & EV Home">
      <img src="images/picng-logo-dark.png" alt="Pi-CNG & EV" class="logo-light"/>
      <img src="images/picng-logo.png" alt="Pi-CNG & EV" class="logo-dark"/>
    </a>
    <div class="nav-links" role="navigation">
      <a href="index.html" data-page-link="home">Home</a>
      <div class="nav-drop-wrap">
        <a href="about.html" data-page-link="about">About ▾</a>
        <div class="nav-drop">
          <a href="about.html" data-page-link="about">About Pi-CNG &amp; EV</a>
          <!-- <a href="team.html" data-page-link="team">Our Team</a> -->
          <a href="partners.html" data-page-link="partners">Partners</a>
          <a href="esg.html" data-page-link="esg">ESG</a>
          <a href="gallery.html" data-page-link="gallery">Photo Gallery</a>
        </div>
      </div>
      <div class="nav-drop-wrap">
        <a href="programmes.html" data-page-link="programmes">Programmes ▾</a>
        <div class="nav-drop">
          <a href="programmes.html#cng-conversion">CNG Conversion Programme</a>
          <a href="programmes.html#ev">Electric Mobility</a>
          <a href="programmes.html#infrastructure">Refuelling Infrastructure</a>
          <a href="programmes.html#ngvms">NGVMS</a>
          <a href="programmes.html#training">Technician Training</a>
          <a href="programmes.html#mass-transit">Mass Transit Scheme</a>
          <a href="conversion-centers.html" data-page-link="centers" style="border-top:2px solid var(--offwhite2);">Find Conversion Centres</a>
          <a href="refuelling-stations.html" data-page-link="refuelling-stations">Refuelling Stations</a>
          <a href="network-map.html" data-page-link="network-map">National Network Map</a>
          <a href="contact.html" data-page-link="contact" style="border-top:1px solid var(--offwhite2);">Partner With Us</a>
        </div>
      </div>
      <a href="impact.html" data-page-link="impact">Impact</a>
      <a href="invest-in-cng.html" data-page-link="invest">Opportunities</a>
      <div class="nav-drop-wrap">
        <a href="news.html" data-page-link="news">News &amp; Media ▾</a>
        <div class="nav-drop">
          <a href="news.html">All News &amp; Media</a>
          <a href="press-releases.html" data-page-link="press-releases">Press Releases</a>
          <a href="faq.html" data-page-link="faq">FAQs</a>
        </div>
      </div>
      <a href="contact.html" data-page-link="contact">Contact</a>
    </div>
    <div class="nav-cta">
      <a href="conversion-centers.html" class="btn btn-electric btn-arrow">Find Conversion Centres</a>
    </div>
    <button class="nav-burger" onclick="window.toggleMenu()" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<!-- Mobile Overlay -->
<div class="nav-overlay" id="nav-overlay" role="dialog" aria-modal="true">
  <button onclick="window.toggleMenu()" style="position:absolute;top:24px;right:24px;background:rgba(255,255,255,0.1);border:none;color:white;width:44px;height:44px;border-radius:50%;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;" aria-label="Close menu">✕</button>
  <a href="index.html" onclick="window.toggleMenu()">Home</a>
  <a href="about.html" onclick="window.toggleMenu()">About</a>
  <!-- <a href="team.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Our Team</a> -->
  <a href="partners.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Partners</a>
  <a href="esg.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ ESG</a>
  <a href="gallery.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Photo Gallery</a>
  <a href="programmes.html" onclick="window.toggleMenu()">Programmes</a>
  <a href="conversion-centers.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Find Conversion Centres</a>
  <a href="refuelling-stations.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Refuelling Stations</a>
  <a href="network-map.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ National Network Map</a>
  <a href="contact.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Partner With Us</a>
  <a href="impact.html" onclick="window.toggleMenu()">Impact</a>
  <a href="invest-in-cng.html" onclick="window.toggleMenu()">Opportunities</a>
  <a href="news.html" onclick="window.toggleMenu()">News &amp; Media</a>
  <a href="press-releases.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ Press Releases</a>
  <a href="faq.html" onclick="window.toggleMenu()" style="font-size:0.9rem;padding-left:28px;opacity:0.75;">↳ FAQs</a>
  <a href="contact.html" onclick="window.toggleMenu()">Contact</a>
  <a href="conversion-centers.html" class="btn btn-electric" style="margin-top:32px;" onclick="window.toggleMenu()">Find Conversion Centres →</a>
</div>
`;

/* ── FOOTER HTML ─────────────────────────────────────────────────── */
var FOOTER_HTML = `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">

      <!-- Brand -->
      <div class="footer-brand">
        <img src="images/picng-logo.png" alt="Pi-CNG & EV"/>
        <p class="footer-tagline">Presidential Initiative on Compressed Natural Gas and Electric Vehicles, driving Nigeria's clean energy transport transition under President Tinubu's Renewed Hope Agenda.</p>
        <div class="footer-social">
          <a href="https://twitter.com/PiCNG_EV" target="_blank" rel="noopener" aria-label="Twitter/X — @PiCNG_EV">
            <svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M4 4l16 16M4 20L20 4" stroke-linecap="round"/></svg>
          </a>
          <a href="https://www.facebook.com/profile.php?id=ThePiCNGEV" target="_blank" rel="noopener" aria-label="Facebook — The Presidential Initiative on CNG &amp; EV">
            <svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
          <a href="https://www.linkedin.com/company/presidential-initiative-on-cng-ev" target="_blank" rel="noopener" aria-label="LinkedIn — The Presidential Initiative on CNG &amp; EV">
            <svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="https://www.instagram.com/officialpicng_ev" target="_blank" rel="noopener" aria-label="Instagram — @officialpicng_ev">
            <svg viewBox="0 0 24 24" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
          <a href="https://www.youtube.com/@thepresidentialinitiativecng" target="_blank" rel="noopener" aria-label="YouTube — The Presidential Initiative on CNG &amp; EV">
            <svg viewBox="0 0 24 24" stroke-width="1.8"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
          </a>
          <a href="https://www.tiktok.com/@officialpicng_ev" target="_blank" rel="noopener" aria-label="TikTok — @officialpicng_ev">
            <svg viewBox="0 0 24 24" stroke-width="1.8" fill="none"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>

      <!-- Quick Links -->
      <div>
        <p class="footer-col-title">Quick Links</p>
        <ul class="footer-links">
          <li><a href="index.html">Home</a></li>
          <li><a href="about.html">About Pi-CNG &amp; EV</a></li>
          <!-- <li><a href="team.html">Our Team</a></li> -->
          <!-- <li><a href="partners.html">Partners</a></li> -->
          <li><a href="esg.html">ESG</a></li>
          <li><a href="gallery.html">Photo Gallery</a></li>
          <li><a href="programmes.html">Our Programmes</a></li>
          <li><a href="impact.html">Impact &amp; Results</a></li>
          <li><a href="conversion-centers.html">Conversion Centres</a></li>
          <li><a href="refuelling-stations.html">Refuelling Stations</a></li>
          <li><a href="network-map.html">National Network Map</a></li>
          <li><a href="news.html">News &amp; Media</a></li>
          <li><a href="faq.html">FAQs</a></li>
          <li><a href="contact.html">Contact Us</a></li>
        </ul>
      </div>

      <!-- Programmes -->
      <div>
        <p class="footer-col-title">Programmes</p>
        <ul class="footer-links">
          <li><a href="programmes.html#cng-conversion">CNG Conversion</a></li>
          <li><a href="programmes.html#ev">Electric Mobility (EV)</a></li>
          <li><a href="programmes.html#infrastructure">Refuelling Network</a></li>
          <li><a href="programmes.html#ngvms">NGVMS</a></li>
          <li><a href="programmes.html#training">Technician Training</a></li>
          <li><a href="programmes.html#mass-transit">Mass Transit Scheme</a></li>
        </ul>
      </div>

      <!-- Newsletter -->
      <div>
        <p class="footer-col-title">Stay Updated</p>
        <p style="font-size:0.85rem;color:rgba(255,255,255,0.45);margin-bottom:16px;line-height:1.6;">Get the latest news on Nigeria's clean energy transition.</p>
        <form action="https://formspree.io/f/xgoglbel" method="POST" id="footer-nl-form" onsubmit="footerNLSubmit(event)">
          <div class="footer-nl-input">
            <input type="email" name="email" placeholder="Your email address" id="footer-nl-email" required/>
            <button type="submit">Subscribe</button>
          </div>
        </form>
        <p id="footer-nl-msg" style="font-size:0.78rem;color:#00e676;margin-top:10px;display:none;">✓ You're subscribed! Thank you.</p>
        <p style="font-size:0.75rem;color:rgba(255,255,255,0.25);margin-top:14px;line-height:1.5;">Office of the Special Adviser to the President on Policy &amp; Coordination (CRDCU)</p>
      </div>
    </div>

    <div class="footer-bottom">
      <p class="footer-copy">© ${new Date().getFullYear()} Presidential Initiative on CNG &amp; EV. All rights reserved.</p>
      <div class="footer-links-bottom">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Use</a>
        <a href="#">Accessibility</a>
      </div>
      <div class="footer-flag">
        <span>🇳🇬</span> Federal Republic of Nigeria
      </div>
    </div>
  </div>
</footer>
`;

/* ── INIT ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  // Inject nav + footer
  var navEl = document.getElementById('nav-placeholder');
  if (navEl) navEl.outerHTML = NAV_HTML;
  var footerEl = document.getElementById('footer-placeholder');
  if (footerEl) footerEl.outerHTML = FOOTER_HTML;

  // Mark active nav link
  var page = document.body.getAttribute('data-page') || '';
  document.querySelectorAll('[data-page-link]').forEach(function (a) {
    if (a.getAttribute('data-page-link') === page) a.classList.add('active');
  });

  // Scroll → nav class
  var nav = document.getElementById('site-nav');
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Hero word reveal
  heroWordReveal();

  // Hero particles
  initParticles();

  // Hero slider
  initHeroSlider();

  // Scroll reveals
  initReveal();

  // Counters
  initCounters();

  // Testimonials
  initTestimonials();

  // Newsletter forms
  initNewsletterForms();

  // Mailto fallback toast (in case no default mail app is configured)
  initMailtoFallback();
});

/* ── MOBILE MENU ────────────────────────────────────────────────── */
window.toggleMenu = function () {
  var ov = document.getElementById('nav-overlay');
  if (!ov) return;
  var isOpen = ov.classList.toggle('open');
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

/* ── FOOTER NEWSLETTER ───────────────────────────────────────────── */
window.footerNLSubmit = function (e) {
  e.preventDefault();
  var form  = document.getElementById('footer-nl-form');
  var input = document.getElementById('footer-nl-email');
  var msg   = document.getElementById('footer-nl-msg');
  if (!input || !input.value.includes('@')) return;
  var data  = new FormData(form);
  fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
    .then(function () {
      if (msg) msg.style.display = 'block';
      if (input) { input.value = ''; input.disabled = true; }
    })
    .catch(function () {
      if (msg) { msg.style.color = '#ff6b6b'; msg.textContent = 'Error — please try again.'; msg.style.display = 'block'; }
    });
};

/* ── HERO WORD REVEAL ────────────────────────────────────────────── */
function heroWordReveal() {
  var title = document.querySelector('.rc-htitle');
  if (!title) return;
  // Animate visible spans with stagger
  var spans = title.querySelectorAll('.word span');
  spans.forEach(function (span, i) {
    setTimeout(function () {
      span.classList.add('visible');
    }, 200 + i * 80);
  });
}

/* ── PARTICLES ───────────────────────────────────────────────────── */
function initParticles() {
  var container = document.querySelector('.rc-particles');
  if (!container) return;
  var count = 18;
  for (var i = 0; i < count; i++) {
    var p = document.createElement('div');
    p.className = 'rc-particle';
    var size = Math.random() * 4 + 2;
    p.style.cssText = [
      'width:' + size + 'px',
      'height:' + size + 'px',
      'left:' + (Math.random() * 100) + '%',
      'bottom:' + (Math.random() * 60) + '%',
      '--dur:' + (6 + Math.random() * 8) + 's',
      '--delay:' + (Math.random() * 6) + 's'
    ].join(';');
    container.appendChild(p);
  }
}

/* ── HERO SLIDER ─────────────────────────────────────────────────── */
var currentSlide = 0;
function initHeroSlider() {
  var slides = document.querySelectorAll('.rc-hslide');
  var dots   = document.querySelectorAll('.rc-hdot');
  if (!slides.length) return;
  function goTo(idx) {
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
    currentSlide = (idx + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
  }
  // Expose for dot clicks
  window.heroGoTo = goTo;
  setInterval(function () { goTo(currentSlide + 1); }, 7000);
}

/* ── SCROLL REVEAL ───────────────────────────────────────────────── */
function initReveal() {
  var els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!els.length) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { obs.observe(el); });
}

/* ── COUNTERS ────────────────────────────────────────────────────── */
function initCounters() {
  var els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        animateCount(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  els.forEach(function (el) { obs.observe(el); });
}
function animateCount(el) {
  var target   = parseFloat(el.getAttribute('data-count'));
  var decimals = el.getAttribute('data-decimals') ? parseInt(el.getAttribute('data-decimals')) : 0;
  var suffix   = el.getAttribute('data-suffix') || '';
  var duration = 2200;
  var start    = performance.now();
  function fmt(v) {
    return (decimals ? v.toFixed(decimals) : Math.floor(v).toLocaleString()) + suffix;
  }
  function step(now) {
    var elapsed  = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var ease     = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmt(target * ease);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(step);
}

/* ── TESTIMONIALS ────────────────────────────────────────────────── */
var testiIdx = 0;
function initTestimonials() {
  var track  = document.querySelector('.testi-track');
  var dots   = document.querySelectorAll('.testi-dot');
  var cards  = document.querySelectorAll('.testi-card');
  if (!track || !cards.length) return;
  function goTo(idx) {
    testiIdx = (idx + cards.length) % cards.length;
    var offset = cards[0].offsetWidth + 24; // card width + gap
    // Move by pairs on desktop
    var step = window.innerWidth > 768 ? Math.floor(testiIdx / 2) : testiIdx;
    track.style.transform = 'translateX(-' + (step * offset) + 'px)';
    dots.forEach(function (d, i) { d.classList.toggle('active', i === testiIdx); });
  }
  window.testiPrev = function () { goTo(testiIdx - 1); };
  window.testiNext = function () { goTo(testiIdx + 1); };
  window.testiGoTo = goTo;
  // Auto-advance
  setInterval(function () { goTo(testiIdx + 1); }, 6000);
  // Initialise first dot
  if (dots[0]) dots[0].classList.add('active');
}

/* ── NEWSLETTER FORM (main page) ─────────────────────────────────── */
function initNewsletterForms() {
  var form = document.getElementById('nl-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body    = document.getElementById('nl-body');
    var success = document.getElementById('nl-success');
    var submit  = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) {
        if (r.ok) {
          if (body) body.style.display = 'none';
          if (success) {
            success.style.display = 'block';
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          if (submit) submit.disabled = false;
          alert('There was a problem subscribing. Please try again.');
        }
      })
      .catch(function () {
        if (submit) submit.disabled = false;
        alert('Network error — please check your connection and try again.');
      });
  });
}

/* ── CONTACT FORM (Formspree) ─────────────────────────────────── */
window.handleContactSubmit = function (e) {
  e.preventDefault();
  var form    = e.target;
  var body    = document.getElementById('contact-form-body');
  var success = document.getElementById('contact-success');
  var submit  = form.querySelector('[type="submit"]');
  var optIn   = form.querySelector('[name="newsletter_optin"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }

  // If they ticked "subscribe me", fire a second, separate submission
  // straight to the mailing list — this is not part of the enquiry payload.
  if (optIn && optIn.checked) {
    var nlData = new FormData();
    nlData.append('first_name', (form.querySelector('[name="first_name"]') || {}).value || '');
    nlData.append('last_name', (form.querySelector('[name="last_name"]') || {}).value || '');
    nlData.append('email', (form.querySelector('[name="email"]') || {}).value || '');
    nlData.append('_subject', 'New newsletter subscriber (via Contact form)');
    fetch(FORM_ENDPOINT, { method: 'POST', body: nlData, headers: { 'Accept': 'application/json' } }).catch(function () {});
  }

  fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
    headers: { 'Accept': 'application/json' }
  })
    .then(function (r) {
      if (r.ok) {
        if (body) body.style.display = 'none';
        if (success) {
          success.style.display = 'block';
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        if (submit) { submit.disabled = false; submit.textContent = 'Send Message'; }
        alert('There was a problem sending your message. Please try again.');
      }
    })
    .catch(function () {
      if (submit) { submit.disabled = false; submit.textContent = 'Send Message'; }
      alert('Network error — please check your connection and try again.');
    });
};

/* ── MAILTO FALLBACK ──────────────────────────────────────────────
   mailto: links only work if the visitor's browser/OS has a default
   mail app configured — otherwise a click can silently do nothing.
   This copies the address to the clipboard and shows a toast so the
   click always gives visible feedback either way. ────────────────── */
function initMailtoFallback() {
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
    link.addEventListener('click', function () {
      var email = link.getAttribute('href').replace('mailto:', '').split('?')[0];
      if (navigator.clipboard && email) {
        navigator.clipboard.writeText(email).then(function () {
          showMailtoToast('Opening your email app — address copied: ' + email);
        }).catch(function () {
          showMailtoToast('Email us at ' + email);
        });
      } else {
        showMailtoToast('Email us at ' + email);
      }
    });
  });
}

var mailtoToastTimer = null;
function showMailtoToast(message) {
  var toast = document.getElementById('mailto-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mailto-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('open');
  clearTimeout(mailtoToastTimer);
  mailtoToastTimer = setTimeout(function () { toast.classList.remove('open'); }, 4000);
}
