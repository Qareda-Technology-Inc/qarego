import { STORE_LINKS, STORES_LIVE } from "./config";
import { StoreButtons } from "./components/StoreButtons";
import { Icon, type IconName } from "./components/Icons";

const nav = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#safety", label: "Safety" },
  { href: "#riders", label: "Riders" },
  { href: "#stores", label: "Stores" },
  { href: "#faq", label: "FAQ" },
];

const services: { icon: IconName; title: string; body: string; tone: string }[] = [
  {
    icon: "ride",
    title: "Rides",
    body: "Motorcycle, pragya or car. See the fare before you book and follow your rider to your door.",
    tone: "navy",
  },
  {
    icon: "food",
    title: "Food",
    body: "Order from kitchens near you. Track it from the stove to your gate.",
    tone: "orange",
  },
  {
    icon: "grocery",
    title: "Groceries",
    body: "Daily essentials from local shops, picked and delivered the same day.",
    tone: "green",
  },
  {
    icon: "pharmacy",
    title: "Pharmacy",
    body: "Medicines from nearby pharmacies. Upload a prescription when an item needs one.",
    tone: "red",
  },
  {
    icon: "parcel",
    title: "Parcels",
    body: "Send a package across town, or have one collected and brought to you.",
    tone: "violet",
  },
  {
    icon: "gas",
    title: "Cooking gas",
    body: "We collect your empty cylinder, fill it and bring it back, or swap it for a full one.",
    tone: "amber",
  },
];

const steps = [
  {
    n: "01",
    title: "Pick what you need",
    body: "A ride, a meal, groceries, medicine, a parcel or gas: it's all on one home screen.",
    shot: "/screens/home.jpg",
    alt: "QareGO home screen with Food, Ride, Parcel, Grocery, Pharmacy and Cooking gas",
  },
  {
    n: "02",
    title: "See the price first",
    body: "Your route and the fare for each option are shown before you confirm. Pay cash on delivery.",
    shot: "/screens/ride.jpg",
    alt: "Choose a ride screen showing the route and fares for motorcycle, pragya and car",
  },
  {
    n: "03",
    title: "Track it, then share your code",
    body: "Follow your rider live. Give them your 4-digit code only when they're with you.",
    shot: "/screens/track.jpg",
    alt: "Live trip screen: rider heading to you, with the pickup code to share",
  },
];

const safety: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "code",
    title: "Codes only you hold",
    body: "Every pickup and delivery is confirmed with a 4-digit code on your phone. Riders never receive it, so nothing is marked done without you.",
  },
  {
    icon: "eye",
    title: "Your number stays private",
    body: "Riders who are offered your trip see your first name and the route. Only the rider who accepts gets your number.",
  },
  {
    icon: "pharmacy",
    title: "Prescriptions stay with the pharmacy",
    body: "Your prescription goes only to the pharmacy filling it. The rider just sees how many items to carry.",
  },
  {
    icon: "pin",
    title: "Live tracking",
    body: "You and your rider see the same map from pickup to drop-off.",
  },
  {
    icon: "cash",
    title: "Pay on delivery",
    body: "Pay in cash when your trip ends or your order arrives. Mobile money is coming soon.",
  },
  {
    icon: "signal",
    title: "Made for real networks",
    body: "Lose signal mid-order and you won't be charged twice. You stay signed in, and the app reconnects by itself.",
  },
];

const riderPerks: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "wallet",
    title: "See what you'll earn",
    body: "Every offer shows your take-home pay, the distance to pickup and your rate per km before you accept.",
  },
  {
    icon: "route",
    title: "One app, every job",
    body: "Rides, food runs, parcels and gas deliveries. Choose the work you want in Work mode.",
  },
  {
    icon: "clock",
    title: "Paid if a store cancels",
    body: "If a store cancels after you've set off, you're paid for the trip: half the fee, or all of it once you've arrived.",
  },
];

const storePerks = [
  "New orders arrive instantly, with an alert",
  "Menus, categories, photos and opening hours",
  "Prescriptions shown with pharmacy orders",
  "Sales, earnings and your balance with QareGO",
  "Run several stores from one login",
];

