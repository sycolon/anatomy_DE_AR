export type Language = "en" | "de" | "ar";

export type UIStrings = {
  brandTitle: string;
  brandTagline: string;
  navExplore: string;
  navSystems: string;
  navLessons: string;
  navLibrary: string;
  navNotes: string;
  searchPlaceholder: string;
  organLibrary: string;
  savedOrgans: string;
  viewAllOrgans: string;
  quoteLine1: string;
  quoteLine2: string;
  keepExploring: string;
  keyFacts: string;
  size: string;
  weight: string;
  daily: string;
  location: string;
  bloodSupply: string;
  function: string;
  medicalImportance: string;
  didYouKnow: string;
  viewLesson: string;
  animate: string;
  quiz: string;
  compare: string;
  comparing: string;
  reference: string;
  vs: string;
  primaryRole: string;
  scale: string;
  closeComparison: string;
  microscopicView: string;
  exploreTissue: string;
  compareOrgans: string;
  openComparison: string;
  functionAnimation: string;
  playAnimation: string;
  clinicalNotes: string;
  commonConditions: string;
  seeAll: string;
  whereItWorks: string;
  seeTheSystem: string;
  // Viewer
  toolRotate: string;
  toolZoom: string;
  toolIsolate: string;
  toolSection: string;
  toolLayers: string;
  toolCompare: string;
  toolReset: string;
  tipTitle: string;
  tipDrag: string;
  tipScroll: string;
  tipClickDot: string;
  autoRotate: string;
  preparing: string;
  specimenCaption: string;
  // Modals
  guidedDiscovery: string;
  quickQuizTitle: string;
  inMotionTitle: string;
  inTheBodyTitle: string;
  insideTitle: string;
  quizQuestion: string;
  quizOption1: string;
  quizOption2: string;
  quizOption3: string;
  systemModalText: string;
  animationModalText: string;
  continueExploring: string;
  // Language Names
  langName: string;
};

