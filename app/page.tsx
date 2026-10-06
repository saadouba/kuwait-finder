"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
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
  List,
  Map,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import HeroSceneLoader from "@/app/components/HeroSceneLoader";

const KuwaitMap = dynamic(() => import("@/app/components/KuwaitMap"), {
  ssr: false,
  loading: () => <div className="map-loading glass-card" role="status">Loading map · جارٍ تحميل الخريطة…</div>,
});

type Category = "Events" | "Places" | "Restaurants & Cafes" | "Family Activities";
type Language = "en" | "ar";
type DiscoveryItem = {
  id?: string;
  slug?: string;
  title: string;
  date: string | null;
  location: string | null;
  description: string;
  category: Category;
  source_url: string | null;
  isCurated: boolean;
  isSample: boolean;
  latitude: number | null;
  longitude: number | null;
};
type CategoryFilter = "All" | Category;

let currentLanguage: Language = "en";
const languageListeners = new Set<() => void>();

function storedLanguage(): Language {
  try {
    const value = window.localStorage.getItem("kuwait-finder-language");
    return value === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

function getLanguageSnapshot(): Language {
  return currentLanguage;
}

function getLanguageServerSnapshot(): Language {
  return "en";
}

function subscribeToLanguage(listener: () => void) {
  languageListeners.add(listener);
  const saved = storedLanguage();
  if (saved !== currentLanguage) {
    currentLanguage = saved;
    listener();
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== "kuwait-finder-language") return;
    const next = storedLanguage();
    if (next === currentLanguage) return;
    currentLanguage = next;
    languageListeners.forEach((notify) => notify());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const categoryFilters: CategoryFilter[] = ["All", "Events", "Places", "Restaurants & Cafes", "Family Activities"];
const categoryLabels: Record<Language, Record<CategoryFilter, string>> = {
  en: {
    All: "Everything",
    Events: "Events",
    Places: "Places to visit",
    "Restaurants & Cafes": "Restaurants & cafes",
    "Family Activities": "Family activities",
  },
  ar: {
    All: "الكل",
    Events: "الفعاليات",
    Places: "أماكن للزيارة",
    "Restaurants & Cafes": "مطاعم ومقاهٍ",
    "Family Activities": "أنشطة عائلية",
  },
};

const copy = {
  en: {
    brand: "Kuwait Finder",
    language: "العربية",
    eyebrow: "YOUR CITY, AFTER DARK",
    title: "The night is\nyours to discover.",
    subtitle: "Find the moments, places, and little adventures that make Kuwait feel electric.",
    searchPlaceholder: "What would you like to discover in Kuwait?",
    search: "Find your next plan",
    promptsLabel: "Try",
    prompts: ["Events this weekend", "Restaurants and cafes", "Family activities"],
    results: "Your next plan",
    resultCount: (count: number) => `${count} ${count === 1 ? "discovery" : "discoveries"}`,
    curated: "CURATED IN KUWAIT",
    web: "SOURCE-BACKED SEARCH",
    sampleBadge: "SAMPLE DATA · NOT A REAL EVENT",
    dateUnconfirmed: "Date not confirmed",
    noResults: "No source-backed matches yet",
    noResultsHint: "Try a broader search. Events without confirmed dates are kept when the source supports them.",
    searchError: "We couldn’t complete that search. Please try again.",
    providerSetup: "Add the server-side Groq and Tavily keys to enable web search.",
    protectionSetup: "Search protection is not ready. Apply the Supabase migration and check the server-side environment variables.",
    rateLimit: "Search limit reached. Please wait a moment and try again.",
    directoryTitle: "Explore Kuwait",
    directorySubtitle: "Verified local places, curated listings, and map pins in one place.",
    placesError: "Directory data is temporarily unavailable.",
    directoryMigration: "Curated events or places are not set up yet. Run the Supabase migration and seed SQL to enable the directory.",
    noDirectory: "No items in this category yet.",
    mapView: "Map",
    listView: "List",
    loading: "Searching across Kuwait…",
    source: "Open source",
    emptyPrompt: "Search for an event, a place to visit, a restaurant, or a family activity.",
    privacy: "Search is protected with Supabase-backed rate limits and caching. Keys stay on the server.",
    inputLabel: "Search events, places, restaurants, and activities in Kuwait",
    curatedHeading: "Curated first",
    webHeading: "More to discover",
    discoverKicker: "THE CITY IS YOURS",
    emptyKicker: "MAKE A PLAN",
    directoryKicker: "LOCAL FAVORITES",
    sceneCaption: "KUWAIT CITY · 29.3759° N",
    browse: "Scroll to explore",
    sampleExplanation: "Demo-only placeholder. This is not a real event listing.",
    event: "Event",
    locationFallback: "Kuwait",
    mapLoading: "Loading map…",
    sampleDirectoryNote: "Sample events are marked clearly and are never treated as real search results.",
  },
  ar: {
    brand: "دليل الكويت",
    language: "English",
    eyebrow: "مدينتك، بعد الغروب",
    title: "الليل لك،\nاكتشف حكاياته.",
    subtitle: "اكتشف لحظات وأماكن ومغامرات صغيرة تجعل الكويت تنبض بالحياة.",
    searchPlaceholder: "ما الذي ترغب في اكتشافه في الكويت؟",
    search: "اكتشف خطتك القادمة",
    promptsLabel: "جرّب",
    prompts: ["فعاليات نهاية الأسبوع", "مطاعم ومقاهٍ", "أنشطة عائلية"],
    results: "خطتك القادمة",
    resultCount: (count: number) => `${count} اكتشافات`,
    curated: "اختيارات محلية موثقة",
    web: "نتائج مدعومة بالمصادر",
    sampleBadge: "بيانات تجريبية · ليست فعالية حقيقية",
    dateUnconfirmed: "التاريخ غير مؤكد",
    noResults: "لا توجد نتائج موثقة بعد",
    noResultsHint: "جرّب بحثاً أوسع. نعرض الفعاليات التي لا يتأكد تاريخها عندما يدعمها المصدر.",
    searchError: "تعذّر إكمال البحث. حاول مرة أخرى.",
    providerSetup: "أضف مفاتيح Groq وTavily في إعدادات الخادم لتفعيل البحث عبر الإنترنت.",
    protectionSetup: "حماية البحث غير جاهزة. طبّق ترحيل Supabase وتحقق من متغيرات الخادم.",
    rateLimit: "تم بلوغ حد البحث. انتظر قليلاً ثم حاول مجدداً.",
    directoryTitle: "اكتشف الكويت",
    directorySubtitle: "أماكن محلية مختارة وقوائم موثقة ونقاط على الخريطة.",
    placesError: "بيانات الدليل غير متاحة مؤقتاً.",
    directoryMigration: "لم يتم إعداد الأماكن أو الفعاليات بعد. شغّل ترحيل Supabase وملف البيانات التجريبية.",
    noDirectory: "لا توجد عناصر في هذه الفئة بعد.",
    mapView: "الخريطة",
    listView: "القائمة",
    loading: "نبحث في أنحاء الكويت…",
    source: "افتح المصدر",
    emptyPrompt: "ابحث عن فعالية أو مكان للزيارة أو مطعم أو نشاط عائلي.",
    privacy: "البحث محمي بحدود طلبات وتخزين مؤقت عبر Supabase. تبقى المفاتيح على الخادم.",
    inputLabel: "ابحث عن فعاليات وأماكن ومطاعم وأنشطة في الكويت",
    curatedHeading: "اختيارات مختارة أولاً",
    webHeading: "اكتشافات أخرى",
    discoverKicker: "المدينة لك",
    emptyKicker: "خطط لليلتك",
    directoryKicker: "أماكن محلية مميزة",
    sceneCaption: "مدينة الكويت · ٢٩٫٣٧٥٩° شمالاً",
    browse: "مرر لاكتشاف المزيد",
    sampleExplanation: "عنصر تجريبي فقط، وليس إعلاناً عن فعالية حقيقية.",
    event: "فعالية",
    locationFallback: "الكويت",
    mapLoading: "جارٍ تحميل الخريطة…",
    sampleDirectoryNote: "الفعاليات التجريبية موسومة بوضوح ولا تظهر أبداً كفعاليات حقيقية في نتائج البحث.",
  },
} as const;

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
  event.currentTarget.style.setProperty("--tilt-x", `${x * 4}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${y * -4}deg`);
}

function resetTilt(event: ReactPointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}

function itemIdentity(item: DiscoveryItem): string {
  return item.slug || item.source_url || `${item.category}:${item.title}:${item.latitude ?? ""}:${item.longitude ?? ""}`;
}

export default function Home() {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getLanguageServerSnapshot);
  const [question, setQuestion] = useState("");
  const [searchItems, setSearchItems] = useState<DiscoveryItem[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");
  const [directoryItems, setDirectoryItems] = useState<DiscoveryItem[]>([]);
  const [directoryNote, setDirectoryNote] = useState<string | null>(null);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState(false);
  const [directoryView, setDirectoryView] = useState<"list" | "map">("list");
  const prefersReducedMotion = useReducedMotion();

  const isArabic = language === "ar";
  const t = copy[language];
  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? false : { opacity: 0, y: 20 },
    whileInView: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: prefersReducedMotion ? 0 : 0.52, delay, ease: [0.2, 0.75, 0.2, 1] as const },
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic, language]);

  const changeLanguage = () => {
    const next: Language = isArabic ? "en" : "ar";
    try { window.localStorage.setItem("kuwait-finder-language", next); } catch { /* Optional preference only. */ }
    currentLanguage = next;
    languageListeners.forEach((notify) => notify());
  };

  const handleAsk = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loadingSearch) return;
    setQuestion(trimmed);
    setSearched(true);
    setLoadingSearch(true);
    setSearchError("");
    setSearchItems([]);
    setSearchNote(null);
    setActiveCategory("All");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "RATE_LIMITED") throw new Error(t.rateLimit);
        if (data.code === "SEARCH_SETUP_REQUIRED") throw new Error(t.protectionSetup);
        if (data.code === "SEARCH_PROVIDER_SETUP_REQUIRED") throw new Error(t.providerSetup);
        throw new Error(typeof data.error === "string" ? data.error : t.searchError);
      }
      const receivedItems = Array.isArray(data.items) ? data.items as DiscoveryItem[] : [];
      setSearchItems(receivedItems);
      if (data.curatedMissingTable) setSearchNote(t.directoryMigration);
      else if (data.curatedUnavailable) setSearchNote(t.placesError);
      else setSearchNote(receivedItems.length > 0 && typeof data.note === "string" ? data.note : null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : t.searchError);
    } finally {
      setLoadingSearch(false);
      window.setTimeout(() => document.getElementById("discover")?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" }), 80);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleAsk(question);
  };

  useEffect(() => {
    let active = true;
    const fetchDirectory = async () => {
      try {
        const response = await fetch("/api/places", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error("Directory unavailable");
        if (active) {
          setDirectoryItems(Array.isArray(data.items) ? data.items : []);
          const note = typeof data.note === "string" ? data.note : "";
          setDirectoryNote(note || null);
        }
      } catch {
        if (active) setDirectoryError(true);
      } finally {
        if (active) setLoadingDirectory(false);
      }
    };
    void fetchDirectory();
    return () => { active = false; };
  }, []);

  const visibleSearch = useMemo(
    () => activeCategory === "All" ? searchItems : searchItems.filter((item) => item.category === activeCategory),
    [activeCategory, searchItems],
  );
  const curatedSearch = visibleSearch.filter((item) => item.isCurated && !item.isSample);
  const webSearch = visibleSearch.filter((item) => !item.isCurated);
  const visibleDirectory = useMemo(
    () => activeCategory === "All" ? directoryItems : directoryItems.filter((item) => item.category === activeCategory),
    [activeCategory, directoryItems],
  );
  const mapItems = useMemo(() => {
    const seen = new Set<string>();
    const values = [...directoryItems, ...searchItems].flatMap((item) => {
      const key = `${item.category}:${itemIdentity(item)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: item.id || key,
        slug: item.slug,
        title: item.title,
        date: item.date,
        location: item.location || t.locationFallback,
        description: item.description,
        category: item.category,
        source_url: item.source_url,
        isSample: item.isSample,
        latitude: item.latitude,
        longitude: item.longitude,
      }];
    });
    return activeCategory === "All" ? values : values.filter((item) => item.category === activeCategory);
  }, [activeCategory, directoryItems, searchItems, t.locationFallback]);

  const categoryText = (category: Category) => categoryLabels[language][category];

  const formatDate = (date: string) => new Date(`${date}T12:00:00.000Z`).toLocaleDateString(
    isArabic ? "ar-KW" : "en-US",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuwait" },
  );

  const renderCard = (item: DiscoveryItem, index: number) => (
    <motion.article
      className={`event-card glass-card tilt-card ${item.isSample ? "sample-card" : ""}`}
      key={`${item.id || itemIdentity(item)}-${index}`}
      onPointerMove={tiltCard}
      onPointerLeave={resetTilt}
      {...reveal(index * 0.035)}
    >
      <div className="event-card-topline">
        <span className={`event-source-tag ${item.isSample ? "sample-tag" : item.isCurated ? "curated-tag" : "web-tag"}`}>
          {item.isSample ? <Info size={13} aria-hidden="true" /> : item.isCurated ? <Check size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}
          {item.isSample ? t.sampleBadge : item.isCurated ? t.curated : t.web}
        </span>
        <span className="category-tag">{categoryText(item.category)}</span>
      </div>
      <h3 className="event-title">{item.title}</h3>
      {item.isSample && <p className="sample-explanation">{t.sampleExplanation}</p>}
      <p className="event-description">{item.description}</p>
      <div className="event-meta">
        {item.category === "Events" && (
          <div className="meta-row">
            <CalendarDays size={16} aria-hidden="true" />
            {item.date ? <time dateTime={item.date}>{formatDate(item.date)}</time> : <span className="unconfirmed-date">{t.dateUnconfirmed}</span>}
          </div>
        )}
        <div className="meta-row"><MapPin size={16} aria-hidden="true" /><span>{item.location || t.locationFallback}</span></div>
      </div>
      {item.source_url && (
        <a className="event-link" href={item.source_url} target="_blank" rel="noopener noreferrer">
          {t.source}<ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </motion.article>
  );

  const directoryNeedsMigration = Boolean(directoryNote && (directoryNote.includes("migration") || directoryNote.includes("not-configured")));

  return (
    <div className={`app-shell ${isArabic ? "arabic-ui" : "english-ui"}`} dir={isArabic ? "rtl" : "ltr"} lang={language}>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label={t.brand}>
            <span className="brand-mark"><Compass size={21} strokeWidth={2.2} /></span>
            <span>{t.brand}<span className="brand-period">.</span></span>
          </a>
          <button className="language-toggle glass-card" onClick={changeLanguage} type="button" aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}>
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
              <button type="submit" disabled={loadingSearch || !question.trim()}>
                {loadingSearch ? <span className="button-spinner" /> : <>{t.search}<ArrowUpRight size={16} aria-hidden="true" /></>}
              </button>
            </form>
            <div className="prompt-row">
              <span className="prompt-label">{t.promptsLabel}</span>
              {t.prompts.map((prompt) => (
                <button key={prompt} className="prompt-chip glass-card" type="button" onClick={() => void handleAsk(prompt)} disabled={loadingSearch}>{prompt}</button>
              ))}
            </div>
          </motion.div>
          <div className="scene-caption"><span className="caption-pulse" />{t.sceneCaption}</div>
          <a className="scroll-cue" href="#discover"><span>{t.browse}</span><ArrowDown size={14} /></a>
        </section>

        <motion.section id="discover" className="discover-section content-width" aria-live="polite" {...reveal()}>
          <div className="section-heading">
            <div>
              <p className="section-kicker"><span className="kicker-line" />{searched ? t.discoverKicker : t.emptyKicker}</p>
              <h2>{searched ? t.results : t.directoryTitle}</h2>
            </div>
            {searched && !loadingSearch && !searchError && <span className="result-count glass-card">{t.resultCount(visibleSearch.length)}</span>}
          </div>

          <div className="category-scroller" aria-label={isArabic ? "تصفية حسب الفئة" : "Filter by category"}>
            {categoryFilters.map((category) => (
              <button
                key={category}
                className={`filter-chip glass-card ${activeCategory === category ? "filter-chip-active" : ""}`}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
              >
                {categoryLabels[language][category]}
              </button>
            ))}
          </div>

          {searched && loadingSearch && <div className="event-grid" aria-label={t.loading}><EventSkeleton /><EventSkeleton /><EventSkeleton /></div>}
          {searched && searchError && <div className="notice notice-error glass-card"><Info size={18} /><span>{searchError}</span></div>}
          {searchNote && !loadingSearch && !searchError && <div className="notice notice-info glass-card"><Info size={18} /><span>{searchNote}</span></div>}

          {searched && !loadingSearch && !searchError && visibleSearch.length > 0 && (
            <div className="result-groups">
              {curatedSearch.length > 0 && (
                <div className="result-group">
                  <div className="group-heading"><span className="group-dot curated-dot" /><h3>{t.curatedHeading}</h3><span>{curatedSearch.length}</span></div>
                  <div className="event-grid">{curatedSearch.map(renderCard)}</div>
                </div>
              )}
              {webSearch.length > 0 && (
                <div className="result-group">
                  <div className="group-heading"><span className="group-dot web-dot" /><h3>{t.webHeading}</h3><span>{webSearch.length}</span></div>
                  <div className="event-grid">{webSearch.map(renderCard)}</div>
                </div>
              )}
            </div>
          )}

          {searched && !loadingSearch && !searchError && visibleSearch.length === 0 && (
            <div className="empty-state glass-card"><span className="empty-icon"><Search size={23} /></span><h3>{t.noResults}</h3><p>{t.noResultsHint}</p></div>
          )}

          {!searched && !loadingDirectory && directoryItems.length === 0 && !directoryError && (
            <div className="welcome-card glass-card"><span className="welcome-icon"><Sparkles size={19} /></span><p>{t.emptyPrompt}</p><span className="welcome-decoration">✳</span></div>
          )}
        </motion.section>

        <motion.section className="places-section content-width" {...reveal()}>
          <div className="section-heading places-heading">
            <div>
              <p className="section-kicker"><span className="kicker-line" />{t.directoryKicker}</p>
              <h2>{t.directoryTitle}</h2>
              <p className="section-subtitle">{t.directorySubtitle}</p>
            </div>
            <div className="view-toggle glass-card" role="group" aria-label={isArabic ? "طريقة العرض" : "Directory view"}>
              <button type="button" className={directoryView === "list" ? "view-toggle-active" : ""} onClick={() => setDirectoryView("list")} aria-pressed={directoryView === "list"}><List size={15} />{t.listView}</button>
              <button type="button" className={directoryView === "map" ? "view-toggle-active" : ""} onClick={() => setDirectoryView("map")} aria-pressed={directoryView === "map"}><Map size={15} />{t.mapView}</button>
            </div>
          </div>

          {directoryNeedsMigration && <div className="notice notice-info glass-card"><Info size={18} /><span>{t.directoryMigration}</span></div>}
          {directoryNote && !directoryNeedsMigration && !loadingDirectory && !directoryError && <div className="notice notice-info glass-card"><Info size={18} /><span>{t.placesError}</span></div>}
          {directoryItems.some((item) => item.isSample) && <p className="sample-directory-note"><Info size={14} />{t.sampleDirectoryNote}</p>}

          {loadingDirectory ? (
            <div className="places-grid" aria-label={t.loading}>{[1, 2, 3].map((item) => <EventSkeleton key={item} />)}</div>
          ) : directoryError ? (
            <div className="notice notice-info glass-card"><Info size={18} /><span>{t.placesError}</span></div>
          ) : directoryView === "map" ? (
            <KuwaitMap items={mapItems} language={language} />
          ) : visibleDirectory.length > 0 ? (
            <div className="event-grid directory-grid">{visibleDirectory.map(renderCard)}</div>
          ) : (
            <div className="places-empty glass-card"><Compass size={23} /><p>{t.noDirectory}</p></div>
          )}
        </motion.section>
      </main>

      <footer className="site-footer content-width"><span className="footer-brand"><Compass size={15} />{t.brand}</span><p>{t.privacy}</p></footer>
    </div>
  );
}
