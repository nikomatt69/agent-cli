#!/usr/bin/env ts-node

/**
 * Esempio di utilizzo del sistema VM Integration di NikCLI
 * 
 * Questo esempio mostra come utilizzare il sistema di agenti autonomi
 * in VM containerizzate per analisi repository e task di sviluppo.
 */

import { vmIntegration } from '../src/cli/core/vm-integration';
import { AutonomousVMAgent } from '../src/cli/automation/agents/autonomous-vm-agent';
import { agentStatusUI } from '../src/cli/ui/agent-status-ui';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('🚀 NikCLI VM Integration Example\n'));

  try {
    // 1. Inizializza il sistema VM
    console.log(chalk.cyan('1. Inizializzazione sistema VM...'));
    await vmIntegration.initialize();
    agentStatusUI.initialize();
    console.log(chalk.green('✅ Sistema VM inizializzato\n'));

    // 2. Crea un agente VM autonomo
    console.log(chalk.cyan('2. Creazione agente VM autonomo...'));
    const agent = new AutonomousVMAgent(process.cwd());
    await agent.initialize();
    console.log(chalk.green('✅ Agente VM creato\n'));

    // 3. Esempio: Analisi repository
    console.log(chalk.cyan('3. Esempio: Analisi repository...'));
    const repositoryUrl = 'https://github.com/example/test-repo';
    const analysisPrompt = 'analizza la repository e verifica la sicurezza del codice, controlla le dipendenze e genera un report';

    const analysisResults = await vmIntegration.handleRepositoryAnalysis(
      repositoryUrl, 
      analysisPrompt
    );
    console.log(chalk.green('✅ Analisi repository completata\n'));

    // 4. Esempio: Task autonomo personalizzato
    console.log(chalk.cyan('4. Esempio: Task autonomo personalizzato...'));
    const customTask = {
      type: 'custom' as const,
      description: 'Test di installazione e build di un progetto Node.js',
      commands: [
        'npm install',
        'npm run build',
        'npm test',
        'echo "Task completato con successo" > result.txt'
      ],
      requirements: {
        vscode: true,
        node: true,
        memory: '2g'
      }
    };

    const taskResults = await agent.executeAutonomousTask(customTask);
    console.log(chalk.green('✅ Task autonomo completato\n'));

    // 5. Mostra stato del sistema
    console.log(chalk.cyan('5. Stato del sistema:'));
    const status = vmIntegration.getStatus();
    console.log(chalk.white(`   - VM Attive: ${status.activeVMs}`));
    console.log(chalk.white(`   - Task Attivi: ${status.activeTasks}`));
    console.log(chalk.white(`   - Sistema Abilitato: ${status.enabled ? 'Sì' : 'No'}`));

    if (status.vmAgentStatus) {
      console.log(chalk.white(`   - VM Create: ${status.vmAgentStatus.metrics?.vmsCreated || 0}`));
      console.log(chalk.white(`   - Task Completati: ${status.vmAgentStatus.metrics?.tasksCompleted || 0}`));
      console.log(chalk.white(`   - Task Falliti: ${status.vmAgentStatus.metrics?.tasksFailed || 0}`));
    }
    console.log();

    // 6. Esempio: Gestione VM tramite comandi
    console.log(chalk.cyan('6. Esempio: Gestione VM...'));
    
    // Lista VM attive
    const vms = vmIntegration.listVMs();
    console.log(chalk.white(`   VM attive: ${vms.length}`));
    
    // Crea una nuova VM
    const newVM = await vmIntegration.createVM({
      name: 'example-vm',
      memory: '1g',
      cpu: '1'
    });
    console.log(chalk.white(`   Nuova VM creata: ${newVM.id}`));

    // 7. Esempio: Monitoraggio UI
    console.log(chalk.cyan('7. Monitoraggio UI...'));
    const activeAgents = agentStatusUI.getActiveAgents();
    console.log(chalk.white(`   Agenti attivi: ${activeAgents.length}`));
    
    activeAgents.forEach(agent => {
      console.log(chalk.white(`   - ${agent.name} (${agent.type}): ${agent.status}`));
    });
    console.log();

    // 8. Cleanup
    console.log(chalk.cyan('8. Cleanup...'));
    await vmIntegration.cleanup();
    console.log(chalk.green('✅ Cleanup completato\n'));

    console.log(chalk.green.bold('🎉 Esempio completato con successo!'));
    console.log(chalk.gray('\nPer utilizzare il sistema nel CLI:'));
    console.log(chalk.gray('1. Avvia NikCLI: npm start'));
    console.log(chalk.gray('2. Scrivi: "analizza la repository https://github.com/user/repo"'));
    console.log(chalk.gray('3. Usa i comandi: /vm-status, /vm list, /vm logs <id>'));

  } catch (error: any) {
    console.error(chalk.red(`❌ Errore nell'esempio: ${error.message}`));
    console.error(chalk.gray(error.stack));
  }
}

// Esempi di utilizzo avanzato
async function advancedExamples() {
  console.log(chalk.blue.bold('\n🔧 Esempi Avanzati\n'));

  // Esempio 1: Analisi di sicurezza
  console.log(chalk.cyan('Esempio 1: Analisi di sicurezza'));
  const securityAnalysis = {
    type: 'repository-analysis' as const,
    description: 'Analisi completa di sicurezza del codice',
    repositoryUrl: 'https://github.com/example/secure-app',
    commands: [
      'npm audit',
      'npm audit fix',
      'npx snyk test',
      'npx eslint . --ext .js,.ts',
      'echo "Security analysis completed" > security-report.txt'
    ],
    requirements: {
      vscode: true,
      node: true,
      memory: '4g'
    }
  };

  // Esempio 2: Analisi di performance
  console.log(chalk.cyan('Esempio 2: Analisi di performance'));
  const performanceAnalysis = {
    type: 'custom' as const,
    description: 'Analisi e ottimizzazione delle performance',
    commands: [
      'npm install',
      'npm run build',
      'npx lighthouse --output=json --output-path=./lighthouse-report.json',
      'npx webpack-bundle-analyzer dist/stats.json',
      'echo "Performance analysis completed" > performance-report.txt'
    ],
    requirements: {
      vscode: true,
      node: true,
      memory: '4g'
    }
  };

  // Esempio 3: Code review automatico
  console.log(chalk.cyan('Esempio 3: Code review automatico'));
  const codeReview = {
    type: 'repository-analysis' as const,
    description: 'Code review automatico completo',
    repositoryUrl: 'https://github.com/example/codebase',
    commands: [
      'npm install',
      'npm run lint',
      'npm run test',
      'npx sonarqube-scanner',
      'npx codeclimate-test-reporter < coverage/lcov.info',
      'echo "Code review completed" > review-report.txt'
    ],
    requirements: {
      vscode: true,
      node: true,
      memory: '4g'
    }
  };

  console.log(chalk.gray('\nQuesti esempi possono essere eseguiti nel CLI principale'));
}

// Esegui gli esempi
if (require.main === module) {
  main().then(() => {
    advancedExamples();
  }).catch(console.error);
}

export { main, advancedExamples };