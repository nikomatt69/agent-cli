"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStore = void 0;
const zustand_1 = require("zustand");
exports.useStore = (0, zustand_1.create)((set) => ({
    analysisHistory: [],
    addAnalysis: (code, analysis) => set((state) => ({
        analysisHistory: [
            ...state.analysisHistory,
            { code, analysis, timestamp: new Date().toISOString() },
        ],
    })),
    clearHistory: () => set({ analysisHistory: [] }),
}));
