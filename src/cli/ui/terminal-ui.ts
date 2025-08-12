export { AdvancedCliUI, advancedUI } from './advanced-cli-ui';
export type { StatusIndicator, LiveUpdate, UITheme, StructuredPanel } from './advanced-cli-ui';

export { DiffViewer } from './diff-viewer';
export type { FileDiff, DiffOptions } from './diff-viewer';

export { diffManager, DiffManager } from './diff-manager';

export { approvalSystem, ApprovalSystem } from './approval-system';
export type { ApprovalRequest, ApprovalResponse, ApprovalConfig, ApprovalAction } from './approval-system';

export { CliUI } from '../utils/cli-ui';
export {
  success,
  error,
  warning,
  info,
  highlight,
  dim,
  bold,
  section,
  subsection,
  startSpinner,
  updateSpinner,
  succeedSpinner,
  failSpinner,
  stopSpinner,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logSection,
  logSubsection,
  logProgress,
  logKeyValue,
  formatError,
  logCommandStart,
  logCommandSuccess,
  logCommandError
} from '../utils/cli-ui';

export { TextWrapper } from '../utils/text-wrapper';
export {
  wrapBlue,
  wrapCyan,
  formatStatus,
  formatCommand,
  formatFileOp,
  formatProgress,
  formatAgent,
  formatSearch
} from '../utils/text-wrapper';