import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import boxen from 'boxen';
import { simpleConfigManager as configManager } from '../core/config-manager';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export class OAuthService extends EventEmitter {
  private server: express.Application;
  private serverInstance: any;
  private port: number = 3000;

  constructor() {
    super();
    this.server = express();
    this.setupServer();
  }

  private setupServer() {
    this.server.use(cors());
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.server.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  async startServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.serverInstance = this.server.listen(this.port, () => {
        console.log(chalk.green(`✅ OAuth server started on port ${this.port}`));
        resolve(this.port);
      });

      this.serverInstance.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          this.port++;
          this.startServer().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  async stopServer(): Promise<void> {
    if (this.serverInstance) {
      return new Promise((resolve) => {
        this.serverInstance.close(() => {
          console.log(chalk.yellow('🛑 OAuth server stopped'));
          resolve();
        });
      });
    }
  }

  async authenticateWithClaude(): Promise<OAuthToken | null> {
    const config: OAuthConfig = {
      clientId: 'claude-oauth-client', // Placeholder - would need real Claude OAuth app
      clientSecret: 'claude-secret',
      redirectUri: `http://localhost:${this.port}/auth/claude/callback`,
      authUrl: 'https://claude.ai/oauth/authorize',
      tokenUrl: 'https://claude.ai/oauth/token',
      scope: 'read write'
    };

    return this.performOAuthFlow(config, 'Claude.ai');
  }

  async authenticateWithOpenAI(): Promise<OAuthToken | null> {
    const config: OAuthConfig = {
      clientId: 'openai-oauth-client', // Placeholder - would need real OpenAI OAuth app
      clientSecret: 'openai-secret',
      redirectUri: `http://localhost:${this.port}/auth/openai/callback`,
      authUrl: 'https://platform.openai.com/oauth/authorize',
      tokenUrl: 'https://platform.openai.com/oauth/token',
      scope: 'read write'
    };

    return this.performOAuthFlow(config, 'OpenAI');
  }

  private async performOAuthFlow(config: OAuthConfig, provider: string): Promise<OAuthToken | null> {
    return new Promise(async (resolve) => {
      const authUrl = new URL(config.authUrl);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', config.scope);
      authUrl.searchParams.set('state', this.generateState());

      // Setup callback handler
      this.server.get(`/auth/${provider.toLowerCase()}/callback`, async (req, res) => {
        const { code, state, error } = req.query;

        if (error) {
          console.log(chalk.red(`❌ OAuth error: ${error}`));
          res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #e74c3c;">Authentication Failed</h2>
                <p>Error: ${error}</p>
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);
          resolve(null);
          return;
        }

        if (code) {
          try {
            const token = await this.exchangeCodeForToken(code as string, config);
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2 style="color: #27ae60;">Authentication Successful!</h2>
                  <p>You have successfully authenticated with ${provider}.</p>
                  <p>You can close this window and return to NikCLI.</p>
                </body>
              </html>
            `);
            resolve(token);
          } catch (error) {
            console.log(chalk.red(`❌ Token exchange failed: ${error}`));
            res.send(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2 style="color: #e74c3c;">Authentication Failed</h2>
                  <p>Failed to exchange authorization code for token.</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
            resolve(null);
          }
        } else {
          res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #e74c3c;">Authentication Failed</h2>
                <p>No authorization code received.</p>
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);
          resolve(null);
        }
      });

      // Open browser
      try {
        const { default: open } = await import('open');
        await open(authUrl.toString());
        console.log(chalk.cyan(`🌐 Opening ${provider} authentication in your browser...`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Could not open browser automatically. Please visit:`));
        console.log(chalk.blue(authUrl.toString()));
      }
    });
  }

  private async exchangeCodeForToken(code: string, config: OAuthConfig): Promise<OAuthToken> {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json() as any;
    
    // Validate and transform the response to match OAuthToken interface
    if (!tokenData.access_token || !tokenData.expires_in || !tokenData.token_type) {
      throw new Error('Invalid token response: missing required fields');
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Helper method to save OAuth tokens securely
  async saveOAuthToken(provider: string, token: OAuthToken): Promise<void> {
    // Save token to config manager
    configManager.saveOAuthToken(provider, token);
    this.emit('tokenReceived', { provider, token });
  }

  // Helper method to get stored OAuth tokens
  async getOAuthToken(provider: string): Promise<OAuthToken | null> {
    return configManager.getOAuthToken(provider);
  }
}

export const oauthService = new OAuthService();