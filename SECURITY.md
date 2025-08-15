# SECURITY.md

## ⚠️ **BETA SOFTWARE - SECURITY WARNING** ⚠️

**NikCLI is currently in BETA version (v0.1.15-beta) and presents SIGNIFICANT SECURITY RISKS. Use at your own risk and peril.**

### 🚨 CRITICAL RISKS

- **Automatic execution of system commands** with possible elevated privileges
- **Autonomous file modification** without complete user control
- **Management of sensitive API keys** for external AI services
- **Full filesystem access** to the host system
- **Automatic Git operations** including unsupervised commits and pushes
- **NPM package installation** with potential vulnerabilities

### ⛔ DO NOT USE IN PRODUCTION ENVIRONMENTS

---

## 📋 Security Overview

NikCLI is an AI-based autonomous development assistant that combines:

- **AI Agents** with reasoning and planning capabilities
- **Shell command execution** with security control lists
- **File manipulation** with path validation
- **Integration with external AI providers** (Anthropic Claude, OpenAI GPT, Google Gemini)
- **Multi-agent orchestration** for complex development tasks

## 🔓 Identified Security Risks

### 1. **Unsupervised Command Execution**

```typescript
// The system can execute potentially dangerous commands
const DANGEROUS_COMMANDS = [
  "rm",
  "rmdir",
  "dd",
  "mkfs",
  "fdisk",
  "sudo",
  "su",
  "chmod",
  "chown",
  "chgrp",
];
```

**Risk**: Data loss, system compromise, privilege escalation

### 2. **API Key Management**

```typescript
// API keys stored in local configuration
ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY;
```

**Risk**: Credential exposure, unauthorized use of AI services

### 3. **Autonomous Filesystem Manipulation**

```typescript
// File operations with limited security controls
writeFile(), editFile(), multiEdit(), deleteFile();
```

**Risk**: Critical file overwriting, data loss, system corruption

### 4. **Unsupervised Git Operations**

```typescript
// Automatic Git operations
git_commit, git_push, git_reset;
```

**Risk**: History loss, unauthorized pushes, sensitive code exposure

### 5. **Dependency Installation**

```typescript
// Automatic package installation
npm_install, yarn_add;
```

**Risk**: Introduction of vulnerabilities, malware, backdoors

## 🛡️ Implemented Security Mechanisms

### 1. **Execution Policy System**

```typescript
export interface ExecutionPolicy {
  approval: "never" | "untrusted" | "on-failure" | "always";
  sandbox:
    | "read-only"
    | "workspace-write"
    | "system-write"
    | "danger-full-access";
  timeoutMs: number;
  maxRetries: number;
}
```

### 2. **Path Validation**

```typescript
// Directory traversal prevention
function sanitizePath(filePath: string, workingDir: string): string {
  const absolutePath = path.resolve(workingDir, normalizedPath);
  if (!absolutePath.startsWith(workingDirAbsolute)) {
    throw new Error("Path traversal detected");
  }
  return absolutePath;
}
```

### 3. **Command Control Lists**

```typescript
// Approved safe commands
const SAFE_COMMANDS = ["ls", "cat", "grep", "find", "npm", "git"];
// Detected dangerous patterns
const DANGEROUS_PATTERNS = [/rm\s+-rf/i, /;\s*rm/i, /eval\s+/i];
```

### 4. **Approval System**

```typescript
// User confirmation request for risky operations
if (!options.skipConfirmation) {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      message: "Confirm dangerous operation?",
    },
  ]);
}
```

### 5. **Configurable Security Modes**

```typescript
securityMode: 'safe' | 'default' | 'developer'
toolApprovalPolicies: {
  fileOperations: 'always' | 'risky' | 'never',
  gitOperations: 'always' | 'risky' | 'never',
  systemCommands: 'always' | 'risky' | 'never'
}
```

## 📋 Security Best Practices

### 1. **API Key Management**

- ✅ Use environment variables instead of configuration files
- ✅ Rotate API keys regularly
- ✅ Monitor API usage to detect suspicious activity
- ❌ Never commit API keys to version control
- ❌ Do not share API keys between different environments

### 2. **Security Configuration**

```bash
# Recommended secure configuration
export NIKCLI_SECURITY_MODE="safe"
export NIKCLI_APPROVAL_POLICY="always"
export NIKCLI_SANDBOX_MODE="workspace-write"
```

### 3. **Monitoring and Audit**

- ✅ Enable logging of all operations
- ✅ Regularly review execution logs
- ✅ Configure alerting for high-risk operations
- ✅ Maintain backups of critical configurations

### 4. **Environment Isolation**

```bash
# Run in isolated Docker container
docker run --rm -it \
  --read-only \
  --tmpfs /tmp \
  -v $(pwd):/workspace:rw \
  nikcli-container
```

### 5. **Principle of Least Privilege**

- ✅ Run with non-privileged user account
- ✅ Limit filesystem access
- ✅ Configure restrictive sandbox
- ✅ Disable unnecessary network operations

