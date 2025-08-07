/**
 * TUI Hooks Index
 * Custom hooks for TUI state management and interactions
 * Note: Hooks are placeholders for future implementation
 */

// Placeholder hook functions to prevent compilation errors
export const useComponentState = () => ({ state: null, setState: () => {} });
export const useTheme = () => ({ theme: 'default', setTheme: () => {} });
export const useKeyBindings = () => ({ bindings: {}, addBinding: () => {} });
export const useFocus = () => ({ focused: false, setFocus: () => {} });
export const useResize = () => ({ size: { width: 0, height: 0 }, onResize: () => {} });
export const useNotifications = () => ({ notifications: [], addNotification: () => {} });
export const useAgents = () => ({ agents: [], loadAgents: () => {} });
export const useFileTree = () => ({ tree: null, loadTree: () => {} });
export const useLogs = () => ({ logs: [], addLog: () => {} });
export const useDebounce = (value: any, delay: number) => value;
export const useLocalStorage = (key: string, defaultValue: any) => [defaultValue, () => {}];
export const useEventEmitter = () => ({ emit: () => {}, on: () => {}, off: () => {} });