export const translations: Record<Language, UIStrings> = {
  en: {
    brandTitle: "Anatomy Atelier",
    brandTagline: "Learn anatomy like an artist",
    navExplore: "Explore",
    navSystems: "Systems",
    navLessons: "Lessons",
    navLibrary: "Library",
    navNotes: "Notes",
    searchPlaceholder: "Search organs, topics…",
    organLibrary: "Organ library",
    savedOrgans: "Saved organs",
    viewAllOrgans: "View all organs",
    quoteLine1: "Learning is",
    quoteLine2: "an act of curiosity.",
    keepExploring: "Keep exploring!",
    keyFacts: "Key facts",
    size: "Size",
    weight: "Weight",
    daily: "Daily",
    location: "Location",
    bloodSupply: "Blood supply",
    function: "Function",
    medicalImportance: "Medical importance",
    didYouKnow: "Did you know",
    viewLesson: "View lesson",
    animate: "Animate",
    quiz: "Quiz",
    compare: "Compare",
    comparing: "Comparing",
    reference: "Reference",
    vs: "vs.",
    primaryRole: "Primary role",
    scale: "Scale",
    closeComparison: "Close comparison",
    microscopicView: "Microscopic view",
    exploreTissue: "Explore tissue",
    compareOrgans: "Compare organs",
    openComparison: "Open comparison",
    functionAnimation: "Function animation",
    playAnimation: "Play animation",
    clinicalNotes: "Clinical notes",
    commonConditions: "Common conditions",
    seeAll: "See all",
    whereItWorks: "Where it works",
    seeTheSystem: "See the system",
    toolRotate: "Rotate",
    toolZoom: "Zoom",
    toolIsolate: "Isolate",
    toolSection: "Cross-section",
    toolLayers: "Layers",
    toolCompare: "Compare",
    toolReset: "Reset",
    tipTitle: "Tip",
    tipDrag: "Drag to rotate",
    tipScroll: "Scroll to zoom",
    tipClickDot: "Click a dot to learn more",
    autoRotate: "Auto rotate",
    preparing: "Preparing the",
    specimenCaption: "3D specimen · click a dot to explore",
    guidedDiscovery: "Guided discovery",
    quickQuizTitle: "quick quiz",
    inMotionTitle: "in motion",
    inTheBodyTitle: "in the body",
    insideTitle: "Inside the",
    quizQuestion: "Which statement best describes the organ?",
    quizOption1: "It plays a specialized role in maintaining the body",
    quizOption2: "It works completely independently",
    quizOption3: "It is active only during sleep",
    systemModalText: "Trace how it connects to the rest of the body.",
    animationModalText: "Follow the highlighted structures, rotate the specimen, and connect form with function. This short study moment is designed to build a durable mental model.",
    continueExploring: "Continue exploring",
    langName: "English",
  },
  de: {
    brandTitle: "Anatomie Atelier",
    brandTagline: "Lerne Anatomie wie ein Künstler",
    navExplore: "Entdecken",
    navSystems: "Systeme",
    navLessons: "Lektionen",
    navLibrary: "Bibliothek",
    navNotes: "Notizen",
    searchPlaceholder: "Organe, Themen suchen…",
    organLibrary: "Organ-Bibliothek",
    savedOrgans: "Gespeicherte Organe",
    viewAllOrgans: "Alle Organe anzeigen",
    quoteLine1: "Lernen ist",
    quoteLine2: "ein Akt der Neugier.",
    keepExploring: "Erforsche weiter!",
    keyFacts: "Wichtige Fakten",
    size: "Größe",
    weight: "Gewicht",
    daily: "Täglich",
    location: "Lage",
    bloodSupply: "Blutversorgung",
    function: "Funktion",
    medicalImportance: "Medizinische Bedeutung",
    didYouKnow: "Wussten Sie schon",
    viewLesson: "Lektion ansehen",
    animate: "Animieren",
    quiz: "Quiz",
    compare: "Vergleichen",
    comparing: "Vergleich",
    reference: "Referenz",
    vs: "vs.",
    primaryRole: "Hauptfunktion",
    scale: "Maßstab",
    closeComparison: "Vergleich schließen",
    microscopicView: "Mikroskopische Ansicht",
    exploreTissue: "Gewebe erkunden",
    compareOrgans: "Organe vergleichen",
    openComparison: "Vergleich öffnen",
    functionAnimation: "Funktionsanimation",
    playAnimation: "Animation abspielen",
    clinicalNotes: "Klinische Hinweise",
    commonConditions: "Häufige Erkrankungen",
    seeAll: "Alle sehen",
    whereItWorks: "Wo es wirkt",
    seeTheSystem: "System ansehen",
    toolRotate: "Drehen",
    toolZoom: "Zoomen",
    toolIsolate: "Isolieren",
    toolSection: "Querschnitt",
    toolLayers: "Schichten",
    toolCompare: "Vergleichen",
    toolReset: "Zurücksetzen",
    tipTitle: "Tipp",
    tipDrag: "Ziehen zum Drehen",
    tipScroll: "Scrollen zum Zoomen",
    tipClickDot: "Punkt anklicken für mehr Details",
    autoRotate: "Auto-Drehung",
    preparing: "Vorbereitung für",
    specimenCaption: "3D-Präparat · Punkt anklicken zum Erkunden",
    guidedDiscovery: "Geführte Entdeckung",
    quickQuizTitle: "Schnell-Quiz",
    inMotionTitle: "in Bewegung",
    inTheBodyTitle: "im Körper",
    insideTitle: "Einblick:",
    quizQuestion: "Welche Aussage beschreibt das Organ am besten?",
    quizOption1: "Es spielt eine spezialisierte Rolle im Körpererhalt",
    quizOption2: "Es arbeitet völlig unabhängig",
    quizOption3: "Es ist nur während des Schlafs aktiv",
    systemModalText: "Verfolgen Sie die Verbindung zum restlichen Körper.",
    animationModalText: "Folgen Sie den hervorgehobenen Strukturen, drehen Sie das Präparat und verbinden Sie Form mit Funktion. Dieser kurze Studienmoment baut ein dauerhaftes mentales Modell auf.",
    continueExploring: "Weiter erkunden",
    langName: "Deutsch",
  },
  ar: {
    brandTitle: "أناتومي أتيلييه",
    brandTagline: "تعلّم التشريح بأسلوب فني",
    navExplore: "استكشاف",
    navSystems: "الأجهزة",
    navLessons: "الدروس",
    navLibrary: "المكتبة",
    navNotes: "الملاحظات",
    searchPlaceholder: "ابحث عن الأعضاء والتقاطيع…",
    organLibrary: "مكتبة الأعضاء",
    savedOrgans: "الأعضاء المحفوظة",
    viewAllOrgans: "عرض جميع الأعضاء",
    quoteLine1: "التعلم هو",
    quoteLine2: "تعبير عن الفضول.",
    keepExploring: "واصل الاستكشاف!",
    keyFacts: "حقائق رئيسية",
    size: "الحجم",
    weight: "الوزن",
    daily: "النشاط اليومي",
    location: "الموقع",
    bloodSupply: "إمداد الدم",
    function: "الوظيفة",
    medicalImportance: "الأهمية الطبية",
    didYouKnow: "هل تعلم",
    viewLesson: "عرض الدرس",
    animate: "تحريك",
    quiz: "اختبار",
    compare: "مقارنة",
    comparing: "المقارن",
    reference: "المرجع",
    vs: "مقابل",
    primaryRole: "الدور الرئيسي",
    scale: "الحجم المقياسي",
    closeComparison: "إغلاق المقارنة",
    microscopicView: "منظر مجهري",
    exploreTissue: "استكشاف النسيج",
    compareOrgans: "مقارنة الأعضاء",
    openComparison: "فتح المقارنة",
    functionAnimation: "تحريك الوظيفة",
    playAnimation: "تشغيل التحريك",
    clinicalNotes: "ملاحظات سريرية",
    commonConditions: "حالات مرضية شائعة",
    seeAll: "عرض الكل",
    whereItWorks: "نطاق العمل",
    seeTheSystem: "استكشاف الجهاز",
    toolRotate: "تدوير",
    toolZoom: "تكبير",
    toolIsolate: "عزل",
    toolSection: "مقطع عرضي",
    toolLayers: "طبقات",
    toolCompare: "مقارنة",
    toolReset: "إعادة ضبط",
    tipTitle: "تلميح",
    tipDrag: "اسحب للتدوير",
    tipScroll: "مرر للتكبير",
    tipClickDot: "انقر فوق نقطة لمعرفة التفاصيل",
    autoRotate: "تدوير تلقائي",
    preparing: "جاري تحضير",
    specimenCaption: "عينة ثلاثية الأبعاد · انقر على نقطة للاستكشاف",
    guidedDiscovery: "استكشاف موجه",
    quickQuizTitle: "اختبار سريع",
    inMotionTitle: "في حالة حركة",
    inTheBodyTitle: "موقع العضو في الجسم",
    insideTitle: "داخل عضو",
    quizQuestion: "أي من العبارات التالية تصف العضو بشكل أفضل؟",
    quizOption1: "يلعب دوراً متخصصاً في الحفاظ على الوظائف الحيوية للجسم",
    quizOption2: "يعمل بشكل مستقل تماماً عن بقية الأعضاء",
    quizOption3: "ينشط فقط أثناء النوم العميق",
    systemModalText: "تتبع كيف يرتبط العضو بباقي أجهزة ودورة الجسم.",
    animationModalText: "اتبع الهياكل المظللة، وقم بتدوير العينة، وربط الشكل بالوظيفة لبناء استيعاب تشريحي فائق الدقة.",
    continueExploring: "متابعة الاستكشاف",
    langName: "العربية",
  },
};
