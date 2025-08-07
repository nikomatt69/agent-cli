"use strict";
/**
 * TUI Hooks Index
 * Custom hooks for TUI state management and interactions
 * Note: Hooks are placeholders for future implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEventEmitter = exports.useLocalStorage = exports.useDebounce = exports.useLogs = exports.useFileTree = exports.useAgents = exports.useNotifications = exports.useResize = exports.useFocus = exports.useKeyBindings = exports.useTheme = exports.useComponentState = void 0;
// Placeholder hook functions to prevent compilation errors
const useComponentState = () => ({ state: null, setState: () => { } });
exports.useComponentState = useComponentState;
const useTheme = () => ({ theme: 'default', setTheme: () => { } });
exports.useTheme = useTheme;
const useKeyBindings = () => ({ bindings: {}, addBinding: () => { } });
exports.useKeyBindings = useKeyBindings;
const useFocus = () => ({ focused: false, setFocus: () => { } });
exports.useFocus = useFocus;
const useResize = () => ({ size: { width: 0, height: 0 }, onResize: () => { } });
exports.useResize = useResize;
const useNotifications = () => ({ notifications: [], addNotification: () => { } });
exports.useNotifications = useNotifications;
const useAgents = () => ({ agents: [], loadAgents: () => { } });
exports.useAgents = useAgents;
const useFileTree = () => ({ tree: null, loadTree: () => { } });
exports.useFileTree = useFileTree;
const useLogs = () => ({ logs: [], addLog: () => { } });
exports.useLogs = useLogs;
const useDebounce = (value, delay) => value;
exports.useDebounce = useDebounce;
const useLocalStorage = (key, defaultValue) => [defaultValue, () => { }];
exports.useLocalStorage = useLocalStorage;
const useEventEmitter = () => ({ emit: () => { }, on: () => { }, off: () => { } });
exports.useEventEmitter = useEventEmitter;
