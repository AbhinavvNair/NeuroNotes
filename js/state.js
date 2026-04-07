// Shared mutable state across all modules.
// Import this object and mutate its properties directly.
export const state = {
    currentRawResponse: "",
    historyNotes: [],
    historyDisplayCount: 10,
    savedNotesData: [],
    lastGeneratedNoteId: null,
};
