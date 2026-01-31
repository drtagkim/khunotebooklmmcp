
export const NOTEBOOK_ENDPOINTS = {
    LIST: "wXbhsf",
    GET_DETAILS: "rLM1Ne",
    CREATE: "CCqFvf",
    RENAME: "s0tc2d",
    DELETE: "WWINqb",
    SOURCE_ADD: "izAoDd",
    SOURCE_GET: "hizoJc",
    SOURCE_FRESHNESS: "yR9Yof",
    SOURCE_SYNC: "FLmJqe",
    SOURCE_DELETE: "tGMBJ",
    SOURCE_RENAME: "b7Wfje",
    CONVERSATIONS: "hPTbtc",
    USER_SETTINGS: "hT54vc", // PREFERENCES
    NOTIFICATIONS: "ozz5Z", // SUBSCRIPTION
    APP_SETTINGS: "ZwVcOc",
    SUMMARY_GEN: "VfAZjd",
    SOURCE_GUIDE: "tr032e",
    RESEARCH_FAST: "Ljjv0c",
    RESEARCH_DEEP: "QA9ei",
    RESEARCH_POLL: "e3bVqc",
    RESEARCH_IMPORT: "LBwxtb",
    STUDIO_CREATE: "R7cb6c",
    STUDIO_POLL: "gArtLc",
    STUDIO_DELETE: "V5N4be",
    MIND_MAP_GEN: "yyryJe",
    MIND_MAP_SAVE: "CYK0Xb",
    MIND_MAP_LIST: "cFji9",
    MIND_MAP_DELETE: "AH0mwd",
} as const;

export const ARTIFACT_CODE_MAP = {
    AUDIO_OVERVIEW: 1,
    REPORT_DOC: 3,
    VIDEO_OVERVIEW: 5,
    INFOGRAPHIC_IMAGE: 6,
    PRESENTATION_SLIDES: 7,
    DATA_SHEET: 8,
    FLASHCARD_SET: 9,
} as const;

export const ARTIFACT_KEYS = {
    AUDIO: "audio",
    VIDEO: "video",
    MINDMAP: "mind_map",
    STUDY_GUIDE: "study_guide",
    QUIZ: "quiz",
    REPORT: "report",
    INFOGRAPHIC: "infographic",
    SLIDES: "slide_deck",
    TABLE: "google_sheets",
    CARDS: "flashcards",
} as const;

export const RESEARCH_STRATEGIES = {
    QUICK: "fast",
    COMPREHENSIVE: "deep",
} as const;
