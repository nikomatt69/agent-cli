"use strict";
/**
 * TUI Components Index
 * Centralized exports for all TUI components
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPONENT_DEFAULTS = exports.LogPanel = exports.AgentPanel = exports.ContentPanel = exports.SidebarPanel = exports.NotificationManager = exports.CommandPalette = exports.StatusBar = void 0;
// Core Components
var StatusBar_1 = require("./StatusBar");
Object.defineProperty(exports, "StatusBar", { enumerable: true, get: function () { return StatusBar_1.StatusBar; } });
var CommandPalette_1 = require("./CommandPalette");
Object.defineProperty(exports, "CommandPalette", { enumerable: true, get: function () { return CommandPalette_1.CommandPalette; } });
var NotificationManager_1 = require("./NotificationManager");
Object.defineProperty(exports, "NotificationManager", { enumerable: true, get: function () { return NotificationManager_1.NotificationManager; } });
// Panel Components
var SidebarPanel_1 = require("./SidebarPanel");
Object.defineProperty(exports, "SidebarPanel", { enumerable: true, get: function () { return SidebarPanel_1.SidebarPanel; } });
var ContentPanel_1 = require("./ContentPanel");
Object.defineProperty(exports, "ContentPanel", { enumerable: true, get: function () { return ContentPanel_1.ContentPanel; } });
var AgentPanel_1 = require("./AgentPanel");
Object.defineProperty(exports, "AgentPanel", { enumerable: true, get: function () { return AgentPanel_1.AgentPanel; } });
var LogPanel_1 = require("./LogPanel");
Object.defineProperty(exports, "LogPanel", { enumerable: true, get: function () { return LogPanel_1.LogPanel; } });
// Component Types
__exportStar(require("./types"), exports);
// Component utilities
exports.COMPONENT_DEFAULTS = {
    BORDER_STYLE: 'line',
    FOCUS_COLOR: 'yellow',
    NORMAL_COLOR: 'white'
};
