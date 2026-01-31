export const RPC_IDS = {
    LIST_NOTEBOOKS: "wXbhsf",
    GET_NOTEBOOK: "rLM1Ne",
    CREATE_NOTEBOOK: "CCqFvf",
    RENAME_NOTEBOOK: "s0tc2d",
    DELETE_NOTEBOOK: "WWINqb",
    ADD_SOURCE: "izAoDd",
    GET_SOURCE: "hizoJc",
    CHECK_FRESHNESS: "yR9Yof",
    SYNC_DRIVE: "FLmJqe",
    DELETE_SOURCE: "tGMBJ",
    RENAME_SOURCE: "b7Wfje",
    GET_CONVERSATIONS: "hPTbtc",
    PREFERENCES: "hT54vc",
    SUBSCRIPTION: "ozz5Z",
    SETTINGS: "ZwVcOc",
    GET_SUMMARY: "VfAZjd",
    GET_SOURCE_GUIDE: "tr032e",
    START_FAST_RESEARCH: "Ljjv0c",
    START_DEEP_RESEARCH: "QA9ei",
    POLL_RESEARCH: "e3bVqc",
    IMPORT_RESEARCH: "LBwxtb",
    CREATE_STUDIO: "R7cb6c",
    POLL_STUDIO: "gArtLc",
    DELETE_STUDIO: "V5N4be",
    GENERATE_MIND_MAP: "yyryJe",
    SAVE_MIND_MAP: "CYK0Xb",
    LIST_MIND_MAPS: "cFji9",
    DELETE_MIND_MAP: "AH0mwd",
} as const;

export const RESULT_TYPES = {
    WEB: 1,
    GOOGLE_DOC: 2,
    GOOGLE_SLIDES: 3,
    DEEP_REPORT: 5,
    GOOGLE_SHEETS: 8,
} as const;

export const SOURCE_TYPES = {
    WEB: 1,
    DRIVE: 4,
} as const;

export const RESEARCH_MODES = {
    FAST: "fast",
    DEEP: "deep",
} as const;

export const STUDIO_TYPES = {
    AUDIO: "audio",
    VIDEO: "video",
    MIND_MAP: "mind_map",
    STUDY_GUIDE: "study_guide",
    QUIZ: "quiz",
    REPORT: "report",
    INFOGRAPHIC: "infographic",
    SLIDE_DECK: "slide_deck",
    DATA_TABLE: "google_sheets",
    FLASHCARDS: "flashcards",
} as const;

export const STUDIO_TYPE_CODES = {
    AUDIO: 1,
    REPORT: 3,
    VIDEO: 5,
    INFOGRAPHIC: 6,
    SLIDE_DECK: 7,
    DATA_TABLE: 8,
    FLASHCARDS: 9,
} as const;

export const AUDIO_FORMATS = {
    DEEP_DIVE: "deep_dive",
    BRIEF: "brief",
    CRITIQUE: "critique",
    DEBATE: "debate",
} as const;
