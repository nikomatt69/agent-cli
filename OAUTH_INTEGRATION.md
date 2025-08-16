# OAuth Integration for NikCLI

## Overview

NikCLI now supports OAuth authentication for Claude.ai and OpenAI, allowing users to authenticate with their accounts and use their subscription plans instead of API keys.

## Features

- **OAuth Authentication**: Login with Claude.ai and OpenAI accounts
- **Subscription Integration**: Use your existing subscription plans
- **Token Management**: Automatic token refresh and storage
- **Secure Storage**: Tokens are stored securely in the configuration
- **Fallback Support**: Falls back to API keys if OAuth is not available

## Setup

### During Onboarding

When you first run NikCLI, you'll be presented with authentication options:

1. **OAuth Login (Recommended)** - Login with your Claude.ai/OpenAI accounts
2. **API Keys (Manual setup)** - Use traditional API keys
3. **Ollama (Local models)** - Use local models without authentication

### Manual Setup

You can also set up OAuth later using the CLI commands:

```bash
# Show OAuth status
/oauth status

# Setup OAuth authentication
/oauth setup

# Remove OAuth tokens
/oauth remove [provider]

# Refresh OAuth tokens
/oauth refresh [provider]

# Show OAuth help
/oauth help
```

## OAuth Commands

### `/oauth status`
Shows the current status of OAuth providers:
- Which providers are enabled
- Whether tokens are available
- Authentication status

### `/oauth setup`
Interactive setup for OAuth authentication:
1. Choose provider (Claude.ai, OpenAI, or both)
2. Browser opens for authentication
3. Complete OAuth flow
4. Tokens are automatically saved

### `/oauth remove [provider]`
Remove OAuth tokens for a specific provider:
- `claude` - Remove Claude.ai tokens
- `openai` - Remove OpenAI tokens
- `all` - Remove all tokens

### `/oauth refresh [provider]`
Refresh OAuth tokens for a specific provider:
- Useful when tokens expire
- Opens browser for re-authentication
- Automatically updates stored tokens

## Configuration

OAuth settings are stored in the NikCLI configuration:

```json
{
  "oauth": {
    "enabled": true,
    "providers": {
      "claude": {
        "enabled": true,
        "scope": "read write",
        "tokenRefreshInterval": 3600000
      },
      "openai": {
        "enabled": true,
        "scope": "read write",
        "tokenRefreshInterval": 3600000
      }
    },
    "tokens": {
      "claude": {
        "access_token": "...",
        "expires_in": 3600,
        "token_type": "Bearer",
        "expires_at": 1234567890
      },
      "openai": {
        "access_token": "...",
        "expires_in": 3600,
        "token_type": "Bearer",
        "expires_at": 1234567890
      }
    }
  }
}
```

## How It Works

### OAuth Flow

1. **Server Start**: OAuth server starts on localhost (port 3000+)
2. **Browser Redirect**: User is redirected to provider's OAuth page
3. **Authentication**: User authenticates with their account
4. **Callback**: Provider redirects back to local server
5. **Token Exchange**: Server exchanges authorization code for access token
6. **Storage**: Token is securely stored in configuration
7. **Environment**: Token is set as environment variable for immediate use

### Token Management

- **Automatic Expiration**: Tokens are checked for expiration
- **Secure Storage**: Tokens are stored in encrypted configuration
- **Environment Variables**: Tokens are automatically set as environment variables
- **Fallback**: Falls back to API keys if OAuth tokens are not available

## Security

- **Local Server**: OAuth server runs only on localhost
- **Secure Storage**: Tokens are stored in encrypted configuration
- **Automatic Cleanup**: Expired tokens are automatically removed
- **No Persistence**: OAuth server is temporary and not persistent

## Troubleshooting

### Common Issues

1. **Browser doesn't open automatically**
   - Manually visit the URL shown in the terminal
   - Ensure you have a default browser set

2. **Authentication fails**
   - Check your internet connection
   - Ensure you have a valid account with the provider
   - Try refreshing the token with `/oauth refresh`

3. **Port conflicts**
   - The OAuth server automatically finds an available port
   - If issues persist, restart NikCLI

4. **Token expiration**
   - Use `/oauth refresh` to get new tokens
   - Tokens are automatically checked for expiration

### Debug Mode

For debugging OAuth issues, you can enable debug logging:

```bash
# Set debug level
/config log-level debug

# Check OAuth status
/oauth status
```

## Provider-Specific Information

### Claude.ai (Anthropic)

- **OAuth URL**: https://claude.ai/oauth/authorize
- **Token URL**: https://claude.ai/oauth/token
- **Scope**: read write
- **Features**: Use Claude subscription, access to Claude models

### OpenAI

- **OAuth URL**: https://platform.openai.com/oauth/authorize
- **Token URL**: https://platform.openai.com/oauth/token
- **Scope**: read write
- **Features**: Use OpenAI subscription, access to GPT models

## Migration from API Keys

If you're currently using API keys and want to switch to OAuth:

1. **Setup OAuth**: Run `/oauth setup`
2. **Verify Authentication**: Run `/oauth status`
3. **Remove API Keys**: Remove API keys from environment variables
4. **Test**: Verify that NikCLI works with OAuth tokens

## Future Enhancements

- **Additional Providers**: Support for more AI providers
- **Token Encryption**: Enhanced token encryption
- **Auto-refresh**: Automatic token refresh before expiration
- **Multi-account**: Support for multiple accounts per provider
- **SSO Integration**: Single Sign-On integration for enterprise users

## Support

For issues with OAuth integration:

1. Check the troubleshooting section above
2. Run `/oauth status` to verify configuration
3. Try `/oauth refresh` to get new tokens
4. Check the logs for detailed error messages
5. Report issues on the GitHub repository