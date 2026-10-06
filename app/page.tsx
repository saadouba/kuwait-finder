"use client";

import { useEffect, useMemo, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  Compass,
  ExternalLink,
  Globe2,
  Info,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import HeroSceneLoader from "@/app/components/HeroSceneLoader";

type EventItem = {
  title: string;
  date: string | null;
  location: string | null;
  description: string;
  category: string;
  source_url: string | null;
  isCurated: boolean;
};

type Place = {
  id?: number | string;
  name?: string;
  title?: string;
  description?: string;
  location_url?: string;
};

type Language = "en" | "ar";

const categories = ["All", "Family", "Culture", "Food", "Sports", "Entertainment", "Nature", "Shopping", "Other"];

const copy = {
  en: {
    brand: "Kuwait Finder",
    language: "العربية",
    eyebrow: "YOUR CITY, AFTER DARK",
    title: "The night is\nyours to discover.",
    subtitle: "Find the moments, places, and little adventures that make Kuwait feel electric.",
    searchPlaceholder: "What would you like to discover in Kuwait?",
    search: "Find your night",
    promptsLabel: "Start with",
    prompts: ["This weekend", "Family activities", "Free things to do"],
    results: "Your next plan",
    resultCount: (count: number) => `${count} ${count === 1 ? "discovery" : "discoveries"}`,
    curated: "KUWAIT FINDER SELECT",
    web: "COMMUNITY DISCOVERY",
    dateUnconfirmed: "Date not confirmed",
    noResults: "Nothing glowing on the map yet",
    noResultsHint: "Try a broader search or another category.",
    searchError: "We couldn’t complete that search. Please try again.",
    curatedNote: "Curated events aren’t available yet. Apply the events-table migration to enable them.",
    placesTitle: "Find your kind of place",
    placesSubtitle: "The local spots worth taking the long way for.",
    placesError: "Popular places are temporarily unavailable.",
    noPlaces: "Places will appear here once they are added.",
    map: "Open map",
    loading: "Searching across Kuwait…",
    source: "Explore details",
    emptyPrompt: "Search for an event, a mood, or a place to go.",
    privacy: "Search is handled securely. API keys stay on the server.",
    chipAll: "Everything",
    inputLabel: "Search events and places in Kuwait",
    curatedHeading: "Picked for Kuwait",
    webHeading: "More to discover",
    discoverKicker: "THE CITY IS YOURS",
    emptyKicker: "MAKE A PLAN",
    placesKicker: "OFF THE MAP",
    sceneCaption: "KUWAIT CITY · 29.3759° N",
    browse: "Scroll to explore",
  },
  ar: {
    brand: "دليل الكويت",
    language: "English",
    eyebrow: "مدينتك، بعد الغروب",
    title: "الليل لك،\nاكتشف حكاياته.",
    subtitle: "اكتشف لحظات وأماكن ومغامرات صغيرة تجعل الكويت تنبض بالحياة.",
    searchPlaceholder: "ما الذي ترغب في اكتشافه في الكويت؟",
    search: "اكتشف الآن",
    promptsLabel: "ابدأ بـ",
    prompts: ["فعاليات نهاية الأسبوع", "أنشطة عائلية", "أنشطة مجانية"],
    results: "خطتك القادمة",
    resultCount: (count: number) => `${count} اكتشافات`,
    curated: "اختيار دليل الكويت",
    web: "اكتشاف من الإنترنت",
    dateUnconfirmed: "التاريخ غير مؤكد",
    noResults: "لا توجد نتائج بعد",
    noResultsHint: "جرّب بحثاً أوسع أو فئة أخرى.",
    searchError: "تعذّر إكمال البحث. حاول مرة أخرى.",
    curatedNote: "الفعاليات المختارة غير متاحة بعد. طبّق ترحيل جدول الفعاليات لتفعيلها.",
    placesTitle: "أماكن على ذوقك",
    placesSubtitle: "وجهات محلية تستحق أن تسلك الطريق الأطول إليها.",
    placesError: "الأماكن الشائعة غير متاحة مؤقتاً.",
    noPlaces: "ستظهر الأماكن هنا عند إضافتها.",
    map: "افتح الخريطة",
    loading: "نبحث في أنحاء الكويت…",
    source: "اكتشف التفاصيل",
    emptyPrompt: "ابحث عن فعالية أو أجواء أو مكان تود زيارته.",
    privacy: "تتم معالجة البحث بأمان، وتبقى مفاتيح API على الخادم.",
    chipAll: "الكل",
    inputLabel: "ابحث عن فعاليات وأماكن في الكويت",
    curatedHeading: "اختيارات تناسبك",
    webHeading: "اكتشافات أخرى",
    discoverKicker: "المدينة لك",
    emptyKicker: "خطط لليلتك",
    placesKicker: "وجهات مخفية",
    sceneCaption: "مدينة الكويت · ٢٩٫٣٧٥٩° شمالاً",
    browse: "مرر لاكتشاف المزيد",
  },
} as const;

const categoryLabels: Record<string, string> = {
  All: "الكل",
  Family: "عائلي",
  Culture: "ثقافة",
  Food: "طعام",
  Sports: "رياضة",
  Entertainment: "ترفيه",
  Nature: "طبيعة",
  Shopping: "تسوق",
  Other: "أخرى",
};

function EventSkeleton() {
  return (
    <div className="event-skeleton glass-card" aria-hidden="true">
      <div className="skeleton-line skeleton-kicker" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-short" />
      <div className="skeleton-footer"><span /><span /></div>
    </div>
  );
}

function tiltCard(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  event.currentTarget.style.setProperty("--tilt-x", `${x * 5}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${y * -5}deg`);
}

function resetTilt(event: ReactPointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsNote, setEventsNote] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState("");
  const [searched, setSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [errorPlaces, setErrorPlaces] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const isArabic = language === "ar";
  const t = copy[language];
  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? false : { opacity: 0, y: 22 },
    whileInView: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.14 },
    transition: { duration: prefersReducedMotion ? 0 : 0.58, delay, ease: [0.2, 0.75, 0.2, 1] as const },
  });

  const handleAsk = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loadingEvents) return;
    setQuestion(trimmed);
    setSearched(true);
    setLoadingEvents(true);
    setErrorEvents("");
    setEvents([]);
    setEventsNote(null);
    setActiveCategory("All");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.searchError);
      setEvents(Array.isArray(data.items) ? data.items : []);
      setEventsNote(typeof data.note === "string" ? data.note : null);
    } catch (error) {
      setErrorEvents(error instanceof Error ? error.message : t.searchError);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleAsk(question);
  };

  useEffect(() => {
    let active = true;
    const fetchPlaces = async () => {
      try {
        const response = await fetch("/api/places");
        const data = await response.json();
        if (!response.ok) throw new Error("Places unavailable");
        if (active) setPlaces(Array.isArray(data.places) ? data.places : []);
      } catch {
        if (active) setErrorPlaces(true);
      } finally {
        if (active) setLoadingPlaces(false);
      }
    };
    void fetchPlaces();
    return () => { active = false; };
  }, []);

  const filteredEvents = useMemo(
    () => activeCategory === "All" ? events : events.filter((event) => event.category === activeCategory),
    [activeCategory, events],
  );
  const curatedEvents = filteredEvents.filter((event) => event.isCurated);
  const webEvents = filteredEvents.filter((event) => !event.isCurated);

  const formatDate = (date: string) => new Date(`${date}T12:00:00.000Z`).toLocaleDateString(
    isArabic ? "ar-KW" : "en-US",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuwait" },
  );

  const renderEventCard = (event: EventItem, index: number) => (
    <motion.article
      className="event-card glass-card tilt-card"
      key={`${event.source_url ?? event.title}-${index}`}
      onPointerMove={tiltCard}
      onPointerLeave={resetTilt}
      {...reveal(index * 0.055)}
    >
      <div className="event-card-topline">
        <span className={`event-source-tag ${event.isCurated ? "curated-tag" : "web-tag"}`}>
          {event.isCurated ? <Check size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}
          {event.isCurated ? t.curated : t.web}
        </span>
        <span className="category-tag">{isArabic ? categoryLabels[event.category] ?? event.category : event.category}</span>
      </div>
      <h3 className="event-title">{event.title}</h3>
      <p className="event-description">{event.description}</p>
      <div className="event-meta">
        <div className="meta-row">
          <CalendarDays size={16} aria-hidden="true" />
          {event.date ? <time dateTime={event.date}>{formatDate(event.date)}</time> : <span className="unconfirmed-date">{t.dateUnconfirmed}</span>}
        </div>
        {event.location && <div className="meta-row"><MapPin size={16} aria-hidden="true" /><span>{event.location}</span></div>}
      </div>
      {event.source_url && (
        <a className="event-link" href={event.source_url} target="_blank" rel="noopener noreferrer">
          {t.source}<ArrowUpRight size={15} aria-hidden="true" />
        </a>
      )}
    </motion.article>
  );

  return (
    <div className={`app-shell ${isArabic ? "arabic-ui" : "english-ui"}`} dir={isArabic ? "rtl" : "ltr"} lang={language}>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label={t.brand}>
            <span className="brand-mark"><Compass size={21} strokeWidth={2.2} /></span>
            <span>{t.brand}<span className="brand-period">.</span></span>
          </a>
          <button className="language-toggle glass-card" onClick={() => setLanguage(isArabic ? "en" : "ar")} type="button" aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}>
            <Globe2 size={16} /><span>{t.language}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-scene" aria-hidden="true"><HeroSceneLoader /></div>
          <div className="hero-shade" aria-hidden="true" />
          <motion.div className="hero-content content-width" {...reveal(0.03)}>
            <div className="eyebrow"><span className="eyebrow-dot" /><Sparkles size={14} />{t.eyebrow}</div>
            <h1>{t.title.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
            <p className="hero-subtitle">{t.subtitle}</p>

            <form className="search-form glass-card" onSubmit={handleSubmit} role="search">
              <label className="sr-only" htmlFor="event-search">{t.inputLabel}</label>
              <Search className="search-icon" size={20} aria-hidden="true" />
              <input
                id="event-search"
                type="search"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t.searchPlaceholder}
                maxLength={500}
                autoComplete="off"
              />
              <button type="submit" disabled={loadingEvents || !question.trim()}>
                {loadingEvents ? <span className="button-spinner" /> : <>{t.search}<ArrowUpRight size={16} aria-hidden="true" /></>}
              </button>
            </form>

            <div className="prompt-row">
              <span className="prompt-label">{t.promptsLabel}</span>
              {t.prompts.map((prompt) => (
                <button key={prompt} className="prompt-chip glass-card" type="button" onClick={() => void handleAsk(prompt)} disabled={loadingEvents}>{prompt}</button>
              ))}
            </div>
          </motion.div>
          <div className="scene-caption"><span className="caption-pulse" />{t.sceneCaption}</div>
          <a className="scroll-cue" href="#discover"><span>{t.browse}</span><ArrowDown size={14} /></a>
        </section>

        <motion.section id="discover" className="discover-section content-width" aria-live="polite" {...reveal()}>
          <div className="section-heading">
            <div>
              <p className="section-kicker"><span className="kicker-line" />{question ? t.discoverKicker : t.emptyKicker}</p>
              <h2>{question ? t.results : (isArabic ? "إلى أين يأخذك المساء؟" : "Where will the evening take you?")}</h2>
            </div>
            {searched && !loadingEvents && !errorEvents && <span className="result-count glass-card">{t.resultCount(filteredEvents.length)}</span>}
          </div>

          {searched && !loadingEvents && !errorEvents && events.length > 0 && (
            <div className="category-scroller" aria-label={isArabic ? "تصفية حسب الفئة" : "Filter by category"}>
              {categories.map((category) => (
                <button key={category} className={`filter-chip glass-card ${activeCategory === category ? "filter-chip-active" : ""}`} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>
                  {isArabic ? categoryLabels[category] : category === "All" ? (isArabic ? t.chipAll : "Everything") : category}
                </button>
              ))}
            </div>
          )}

          {loadingEvents && <div className="event-grid" aria-label={t.loading}><EventSkeleton /><EventSkeleton /><EventSkeleton /></div>}
          {errorEvents && <div className="notice notice-error glass-card"><Info size={18} /><span>{errorEvents}</span></div>}
          {eventsNote && !loadingEvents && !errorEvents && <div className="notice notice-info glass-card"><Info size={18} /><span>{isArabic && eventsNote.includes("migration") ? t.curatedNote : eventsNote}</span></div>}

          {searched && !loadingEvents && !errorEvents && filteredEvents.length > 0 && (
            <div className="result-groups">
              {curatedEvents.length > 0 && (
                <div className="result-group">
                  <div className="group-heading"><span className="group-dot curated-dot" /><h3>{t.curatedHeading}</h3><span>{curatedEvents.length}</span></div>
                  <div className="event-grid">{curatedEvents.map(renderEventCard)}</div>
                </div>
              )}
              {webEvents.length > 0 && (
                <div className="result-group">
                  <div className="group-heading"><span className="group-dot web-dot" /><h3>{t.webHeading}</h3><span>{webEvents.length}</span></div>
                  <div className="event-grid">{webEvents.map(renderEventCard)}</div>
                </div>
              )}
            </div>
          )}

          {searched && !loadingEvents && !errorEvents && filteredEvents.length === 0 && (
            <div className="empty-state glass-card"><span className="empty-icon"><Search size={23} /></span><h3>{t.noResults}</h3><p>{t.noResultsHint}</p></div>
          )}

          {!searched && !loadingEvents && (
            <div className="welcome-card glass-card"><span className="welcome-icon"><Sparkles size={19} /></span><p>{t.emptyPrompt}</p><span className="welcome-decoration">✳</span></div>
          )}
        </motion.section>

        <motion.section className="places-section content-width" {...reveal()}>
          <div className="section-heading places-heading">
            <div><p className="section-kicker"><span className="kicker-line" />{t.placesKicker}</p><h2>{t.placesTitle}</h2><p className="section-subtitle">{t.placesSubtitle}</p></div>
            <span className="places-icon glass-card"><MapPin size={21} /></span>
          </div>
          {loadingPlaces ? (
            <div className="places-grid" aria-label={t.loading}>{[1, 2, 3].map((item) => <div className="place-skeleton glass-card" key={item}><div /><span /><span /></div>)}</div>
          ) : errorPlaces ? (
            <div className="notice notice-info glass-card"><Info size={18} /><span>{t.placesError}</span></div>
          ) : places.length > 0 ? (
            <div className="places-grid">
              {places.map((place, index) => (
                <motion.article className="place-card glass-card tilt-card" key={place.id ?? `${place.name ?? place.title}-${index}`} onPointerMove={tiltCard} onPointerLeave={resetTilt} {...reveal(index * 0.05)}>
                  <div className="place-card-icon"><MapPin size={18} /></div>
                  <h3>{place.name || place.title || (isArabic ? "مكان مميز" : "Local place")}</h3>
                  <p>{place.description || (isArabic ? "اكتشف تفاصيل هذا المكان." : "A local spot to add to your list.")}</p>
                  {place.location_url && <a href={place.location_url} target="_blank" rel="noopener noreferrer">{t.map}<ExternalLink size={14} /></a>}
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="places-empty glass-card"><Compass size={23} /><p>{t.noPlaces}</p></div>
          )}
        </motion.section>
      </main>

      <footer className="site-footer content-width"><span className="footer-brand"><Compass size={15} />{t.brand}</span><p>{t.privacy}</p></footer>
    </div>
  );
}
