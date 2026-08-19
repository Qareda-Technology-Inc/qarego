import { STORE_LINKS, STORES_LIVE } from "./config";
import { RouteCanvas } from "./components/RouteCanvas";
import { StoreButtons } from "./components/StoreButtons";

const nav = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#riders", label: "Drive & earn" },
  { href: "#faq", label: "FAQ" },
];

const services = [
  {
    index: "01",
    title: "Ride",
    tag: "City mobility",
    body: "Request a trip in seconds. See your fare upfront, follow your rider on the map, and pay with cash or mobile money when you arrive.",
    points: ["Live GPS tracking", "Clear fares before you book", "Cash or MoMo checkout"],
    accent: "yellow",
  },
  {
    index: "02",
    title: "Food & shops",
    tag: "Local commerce",
    body: "Order from restaurants, grocery stores, and pharmacies near you. Merchants prep your order while a courier brings it to your door.",
    points: ["Food, grocery & pharmacy", "Kitchen-ready merchants", "Doorstep delivery tracking"],
    accent: "brand",
  },
  {
    index: "03",
    title: "Parcels",
    tag: "Send anything",
    body: "Need something collected and dropped across town? Book a courier, share pickup and drop-off, and track the package until it lands.",
    points: ["Same-day city sends", "Pickup & drop-off pins", "Trusted rider network"],
    accent: "blue",
  },
];

const steps = [
  {
    n: "1",
    title: "Download QareGO",
    body: "Install from the App Store or Google Play. Sign in with your phone number — no long forms.",
  },
  {
    n: "2",
    title: "Choose what you need",
    body: "Book a ride, order a meal, or send a parcel. One account covers every trip and delivery.",
  },
  {
    n: "3",
    title: "Track & pay",
    body: "Follow progress live on the map. Pay cash on delivery or with mobile money — your choice.",
  },
];

const riderPerks = [
  {
    title: "Flexible hours",
    body: "Go online when you’re ready. Accept rides, food runs, and parcel jobs from one app.",
  },
  {
    title: "Clear earnings",
    body: "See what you make per trip. Track wallet balance, cash sales, and cash-out to MoMo.",
  },
  {
    title: "Built-in navigation",
    body: "Open turn-by-turn maps for every pickup and drop-off so you spend less time searching.",
  },
];

const trust = [
  {
    title: "Live tracking",
    body: "Customers and riders share the same map view from accept to complete.",
  },
  {
    title: "Mobile money ready",
    body: "Hubtel-powered MoMo for rides and orders — plus cash when you prefer it.",
  },
  {
    title: "Local merchants",
    body: "Neighbourhood kitchens and stores manage menus and orders from the QareGO merchant portal.",
  },
  {
    title: "Made for Ghana",
    body: "Built around the roads, payments, and daily routines people actually use here.",
  },
];

const faqs = [
  {
    q: "Is QareGO available now?",
    a: "Yes — QareGO is launching for customers and riders on iOS and Android. Download the app to get started in supported areas.",
  },
  {
    q: "What can I do in the app?",
    a: "Book rides, order food or groceries, send parcels, track everything live, and pay with cash or mobile money.",
  },
  {
    q: "How do I become a rider?",
    a: "Download the app, switch to rider mode after onboarding, and complete the verification steps. Admins approve drivers before they go online.",
  },
  {
    q: "I’m a restaurant or shop owner — how do I join?",
    a: "Merchants use the QareGO merchant portal to manage menus, accept orders, and settle earnings. Contact Qaretech to get your store onboarded.",
  },
  {
    q: "Which phones are supported?",
    a: "Recent iPhones via the App Store and Android devices via Google Play (package com.qarego.client).",
  },
];

const ticker = [
  "Rides",
  "Food delivery",
  "Grocery",
  "Pharmacy",
  "Parcels",
  "Live maps",
  "Mobile money",
  "Cash pay",
  "Rider earnings",
  "Merchant kitchen",
];

