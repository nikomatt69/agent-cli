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
exports.OAuthCommands = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const readline = __importStar(require("readline"));
const oauth_service_1 = require("../services/oauth-service");
const config_manager_1 = require("../core/config-manager");
class OAuthCommands {
    static async showOAuthStatus() {
        console.log(chalk_1.default.blue('\n🔐 OAuth Status'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const providers = config_manager_1.simpleConfigManager.getOAuthProviders();
        if (providers.length === 0) {
            console.log(chalk_1.default.yellow('⚠️ No OAuth providers configured'));
            return;
        }
        for (const provider of providers) {
            const status = provider.enabled ?
                (provider.hasToken ? chalk_1.default.green('✅ Authenticated') : chalk_1.default.yellow('⚠️ Enabled but not authenticated')) :
                chalk_1.default.red('❌ Disabled');
            console.log(`${chalk_1.default.cyan(provider.name)}: ${status}`);
        }
    }
    static async setupOAuth() {
        console.log(chalk_1.default.blue('\n🔐 OAuth Setup'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const oauthBox = (0, boxen_1.default)(chalk_1.default.white.bold('Choose your OAuth provider:\n\n') +
            chalk_1.default.green('1.') + chalk_1.default.white(' Claude.ai (Anthropic)\n') +
            chalk_1.default.gray('   • Login with your Claude.ai account\n') +
            chalk_1.default.gray('   • Use your Claude subscription\n\n') +
            chalk_1.default.blue('2.') + chalk_1.default.white(' OpenAI\n') +
            chalk_1.default.gray('   • Login with your OpenAI account\n') +
            chalk_1.default.gray('   • Use your OpenAI subscription\n\n') +
            chalk_1.default.yellow('3.') + chalk_1.default.white(' Both (Recommended)\n') +
            chalk_1.default.gray('   • Setup both providers for maximum flexibility\n\n') +
            chalk_1.default.red('4.') + chalk_1.default.white(' Cancel'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            backgroundColor: '#1a2e1a'
        });
        console.log(oauthBox);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const choice = await new Promise(resolve => rl.question(chalk_1.default.cyan('\nSelect OAuth provider (1-4): '), resolve));
        rl.close();
        try {
            await oauth_service_1.oauthService.startServer();
            let claudeToken = null;
            let openaiToken = null;
            switch (choice.trim()) {
                case '1':
                    console.log(chalk_1.default.green('\n🔐 Authenticating with Claude.ai...'));
                    claudeToken = await oauth_service_1.oauthService.authenticateWithClaude();
                    break;
                case '2':
                    console.log(chalk_1.default.blue('\n🔐 Authenticating with OpenAI...'));
                    openaiToken = await oauth_service_1.oauthService.authenticateWithOpenAI();
                    break;
                case '3':
                    console.log(chalk_1.default.green('\n🔐 Authenticating with Claude.ai...'));
                    claudeToken = await oauth_service_1.oauthService.authenticateWithClaude();
                    console.log(chalk_1.default.blue('\n🔐 Authenticating with OpenAI...'));
                    openaiToken = await oauth_service_1.oauthService.authenticateWithOpenAI();
                    break;
                case '4':
                default:
                    console.log(chalk_1.default.yellow('⚠️ OAuth setup cancelled'));
                    await oauth_service_1.oauthService.stopServer();
                    return;
            }
            if (claudeToken) {
                console.log(chalk_1.default.green('✅ Claude.ai authentication successful'));
                await oauth_service_1.oauthService.saveOAuthToken('claude', claudeToken);
                config_manager_1.simpleConfigManager.enableOAuthProvider('claude');
                process.env.ANTHROPIC_API_KEY = claudeToken.access_token;
            }
            if (openaiToken) {
                console.log(chalk_1.default.blue('✅ OpenAI authentication successful'));
                await oauth_service_1.oauthService.saveOAuthToken('openai', openaiToken);
                config_manager_1.simpleConfigManager.enableOAuthProvider('openai');
                process.env.OPENAI_API_KEY = openaiToken.access_token;
            }
            await oauth_service_1.oauthService.stopServer();
            if (claudeToken || openaiToken) {
                console.log(chalk_1.default.green('\n🎉 OAuth setup completed successfully!'));
            }
            else {
                console.log(chalk_1.default.yellow('\n⚠️ OAuth authentication failed'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ OAuth setup failed: ${error}`));
            await oauth_service_1.oauthService.stopServer();
        }
    }
    static async removeOAuthToken(provider) {
        console.log(chalk_1.default.blue('\n🗑️ Remove OAuth Token'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const providers = config_manager_1.simpleConfigManager.getOAuthProviders();
        const authenticatedProviders = providers.filter(p => p.hasToken);
        if (authenticatedProviders.length === 0) {
            console.log(chalk_1.default.yellow('⚠️ No authenticated OAuth providers found'));
            return;
        }
        let targetProvider = provider;
        if (!targetProvider) {
            console.log(chalk_1.default.white('Authenticated providers:'));
            authenticatedProviders.forEach((p, index) => {
                console.log(`${chalk_1.default.cyan(index + 1)}. ${p.name}`);
            });
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const choice = await new Promise(resolve => rl.question(chalk_1.default.cyan('\nSelect provider to remove (or "all"): '), resolve));
            rl.close();
            if (choice.toLowerCase() === 'all') {
                for (const p of authenticatedProviders) {
                    config_manager_1.simpleConfigManager.removeOAuthToken(p.name);
                    console.log(chalk_1.default.green(`✅ Removed ${p.name} token`));
                }
                console.log(chalk_1.default.green('\n🎉 All OAuth tokens removed'));
                return;
            }
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < authenticatedProviders.length) {
                targetProvider = authenticatedProviders[index].name;
            }
            else {
                console.log(chalk_1.default.red('❌ Invalid selection'));
                return;
            }
        }
        if (targetProvider) {
            config_manager_1.simpleConfigManager.removeOAuthToken(targetProvider);
            console.log(chalk_1.default.green(`✅ Removed ${targetProvider} token`));
        }
    }
    static async refreshOAuthToken(provider) {
        console.log(chalk_1.default.blue('\n🔄 Refresh OAuth Token'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const providers = config_manager_1.simpleConfigManager.getOAuthProviders();
        const authenticatedProviders = providers.filter(p => p.hasToken);
        if (authenticatedProviders.length === 0) {
            console.log(chalk_1.default.yellow('⚠️ No authenticated OAuth providers found'));
            return;
        }
        let targetProvider = provider;
        if (!targetProvider) {
            console.log(chalk_1.default.white('Authenticated providers:'));
            authenticatedProviders.forEach((p, index) => {
                console.log(`${chalk_1.default.cyan(index + 1)}. ${p.name}`);
            });
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const choice = await new Promise(resolve => rl.question(chalk_1.default.cyan('\nSelect provider to refresh: '), resolve));
            rl.close();
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < authenticatedProviders.length) {
                targetProvider = authenticatedProviders[index].name;
            }
            else {
                console.log(chalk_1.default.red('❌ Invalid selection'));
                return;
            }
        }
        if (targetProvider) {
            console.log(chalk_1.default.yellow(`🔄 Refreshing ${targetProvider} token...`));
            try {
                await oauth_service_1.oauthService.startServer();
                let token = null;
                if (targetProvider === 'claude') {
                    token = await oauth_service_1.oauthService.authenticateWithClaude();
                }
                else if (targetProvider === 'openai') {
                    token = await oauth_service_1.oauthService.authenticateWithOpenAI();
                }
                if (token) {
                    await oauth_service_1.oauthService.saveOAuthToken(targetProvider, token);
                    console.log(chalk_1.default.green(`✅ ${targetProvider} token refreshed successfully`));
                }
                else {
                    console.log(chalk_1.default.red(`❌ Failed to refresh ${targetProvider} token`));
                }
                await oauth_service_1.oauthService.stopServer();
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Token refresh failed: ${error}`));
                await oauth_service_1.oauthService.stopServer();
            }
        }
    }
    static showHelp() {
        const helpBox = (0, boxen_1.default)(chalk_1.default.white.bold('OAuth Commands:\n\n') +
            chalk_1.default.cyan('/oauth status') + chalk_1.default.gray(' - Show OAuth provider status\n') +
            chalk_1.default.cyan('/oauth setup') + chalk_1.default.gray(' - Setup OAuth authentication\n') +
            chalk_1.default.cyan('/oauth remove [provider]') + chalk_1.default.gray(' - Remove OAuth token\n') +
            chalk_1.default.cyan('/oauth refresh [provider]') + chalk_1.default.gray(' - Refresh OAuth token\n') +
            chalk_1.default.cyan('/oauth help') + chalk_1.default.gray(' - Show this help'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            backgroundColor: '#1a1a2e'
        });
        console.log(helpBox);
    }
}
exports.OAuthCommands = OAuthCommands;
