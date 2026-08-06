"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Compass,
  FileText,
  Heart,
  LibraryBig,
  Microscope,
  NotebookPen,
  Play,
  Search,
  Share2,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { OrganViewer } from "./OrganViewer";
import { getOrganById, getOrgans, type Organ, type OrganId } from "../lib/anatomy-data";
import { translations, type Language, type UIStrings } from "../lib/translations";

type Modal = "lesson" | "quiz" | "animation" | "system" | null;

/**
 * Renders an organ illustration, or its accent glyph for organs that ship as a
 * 3D model without the painted asset set. Keeps every image slot filled instead
 * of leaving a broken `<img>` behind.
 */
function OrganArt({
  organ,
  asset,
  alt,
  size,
}: {
  organ: Organ;
  asset: "thumb" | "organ" | "microscopic" | "compare" | "location";
  alt: string;
  size?: number;
}) {
  if (!organ.illustrated) {
    const labelling = alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true };
    return (
      <span className="art-fallback" style={{ "--art-accent": organ.accent } as React.CSSProperties} {...labelling}>
        {organ.icon}
      </span>
    );
  }
  return (
    // These are already resized, compressed WebP assets. Keeping the native
    // element avoids routing every small library image through an optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={`${organ.id}-${asset}`}
      src={`/anatomy/${organ.id}/${asset}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading={asset === "thumb" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function AnatomyApp() {
  const [lang, setLang] = useState<Language>("en");
  const [organId, setOrganId] = useState<OrganId>("heart");
  const [autoRotate, setAutoRotate] = useState(true);
  const [compare, setCompare] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());

  // Restore the device preference after hydration. Deferring the state update
  // avoids a synchronous effect cascade while keeping the server HTML stable.
  useEffect(() => {
    const saved = localStorage.getItem("anatomy_lang") as Language | null;
    if (saved && (saved === "en" || saved === "de" || saved === "ar")) {
      const timer = window.setTimeout(() => setLang(saved), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("anatomy_lang", newLang);
  };

  const strings = translations[lang];
  const organsList = useMemo(() => getOrgans(lang), [lang]);
  const organ = useMemo(() => getOrganById(organId, lang), [organId, lang]);
  const reference = useMemo(() => getOrganById(organId === "heart" ? "brain" : "heart", lang), [organId, lang]);

  const filteredOrgans = useMemo(
    () => organsList.filter((item) => `${item.name} ${item.system}`.toLowerCase().includes(query.toLowerCase())),
    [organsList, query],
  );

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [organId, lang]);

  const selectOrgan = (id: OrganId) => {
    const target = getOrganById(id, lang);
    if (target.illustrated) {
      ["organ", "microscopic", "compare", "location"].forEach((asset) => {
        const image = new Image();
        image.src = `/anatomy/${id}/${asset}.webp`;
      });
    }
    setOrganId(id);
    setMobileLibrary(false);
    setCompare(false);
  };

  const prefetchOrgan = (id: OrganId) => {
    if (id === organId || prefetched.current.has(id)) return;
    prefetched.current.add(id);
    const target = getOrganById(id, lang);
    if (!target.model.startsWith("procedural:")) {
      void fetch(target.model, { priority: "low" } as RequestInit).catch(() => {});
    }
    if (target.illustrated) {
      const image = new Image();
      image.src = `/anatomy/${id}/organ.webp`;
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => selectOrgan("heart")} aria-label="Anatomy Atelier home">
          <strong>{strings.brandTitle}<sup>✦</sup></strong>
          <em>{strings.brandTagline}</em>
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button className="active"><Compass size={17} /> {strings.navExplore}</button>
          <button><BrainCircuit size={17} /> {strings.navSystems}</button>
          <button onClick={() => setModal("lesson")}><BookOpen size={17} /> {strings.navLessons}</button>
          <button><LibraryBig size={17} /> {strings.navLibrary}</button>
          <button><NotebookPen size={17} /> {strings.navNotes}</button>
        </nav>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={strings.searchPlaceholder} />
        </label>
        <div className="lang-switcher" aria-label="Select language">
          <button type="button" className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => changeLanguage("en")}>EN</button>
          <button type="button" className={`lang-btn ${lang === "de" ? "active" : ""}`} onClick={() => changeLanguage("de")}>DE</button>
          <button type="button" className={`lang-btn ${lang === "ar" ? "active" : ""}`} onClick={() => changeLanguage("ar")}>العربية</button>
        </div>
        <button className="profile" aria-label="Open learner profile"><span>MA</span><ChevronDown size={15} /></button>
        <button className="mobile-library-trigger" onClick={() => setMobileLibrary(true)} aria-label="Open organ library"><LibraryBig size={20} /></button>
      </header>

      <div className="workspace">
        <aside className={`organ-library ${mobileLibrary ? "open" : ""}`}>
          <div className="panel-heading">
            <span>{strings.organLibrary}</span>
            <button aria-label="Close library" className="mobile-close" onClick={() => setMobileLibrary(false)}><X size={17} /></button>
            <button aria-label={strings.savedOrgans}><Bookmark size={17} /></button>
          </div>
          <div className="organ-list">
            {filteredOrgans.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`organ-item ${organId === item.id ? "active" : ""}`}
                onClick={() => selectOrgan(item.id)}
                onPointerEnter={() => prefetchOrgan(item.id)}
                onFocus={() => prefetchOrgan(item.id)}
                style={{ "--item-accent": item.accent } as React.CSSProperties}
              >
                <span className="organ-glyph">
                  <OrganArt organ={item} asset="thumb" alt={`${item.name} thumbnail`} size={47} />
                </span>
                <span><b>{item.name}</b><small>{item.system}</small></span>
                {organId === item.id && <Heart className="favorite" size={14} fill="currentColor" />}
              </button>
            ))}
          </div>
          <button className="view-all" onClick={() => setQuery("")}>{strings.viewAllOrgans} <ArrowRight size={14} /></button>
          <blockquote>
            <Sparkles size={18} />
            <p>{strings.quoteLine1}<br />{strings.quoteLine2}</p>
            <em>{strings.keepExploring}</em>
          </blockquote>
        </aside>

        <OrganViewer
          organ={organ}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          compare={compare}
          onCompare={() => setCompare(!compare)}
          strings={strings}
        />

        <aside className="info-panel" ref={contentRef}>
          <div className="info-kicker" data-reveal><Heart size={13} fill="currentColor" /> {organ.name}</div>
          <div className="info-title-row" data-reveal>
            <div><h1>{organ.name}</h1><em>{organ.poetic}</em></div>
            <span className="specimen-stamp">
              <OrganArt organ={organ} asset="organ" alt={`${organ.name} anatomical illustration`} size={92} />
            </span>
          </div>
          <p className="description" data-reveal>{organ.description}</p>
          <div className="rule" />
          <h2 data-reveal>{strings.keyFacts}</h2>
          <dl className="key-facts">
            <div data-reveal><dt><span>◇</span> {strings.size}</dt><dd>{organ.size}</dd></div>
            <div data-reveal><dt><span>♙</span> {strings.weight}</dt><dd>{organ.weight}</dd></div>
            <div data-reveal><dt><span>⌁</span> {strings.daily}</dt><dd>{organ.dailyFact}</dd></div>
            <div data-reveal><dt><span>⌖</span> {strings.location}</dt><dd>{organ.location}</dd></div>
            <div data-reveal><dt><span>❋</span> {strings.bloodSupply}</dt><dd>{organ.bloodSupply}</dd></div>
            <div data-reveal><dt><span>◈</span> {strings.function}</dt><dd>{organ.function}</dd></div>
          </dl>
          <div className="medical-note" data-reveal><Stethoscope size={16} /><p><b>{strings.medicalImportance}</b>{organ.medical}</p></div>
          <div className="fun-note" data-reveal><Sparkles size={15} /><p><b>{strings.didYouKnow}</b>{organ.funFact}</p></div>
          <button className="lesson-button" data-reveal onClick={() => setModal("lesson")}>{strings.viewLesson} <ArrowRight size={16} /></button>
          <div className="action-grid" data-reveal>
            <button onClick={() => setModal("animation")}><Play size={15} /> {strings.animate}</button>
            <button onClick={() => setModal("quiz")}><CircleHelp size={15} /> {strings.quiz}</button>
            <button onClick={() => setCompare(!compare)} className={compare ? "active" : ""}><Share2 size={15} /> {strings.compare}</button>
          </div>
        </aside>
      </div>

      {compare && (
        <section className="compare-strip" aria-label="Organ comparison">
          <div className="compare-organ"><OrganArt organ={organ} asset="thumb" alt="" /><span>{strings.comparing}</span><strong>{organ.name}</strong><small>{organ.system}</small></div>
          <b>{strings.vs}</b>
          <div className="compare-organ"><OrganArt organ={reference} asset="thumb" alt="" /><span>{strings.reference}</span><strong>{reference.name}</strong><small>{reference.system}</small></div>
          <dl><div><dt>{strings.primaryRole}</dt><dd>{organ.function}</dd></div><div><dt>{strings.scale}</dt><dd>{organ.size}</dd></div></dl>
          <button onClick={() => setCompare(false)} aria-label={strings.closeComparison}><X size={16} /></button>
        </section>
      )}

      <section className="learning-cards" aria-label={`${organ.name} learning resources`}>
        <article className="curiosity-card">
          <span>✿</span><p>{strings.quoteLine1}<br />{strings.quoteLine2}</p><em>{strings.keepExploring}</em>
        </article>
        <article>
          <header><div><em>{strings.microscopicView}</em><h3>{organ.tissue}</h3></div><Microscope size={17} /></header>
          <div className="microscope-visual organ-card-image"><OrganArt organ={organ} asset="microscopic" alt={`${organ.name} microscopic tissue view`} /></div>
          <button onClick={() => setModal("lesson")}>{strings.exploreTissue} <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>{strings.compareOrgans}</em><h3>{organ.comparison}</h3></div><Share2 size={17} /></header>
          <div className="comparison-visual organ-card-image"><OrganArt organ={organ} asset="compare" alt={`${organ.comparison} anatomical comparison`} /></div>
          <button onClick={() => setCompare(true)}>{strings.openComparison} <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>{strings.functionAnimation}</em><h3>{organ.function}</h3></div><Play size={17} /></header>
          <button
            type="button"
            className="function-visual organ-card-image"
            onClick={() => setModal("animation")}
            aria-label={`Play the ${organ.name.toLowerCase()} function animation`}
          >
            <OrganArt organ={organ} asset="organ" alt="" />
            <i className="function-pulse" />
            <span className="play-badge"><Play size={18} fill="currentColor" /></span>
          </button>
          <button onClick={() => setModal("animation")}>{strings.playAnimation} <ArrowRight size={14} /></button>
        </article>
        <article>
          <header><div><em>{strings.clinicalNotes}</em><h3>{strings.commonConditions}</h3></div><FileText size={17} /></header>
          <ul>{organ.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
          <button onClick={() => setModal("lesson")}>{strings.seeAll} <ArrowRight size={14} /></button>
        </article>
        <article className="system-card">
          <header><div><em>{strings.whereItWorks}</em><h3>{organ.system}</h3></div><BrainCircuit size={17} /></header>
          <button
            type="button"
            className="system-visual organ-card-image"
            onClick={() => setModal("system")}
            aria-label={`See where the ${organ.name.toLowerCase()} sits in the body`}
          >
            <OrganArt organ={organ} asset="location" alt="" />
          </button>
          <button onClick={() => setModal("system")}>{strings.seeTheSystem} <ArrowRight size={14} /></button>
        </article>
      </section>

      {modal && <LearningModal type={modal} organ={organ} strings={strings} onClose={() => setModal(null)} />}
      {mobileLibrary && <button className="drawer-backdrop" aria-label="Close library" onClick={() => setMobileLibrary(false)} />}
    </main>
  );
}

const MODAL_ICON: Record<Exclude<Modal, null>, string> = {
  quiz: "?",
  animation: "▶",
  system: "⌖",
  lesson: "✦",
};

function LearningModal({
  type,
  organ,
  strings,
  onClose,
}: {
  type: Exclude<Modal, null>;
  organ: Organ;
  strings: UIStrings;
  onClose: () => void;
}) {
  const organName = organ.name;
  const title =
    type === "quiz" ? `${organName} ${strings.quickQuizTitle}`
    : type === "animation" ? `${organName} ${strings.inMotionTitle}`
    : type === "system" ? `${organName} ${strings.inTheBodyTitle}`
    : `${strings.insideTitle} ${organName}`;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`learning-modal ${type === "system" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="modal-icon">{MODAL_ICON[type]}</span>
        <em>{strings.guidedDiscovery}</em>
        <h2 id="modal-title">{title}</h2>
        {type === "quiz" ? (
          <div className="quiz-options">
            <p>{strings.quizQuestion}</p>
            <button onClick={onClose}>{strings.quizOption1}</button>
            <button onClick={onClose}>{strings.quizOption2}</button>
            <button onClick={onClose}>{strings.quizOption3}</button>
          </div>
        ) : type === "system" ? (
          <>
            <p>{organ.location}. {strings.systemModalText}</p>
            <figure className="modal-figure">
              <OrganArt organ={organ} asset="location" alt={`${organName} shown in place within the ${organ.system.toLowerCase()}`} />
            </figure>
            <dl className="modal-facts">
              <div><dt>{strings.whereItWorks}</dt><dd>{organ.system}</dd></div>
              <div><dt>{strings.primaryRole}</dt><dd>{organ.function}</dd></div>
              <div><dt>{strings.bloodSupply}</dt><dd>{organ.bloodSupply}</dd></div>
            </dl>
            <button className="lesson-button" onClick={onClose}>{strings.continueExploring} <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <p>{strings.animationModalText}</p>
            <div className={`modal-demo ${type === "animation" ? "moving" : ""}`}><OrganArt organ={organ} asset="organ" alt={`${organName} illustration`} /></div>
            <button className="lesson-button" onClick={onClose}>{strings.continueExploring} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}
