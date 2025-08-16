"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthService = exports.OAuthService = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const events_1 = require("events");
const chalk_1 = __importDefault(require("chalk"));
const config_manager_1 = require("../core/config-manager");
class OAuthService extends events_1.EventEmitter {
    constructor() {
        super();
        this.port = 3000;
        this.server = (0, express_1.default)();
        this.setupServer();
    }
    setupServer() {
        this.server.use((0, cors_1.default)());
        this.server.use(express_1.default.json());
        this.server.use(express_1.default.urlencoded({ extended: true }));
        this.server.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });
    }
    async startServer() {
        return new Promise((resolve, reject) => {
            this.serverInstance = this.server.listen(this.port, () => {
                console.log(chalk_1.default.green(`✅ OAuth server started on port ${this.port}`));
                resolve(this.port);
            });
            this.serverInstance.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    this.port++;
                    this.startServer().then(resolve).catch(reject);
                }
                else {
                    reject(err);
                }
            });
        });
    }
    async stopServer() {
        if (this.serverInstance) {
            return new Promise((resolve) => {
                this.serverInstance.close(() => {
                    console.log(chalk_1.default.yellow('🛑 OAuth server stopped'));
                    resolve();
                });
            });
        }
    }
    async authenticateWithClaude() {
        const config = {
            clientId: 'claude-oauth-client',
            clientSecret: 'claude-secret',
            redirectUri: `http://localhost:${this.port}/auth/claude/callback`,
            authUrl: 'https://claude.ai/oauth/authorize',
            tokenUrl: 'https://claude.ai/oauth/token',
            scope: 'read write'
        };
        return this.performOAuthFlow(config, 'Claude.ai');
    }
    async authenticateWithOpenAI() {
        const config = {
            clientId: 'openai-oauth-client',
            clientSecret: 'openai-secret',
            redirectUri: `http://localhost:${this.port}/auth/openai/callback`,
            authUrl: 'https://platform.openai.com/oauth/authorize',
            tokenUrl: 'https://platform.openai.com/oauth/token',
            scope: 'read write'
        };
        return this.performOAuthFlow(config, 'OpenAI');
    }
    async performOAuthFlow(config, provider) {
        return new Promise(async (resolve) => {
            const authUrl = new URL(config.authUrl);
            authUrl.searchParams.set('client_id', config.clientId);
            authUrl.searchParams.set('redirect_uri', config.redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', config.scope);
            authUrl.searchParams.set('state', this.generateState());
            this.server.get(`/auth/${provider.toLowerCase()}/callback`, async (req, res) => {
                const { code, state, error } = req.query;
                if (error) {
                    console.log(chalk_1.default.red(`❌ OAuth error: ${error}`));
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
                        const token = await this.exchangeCodeForToken(code, config);
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
                    }
                    catch (error) {
                        console.log(chalk_1.default.red(`❌ Token exchange failed: ${error}`));
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
                }
                else {
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
            try {
                const { default: open } = await Promise.resolve().then(() => __importStar(require('open')));
                await open(authUrl.toString());
                console.log(chalk_1.default.cyan(`🌐 Opening ${provider} authentication in your browser...`));
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Could not open browser automatically. Please visit:`));
                console.log(chalk_1.default.blue(authUrl.toString()));
            }
        });
    }
    async exchangeCodeForToken(code, config) {
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
        const tokenData = await response.json();
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
    generateState() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    async saveOAuthToken(provider, token) {
        config_manager_1.simpleConfigManager.saveOAuthToken(provider, token);
        this.emit('tokenReceived', { provider, token });
    }
    async getOAuthToken(provider) {
        return config_manager_1.simpleConfigManager.getOAuthToken(provider);
    }
}
exports.OAuthService = OAuthService;
exports.oauthService = new OAuthService();
