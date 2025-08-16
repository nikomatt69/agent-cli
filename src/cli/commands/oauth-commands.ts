import chalk from 'chalk';
import boxen from 'boxen';
import * as readline from 'readline';
import { oauthService } from '../services/oauth-service';
import { simpleConfigManager as configManager } from '../core/config-manager';

export class OAuthCommands {
  static async showOAuthStatus(): Promise<void> {
    console.log(chalk.blue('\n🔐 OAuth Status'));
    console.log(chalk.gray('─'.repeat(40)));

    const providers = configManager.getOAuthProviders();
    
    if (providers.length === 0) {
      console.log(chalk.yellow('⚠️ No OAuth providers configured'));
      return;
    }

    for (const provider of providers) {
      const status = provider.enabled ? 
        (provider.hasToken ? chalk.green('✅ Authenticated') : chalk.yellow('⚠️ Enabled but not authenticated')) :
        chalk.red('❌ Disabled');
      
      console.log(`${chalk.cyan(provider.name)}: ${status}`);
    }
  }

  static async setupOAuth(): Promise<void> {
    console.log(chalk.blue('\n🔐 OAuth Setup'));
    console.log(chalk.gray('─'.repeat(40)));

    const oauthBox = boxen(
      chalk.white.bold('Choose your OAuth provider:\n\n') +
      chalk.green('1.') + chalk.white(' Claude.ai (Anthropic)\n') +
      chalk.gray('   • Login with your Claude.ai account\n') +
      chalk.gray('   • Use your Claude subscription\n\n') +
      chalk.blue('2.') + chalk.white(' OpenAI\n') +
      chalk.gray('   • Login with your OpenAI account\n') +
      chalk.gray('   • Use your OpenAI subscription\n\n') +
      chalk.yellow('3.') + chalk.white(' Both (Recommended)\n') +
      chalk.gray('   • Setup both providers for maximum flexibility\n\n') +
      chalk.red('4.') + chalk.white(' Cancel'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        backgroundColor: '#1a2e1a'
      }
    );

    console.log(oauthBox);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const choice: string = await new Promise(resolve =>
      rl.question(chalk.cyan('\nSelect OAuth provider (1-4): '), resolve)
    );
    rl.close();

    try {
      // Start OAuth server
      await oauthService.startServer();

      let claudeToken = null;
      let openaiToken = null;

      switch (choice.trim()) {
        case '1':
          console.log(chalk.green('\n🔐 Authenticating with Claude.ai...'));
          claudeToken = await oauthService.authenticateWithClaude();
          break;
        case '2':
          console.log(chalk.blue('\n🔐 Authenticating with OpenAI...'));
          openaiToken = await oauthService.authenticateWithOpenAI();
          break;
        case '3':
          console.log(chalk.green('\n🔐 Authenticating with Claude.ai...'));
          claudeToken = await oauthService.authenticateWithClaude();
          console.log(chalk.blue('\n🔐 Authenticating with OpenAI...'));
          openaiToken = await oauthService.authenticateWithOpenAI();
          break;
        case '4':
        default:
          console.log(chalk.yellow('⚠️ OAuth setup cancelled'));
          await oauthService.stopServer();
          return;
      }

      // Save tokens and configure environment
      if (claudeToken) {
        console.log(chalk.green('✅ Claude.ai authentication successful'));
        await oauthService.saveOAuthToken('claude', claudeToken);
        configManager.enableOAuthProvider('claude');
        process.env.ANTHROPIC_API_KEY = claudeToken.access_token;
      }

      if (openaiToken) {
        console.log(chalk.blue('✅ OpenAI authentication successful'));
        await oauthService.saveOAuthToken('openai', openaiToken);
        configManager.enableOAuthProvider('openai');
        process.env.OPENAI_API_KEY = openaiToken.access_token;
      }

      // Stop OAuth server
      await oauthService.stopServer();

      if (claudeToken || openaiToken) {
        console.log(chalk.green('\n🎉 OAuth setup completed successfully!'));
      } else {
        console.log(chalk.yellow('\n⚠️ OAuth authentication failed'));
      }

    } catch (error) {
      console.log(chalk.red(`❌ OAuth setup failed: ${error}`));
      await oauthService.stopServer();
    }
  }