## 🔍 Audit Trail and Logging

### Available Security Logs

```typescript
// Policy decision logs
await logger.audit("execution_policy_decision", {
  command,
  decision,
  timestamp,
  sandbox,
  approvalPolicy,
});

// Operation history
getExecutionHistory({
  securityLevel: "dangerous",
  successOnly: false,
});
```

### Security Metrics

```typescript
getSecurityStats(): {
  totalOperations: number;
  safeOperations: number;
  confirmedOperations: number;
  dangerousOperations: number;
  pathValidationRate: number;
  userConfirmationRate: number;
}
```

## ⚡ Recommended Secure Configuration

### Minimum Configuration File (`~/.nikcli/config.json`)

```json
{
  "securityMode": "safe",
  "approvalPolicy": "moderate",
  "toolApprovalPolicies": {
    "fileOperations": "always",
    "gitOperations": "always",
    "packageOperations": "always",
    "systemCommands": "always",
    "networkRequests": "always"
  },
  "sessionSettings": {
    "autoApproveReadOnly": false,
    "batchApprovalEnabled": false
  },
  "sandbox": {
    "enabled": true,
    "allowFileSystem": true,
    "allowNetwork": false,
    "allowCommands": false
  }
}
```

### Secure Environment Variables

```bash
# API Keys (choose one or more providers)
export ANTHROPIC_API_KEY="your-secure-key"
export OPENAI_API_KEY="your-secure-key"
export GOOGLE_GENERATIVE_AI_API_KEY="your-secure-key"

# Security configurations
export NIKCLI_SECURITY_MODE="safe"
export NIKCLI_MAX_CONCURRENT_AGENTS="1"
export NIKCLI_REQUIRE_APPROVAL="true"
export NIKCLI_ENABLE_SANDBOX="true"
```

## 🚨 Vulnerability Reporting

### How to Report Security Issues

**DO NOT open public issues for security vulnerabilities.**

#### Preferred Method: Private Email

- **Email**: [insert security email]
- **Subject**: `[SECURITY] NikCLI Vulnerability Report`
- **Encryption**: Use PGP if possible

#### Information to Include

1. **Detailed description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** and attack scenarios
4. **Affected version** (include `npm list @cadcamfun/nikcli`)
5. **Operating system** and Node.js version
6. **Relevant logs** (remove sensitive information)

#### Report Template

```
SECURITY VULNERABILITY - NikCLI

Version: 0.1.15-beta
OS: [Operating System]
Node.js: [Version]

DESCRIPTION:
[Detailed description of the issue]

REPRODUCTION:
1. [Step 1]
2. [Step 2]
3. [Result]

IMPACT:
[Description of potential impact]

MITIGATION:
[Any temporary workarounds]
```

### Management Process

1. **Receipt confirmation** within 48 hours
2. **Initial assessment** within 7 days
3. **Patch development** based on severity
4. **Fix release** with security advisory
5. **Public credits** (if desired by reporter)

## 📊 Risk Matrix

| Component         | Risk       | Impact   | Probability | Mitigation                         |
| ----------------- | ---------- | -------- | ----------- | ---------------------------------- |
| Command Execution | **HIGH**   | Critical | Medium      | Whitelist, Sandbox, Approval       |
| File Operations   | **HIGH**   | High     | High        | Path Validation, User Confirmation |
| API Keys          | **MEDIUM** | High     | Low         | Env Variables, Rotation            |
| Git Operations    | **MEDIUM** | Medium   | Medium      | Approval, Backup                   |
| Network Access    | **LOW**    | Medium   | Low         | Sandbox, Proxy Controls            |

## 🔒 Development Environment Recommendations

### IDE Configuration

```json
// .vscode/settings.json
{
  "nikcli.securityMode": "safe",
  "nikcli.requireApproval": true,
  "nikcli.maxConcurrentAgents": 1,
  "nikcli.enableAuditLog": true
}
```

### Security Git Hooks

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Check for hardcoded API keys
if grep -r "ANTHROPIC_API_KEY\|OPENAI_API_KEY" --exclude-dir=node_modules .; then
    echo "ERROR: API keys detected in code"
    exit 1
fi
```

### Continuous Monitoring

```bash
# Monitoring script
#!/bin/bash
tail -f ~/.nikcli/audit.log | grep "dangerous\|failed\|security" | \
  while read line; do
    echo "[ALERT] $line" | mail -s "NikCLI Security Alert" admin@domain.com
  done
```

---

## ⚖️ Legal Disclaimer

**Using NikCLI in beta version involves significant risks. The authors and contributors assume no responsibility for:**

- Data loss or corruption
- System security compromise
- Unauthorized command execution
- Sensitive information exposure
- Direct or indirect damages resulting from software use

**By using this software, the user expressly accepts all associated risks and releases the authors from any liability.**

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last updated**: 2025-01-15  
**Document version**: 1.0  
**Software version**: 0.1.15-beta