export default function App() {
  return (
    <div className="site">
      <header className="hero">
        <div className="atmosphere" aria-hidden="true">
          <div className="atmosphere__grid" />
          <div className="atmosphere__orb atmosphere__orb--a" />
          <div className="atmosphere__orb atmosphere__orb--b" />
          <div className="atmosphere__orb atmosphere__orb--c" />
        </div>

        <div className="topbar">
          <a className="mark" href="#top" id="top">
            <span className="mark__badge">Q</span>
            QareGO
          </a>
          <nav className="topbar__nav" aria-label="Primary">
            {nav.map((item) => (
              <a key={item.href} className="topbar__link" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="topbar__cta" href="#download">
            Get the app
          </a>
        </div>

        <div className="hero__layout">
          <div className="hero__copy">
            <p className="launch-pill">
              <span className="launch-pill__dot" />
              Now launching in Ghana
            </p>
            <p className="brand-word">
              Qare<span>GO</span>
            </p>
            <h1 className="hero__headline">Move. Eat. Send.</h1>
            <p className="hero__lede">
              The all-in-one app for rides, food & shop deliveries, and parcels — with live tracking
              and mobile money built in.
            </p>
            <StoreButtons
              appStoreUrl={STORE_LINKS.appStore}
              playStoreUrl={STORE_LINKS.playStore}
            />
            <p className="store-note">
              {STORES_LIVE
                ? "Free to download on iOS and Android."
                : "App Store & Google Play listings going live with launch — tap through once published."}
            </p>
          </div>

          <div className="hero__visual" aria-hidden="true">
            <RouteCanvas />
            <div className="city-glow" />
            <div className="phone phone--primary">
              <div className="phone__notch" />
              <div className="phone__screen">
                <div className="phone__top">
                  <div className="phone__brand">QareGO</div>
                  <div className="phone__chip">Live tracking</div>
                </div>
                <div className="phone__map">
                  <svg className="phone__path" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M12 78 C28 60, 40 55, 52 42 S78 22, 88 18" />
                  </svg>
                  <span className="phone__pin phone__pin--a" />
                  <span className="phone__pin phone__pin--b" />
                  <div className="phone__eta">
                    <strong>6 min</strong>
                    <span>Rider arriving</span>
                  </div>
                </div>
                <div className="phone__sheet">
                  <div className="phone__row">
                    <span>Airport · Kotoka</span>
                    <strong>GH₵45</strong>
                  </div>
                  <div className="phone__row phone__row--muted">
                    <span>MoMo · MTN</span>
                    <span>Confirmed</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="phone phone--secondary">
              <div className="phone__notch" />
              <div className="phone__screen phone__screen--food">
                <div className="phone__brand">Kitchen</div>
                <div className="phone__order">
                  <strong>2× Jollof special</strong>
                  <span>Preparing · #4821</span>
                </div>
                <div className="phone__order">
                  <strong>Courier assigned</strong>
                  <span>ETA 18 min</span>
                </div>
                <div className="phone__chip">Food delivery</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[...ticker, ...ticker].map((item, i) => (
            <span key={`${item}-${i}`}>
              {item}
              <i />
            </span>
          ))}
        </div>
      </div>

      <section className="section" id="services" aria-labelledby="what-title">
        <p className="section__eyebrow">Services</p>
        <h2 className="section__title" id="what-title">
          Three ways QareGO moves with you
        </h2>
        <p className="section__lede">
          Whether you’re crossing Accra, craving something from a favourite kitchen, or sending a
          package across town — one app handles the trip.
        </p>

        <div className="service-panels">
          {services.map((item) => (
            <article className={`service-panel service-panel--${item.accent}`} key={item.index}>
              <div className="service-panel__meta">
                <span className="service-panel__index">{item.index}</span>
                <span className="service-panel__tag">{item.tag}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <ul>
                {item.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="band band--ink" id="how" aria-labelledby="how-title">
        <div className="band__inner">
          <p className="section__eyebrow section__eyebrow--light">How it works</p>
          <h2 className="section__title section__title--light" id="how-title">
            From download to doorstep
          </h2>
          <p className="section__lede section__lede--light">
            Designed to feel familiar on day one — short steps, clear status, and a map you can trust.
          </p>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step.n}>
                <span className="steps__n">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="riders" aria-labelledby="riders-title">
        <div className="split">
          <div>
            <p className="section__eyebrow">For riders</p>
            <h2 className="section__title" id="riders-title">
              Drive when you want. Earn what you see.
            </h2>
            <p className="section__lede">
              Riders take ride jobs, food pickups, and parcel runs in one place. Go online, accept
              offers, navigate with maps, and cash out earnings to mobile money.
            </p>
            <a className="text-link" href="#download">
              Download the rider app →
            </a>
          </div>
          <div className="perk-list">
            {riderPerks.map((perk) => (
              <div className="perk" key={perk.title}>
                <h3>{perk.title}</h3>
                <p>{perk.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="trust-title">
        <p className="section__eyebrow">Why QareGO</p>
        <h2 className="section__title" id="trust-title">
          Built for how Ghana actually moves
        </h2>
        <div className="trust-grid">
          {trust.map((item) => (
            <article className="trust-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="merchant-strip" aria-labelledby="merchant-title">
        <div className="merchant-strip__inner">
          <div>
            <p className="section__eyebrow">For stores</p>
            <h2 id="merchant-title">Merchants run the kitchen. We handle the road.</h2>
            <p>
              Restaurants, groceries, and pharmacies manage menus, accept orders, pause intake, and
              settle payouts through the QareGO merchant dashboard — while riders deliver.
            </p>
          </div>
          <ul className="merchant-strip__list">
            <li>Live order alerts</li>
            <li>Menu & category tools</li>
            <li>Multi-store owners supported</li>
            <li>MoMo settlement ready</li>
          </ul>
        </div>
      </section>

      <section className="section" id="faq" aria-labelledby="faq-title">
        <p className="section__eyebrow">FAQ</p>
        <h2 className="section__title" id="faq-title">
          Answers before you download
        </h2>
        <div className="faq">
          {faqs.map((item) => (
            <details className="faq__item" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="download" id="download" aria-labelledby="download-title">
        <div>
          <p className="download__eyebrow">Launching now</p>
          <h2 id="download-title">Get QareGO on your phone today</h2>
          <p>
            One free download for customers and riders. Book trips, order from local stores, send
            parcels, and pay your way — cash or MoMo.
          </p>
          <ul className="download__checks">
            <li>iOS App Store</li>
            <li>Google Play (Android)</li>
            <li>Same login across services</li>
          </ul>
        </div>
        <StoreButtons
          appStoreUrl={STORE_LINKS.appStore}
          playStoreUrl={STORE_LINKS.playStore}
          variant="onDark"
        />
      </section>

      <footer className="footer">
        <div className="footer__brand">
          <div className="mark">
            <span className="mark__badge">Q</span>
            QareGO
          </div>
          <p>Move. Eat. Send. — sponsored by Qaretech.</p>
        </div>
        <div className="footer__cols">
          <div>
            <strong>Product</strong>
            <a href="#services">Services</a>
            <a href="#how">How it works</a>
            <a href="#riders">Drive & earn</a>
            <a href="#download">Download</a>
          </div>
          <div>
            <strong>Company</strong>
            <span>Qaretech</span>
            <span>Ghana</span>
            <span>com.qarego.client</span>
          </div>
        </div>
        <p className="footer__copy">© {new Date().getFullYear()} QareGO. All rights reserved.</p>
      </footer>
    </div>
  );
}