  static async removeOAuthToken(provider?: string): Promise<void> {
    console.log(chalk.blue('\n🗑️ Remove OAuth Token'));
    console.log(chalk.gray('─'.repeat(40)));

    const providers = configManager.getOAuthProviders();
    const authenticatedProviders = providers.filter(p => p.hasToken);

    if (authenticatedProviders.length === 0) {
      console.log(chalk.yellow('⚠️ No authenticated OAuth providers found'));
      return;
    }

    let targetProvider = provider;

    if (!targetProvider) {
      console.log(chalk.white('Authenticated providers:'));
      authenticatedProviders.forEach((p, index) => {
        console.log(`${chalk.cyan(index + 1)}. ${p.name}`);
      });

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const choice: string = await new Promise(resolve =>
        rl.question(chalk.cyan('\nSelect provider to remove (or "all"): '), resolve)
      );
      rl.close();

      if (choice.toLowerCase() === 'all') {
        for (const p of authenticatedProviders) {
          configManager.removeOAuthToken(p.name);
          console.log(chalk.green(`✅ Removed ${p.name} token`));
        }
        console.log(chalk.green('\n🎉 All OAuth tokens removed'));
        return;
      }

      const index = parseInt(choice) - 1;
      if (index >= 0 && index < authenticatedProviders.length) {
        targetProvider = authenticatedProviders[index].name;
      } else {
        console.log(chalk.red('❌ Invalid selection'));
        return;
      }
    }

    if (targetProvider) {
      configManager.removeOAuthToken(targetProvider);
      console.log(chalk.green(`✅ Removed ${targetProvider} token`));
    }
  }

  static async refreshOAuthToken(provider?: string): Promise<void> {
    console.log(chalk.blue('\n🔄 Refresh OAuth Token'));
    console.log(chalk.gray('─'.repeat(40)));

    const providers = configManager.getOAuthProviders();
    const authenticatedProviders = providers.filter(p => p.hasToken);

    if (authenticatedProviders.length === 0) {
      console.log(chalk.yellow('⚠️ No authenticated OAuth providers found'));
      return;
    }

    let targetProvider = provider;

    if (!targetProvider) {
      console.log(chalk.white('Authenticated providers:'));
      authenticatedProviders.forEach((p, index) => {
        console.log(`${chalk.cyan(index + 1)}. ${p.name}`);
      });

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const choice: string = await new Promise(resolve =>
        rl.question(chalk.cyan('\nSelect provider to refresh: '), resolve)
      );
      rl.close();

      const index = parseInt(choice) - 1;
      if (index >= 0 && index < authenticatedProviders.length) {
        targetProvider = authenticatedProviders[index].name;
      } else {
        console.log(chalk.red('❌ Invalid selection'));
        return;
      }
    }

    if (targetProvider) {
      console.log(chalk.yellow(`🔄 Refreshing ${targetProvider} token...`));
      
      try {
        // Start OAuth server
        await oauthService.startServer();

        let token = null;
        if (targetProvider === 'claude') {
          token = await oauthService.authenticateWithClaude();
        } else if (targetProvider === 'openai') {
          token = await oauthService.authenticateWithOpenAI();
        }

        if (token) {
          await oauthService.saveOAuthToken(targetProvider, token);
          console.log(chalk.green(`✅ ${targetProvider} token refreshed successfully`));
        } else {
          console.log(chalk.red(`❌ Failed to refresh ${targetProvider} token`));
        }

        // Stop OAuth server
        await oauthService.stopServer();
      } catch (error) {
        console.log(chalk.red(`❌ Token refresh failed: ${error}`));
        await oauthService.stopServer();
      }
    }
  }

  static showHelp(): void {
    const helpBox = boxen(
      chalk.white.bold('OAuth Commands:\n\n') +
      chalk.cyan('/oauth status') + chalk.gray(' - Show OAuth provider status\n') +
      chalk.cyan('/oauth setup') + chalk.gray(' - Setup OAuth authentication\n') +
      chalk.cyan('/oauth remove [provider]') + chalk.gray(' - Remove OAuth token\n') +
      chalk.cyan('/oauth refresh [provider]') + chalk.gray(' - Refresh OAuth token\n') +
      chalk.cyan('/oauth help') + chalk.gray(' - Show this help'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#1a1a2e'
      }
    );

    console.log(helpBox);
  }
}