const faqs = [
  {
    q: "Where is QareGO available?",
    a: "QareGO is launching in Ghana. Open the app to see the services available where you are.",
  },
  {
    q: "How do I pay?",
    a: "Pay in cash: to your rider at the end of a trip, or when your order arrives. Mobile money is coming soon.",
  },
  {
    q: "Why does the app give me a code?",
    a: "The code proves your rider is actually with you. Share it only when they arrive to pick you up or hand over your order. Riders never receive it.",
  },
  {
    q: "What if my signal drops while I'm ordering?",
    a: "You stay signed in, and the app reconnects by itself. If an order didn't go through, try again: it won't be placed twice.",
  },
  {
    q: "How do I become a rider?",
    a: "Download QareGO, choose rider when you sign up and add your vehicle details. Our team approves riders before they can go on duty.",
  },
  {
    q: "I run a restaurant, shop, pharmacy or gas station. How do I join?",
    a: "Contact us using the details below. We'll set up your store on the QareGO merchant portal, where you'll manage your menu and orders.",
  },
  {
    q: "How do I delete my account?",
    a: "In the app, go to Account → Delete Account. You can also follow the steps on our delete-account page.",
  },
];

function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <figure className={`phone ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" width={405} height={900} />
    </figure>
  );
}

export default function App() {
  return (
    <div className="site">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#top" aria-label="QareGO home">
            <img src="/qarego-mark.png" alt="" width={36} height={36} />
            <span>QareGO</span>
          </a>
          <nav className="topbar__nav" aria-label="Primary">
            {nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <a className="btn btn--small" href="#download">
            Get the app
          </a>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="pill">
                <span className="pill__dot" /> Now launching in Ghana
              </p>
              <h1>
                Rides, deliveries and parcels.
                <span> One app.</span>
              </h1>
              <p className="hero__lede">
                Book a ride, order food, groceries or medicine, send a parcel or refill your
                cooking gas. Track every trip live and pay on delivery.
              </p>
              <StoreButtons appStoreUrl={STORE_LINKS.appStore} playStoreUrl={STORE_LINKS.playStore} />
              <p className="hero__note">
                {STORES_LIVE
                  ? "Free on iPhone and Android."
                  : "Free on iPhone and Android: listings go live at launch."}
              </p>
              <ul className="hero__points">
                <li>
                  <Icon name="check" /> Fares before you book
                </li>
                <li>
                  <Icon name="check" /> Live tracking
                </li>
                <li>
                  <Icon name="check" /> Cash on delivery
                </li>
              </ul>
            </div>

            <div className="hero__visual" aria-hidden="false">
              <div className="hero__glow" aria-hidden="true" />
              <Phone
                src="/screens/track.jpg"
                alt="Live trip: your rider is on the way, with the pickup code to share"
                className="phone--back"
              />
              <Phone
                src="/screens/ride.jpg"
                alt="Choose a ride: route on the map and fares for motorcycle, pragya and car"
                className="phone--front"
              />
              <div className="floating-card" aria-hidden="true">
                <Icon name="code" />
                <div>
                  <strong>Pickup code 7351</strong>
                  <span>Share it when your rider arrives</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="services" aria-labelledby="services-title">
          <div className="section__head">
            <p className="eyebrow">Services</p>
            <h2 id="services-title">Everything you need, delivered</h2>
            <p className="section__lede">Six services in one app, one account and one way to track them.</p>
          </div>
          <div className="services">
            {services.map((s) => (
              <article className={`service service--${s.tone}`} key={s.title}>
                <span className="service__icon">
                  <Icon name={s.icon} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section--tint" id="how" aria-labelledby="how-title">
          <div className="section__head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">From tap to doorstep in three steps</h2>
          </div>
          <ol className="steps">
            {steps.map((step) => (
              <li className="step" key={step.n}>
                <Phone src={step.shot} alt={step.alt} />
                <div className="step__text">
                  <span className="step__n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section section--dark" id="safety" aria-labelledby="safety-title">
          <div className="section__head">
            <p className="eyebrow eyebrow--light">Safe by design</p>
            <h2 id="safety-title">Built so the right person gets the right thing</h2>
            <p className="section__lede">
              Safety isn't a feature we bolted on. It's how every trip and order works.
            </p>
          </div>
          <div className="safety">
            {safety.map((item) => (
              <article className="safety__item" key={item.title}>
                <span className="safety__icon">
                  <Icon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="riders" aria-labelledby="riders-title">
          <div className="split">
            <div className="split__copy">
              <p className="eyebrow">For riders</p>
              <h2 id="riders-title">Ride with QareGO. Know your pay before you go.</h2>
              <p className="section__lede">
                Go on duty when it suits you, accept the offers you want, and keep track of every
                cedi you earn.
              </p>
              <ul className="perks">
                {riderPerks.map((p) => (
                  <li key={p.title}>
                    <span className="perks__icon">
                      <Icon name={p.icon} />
                    </span>
                    <div>
                      <h3>{p.title}</h3>
                      <p>{p.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <a className="btn btn--outline" href="#download">
                Download and sign up as a rider <Icon name="arrow" />
              </a>
            </div>
            <div className="split__visual split__visual--pair" aria-hidden="false">
              <Phone
                src="/screens/offer.jpg"
                alt="Rider offer card: you receive GH₵26.26, pickup Oxford Street, Osu, drop-off Kotoka International"
                className="phone--tilt-left"
              />
              <Phone
                src="/screens/rider_trip.jpg"
                alt="Rider trip screen: step 1 of 3, go to pickup"
                className="phone--tilt-right"
              />
            </div>
          </div>
        </section>

        <section className="section section--tint" id="stores" aria-labelledby="stores-title">
          <div className="split split--reverse">
            <div className="split__visual">
              <Phone src="/screens/gas.jpg" alt="Cooking gas: refill or swap, choose a cylinder size" />
            </div>
            <div className="split__copy">
              <p className="eyebrow">For stores</p>
              <h2 id="stores-title">You run the counter. We handle the road.</h2>
              <p className="section__lede">
                Restaurants, grocery shops, pharmacies and gas stations reach nearby customers, and
                QareGO riders deliver. Everything runs from the QareGO merchant portal.
              </p>
              <ul className="checks">
                {storePerks.map((p) => (
                  <li key={p}>
                    <Icon name="check" /> {p}
                  </li>
                ))}
              </ul>
              <a className="btn btn--outline" href="mailto:support@qaretech.com?subject=Join%20QareGO%20as%20a%20store">
                List your store <Icon name="arrow" />
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="faq" aria-labelledby="faq-title">
          <div className="section__head">
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-title">Questions, answered</h2>
          </div>
          <div className="faq">
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="download" id="download" aria-labelledby="download-title">
          <div className="download__inner">
            <div>
              <h2 id="download-title">Get QareGO</h2>
              <p>One free app for customers and riders, on iPhone and Android.</p>
              <StoreButtons
                appStoreUrl={STORE_LINKS.appStore}
                playStoreUrl={STORE_LINKS.playStore}
                variant="onDark"
              />
            </div>
            <Phone src="/screens/role.jpg" alt="QareGO sign-in screen" className="phone--small" />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <a className="brand" href="#top">
              <img src="/qarego-mark.png" alt="" width={36} height={36} />
              <span>QareGO</span>
            </a>
            <p>Rides, food & parcels across Ghana. Operated by Qaretech.</p>
          </div>
          <div className="footer__cols">
            <div>
              <strong>QareGO</strong>
              <a href="#services">Services</a>
              <a href="#how">How it works</a>
              <a href="#safety">Safety</a>
              <a href="#download">Download</a>
            </div>
            <div>
              <strong>Work with us</strong>
              <a href="#riders">Ride with QareGO</a>
              <a href="#stores">List your store</a>
            </div>
            <div>
              <strong>Help & legal</strong>
              <a href="mailto:support@qaretech.com">support@qaretech.com</a>
              <a href="tel:+233501774210">+233 50 177 4210</a>
              <a href="/privacy">Privacy policy</a>
              <a href="/delete-account">Delete your account</a>
            </div>
          </div>
        </div>
        <p className="footer__copy">© {new Date().getFullYear()} QareGO · Qaretech, Ghana</p>
      </footer>
    </div>
  );
}
