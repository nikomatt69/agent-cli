# 🐳 VM Integration System - NikCLI Enterprise

## Overview

Il sistema di integrazione VM di NikCLI trasforma il CLI in una piattaforma enterprise con agenti autonomi capaci di operare in VM containerizzate isolate. Questo sistema permette di eseguire analisi repository, test, e operazioni di sviluppo in ambienti completamente isolati e sicuri.

## 🚀 Caratteristiche Principali

### **Agenti Autonomi in VM**
- **Autonomous VM Agent**: Agente specializzato che opera in VM Docker isolate
- **Repository Analysis**: Analisi automatica di repository con creazione di pull request
- **Isolamento Completo**: Ogni operazione avviene in un ambiente Docker isolato
- **Auto-cleanup**: Pulizia automatica delle VM dopo il completamento dei task

### **UI Avanzata**
- **Icone Agenti Attivi**: Visualizzazione in tempo reale degli agenti attivi nel prompt
- **Pannelli Log**: Accesso ai log degli agenti tramite scorciatoie da tastiera
- **Status Real-time**: Monitoraggio dello stato delle VM e dei task

### **Integrazione Completa**
- **Comandi Slash**: Gestione VM tramite comandi `/vm`
- **Event System**: Sistema di eventi integrato con il resto del CLI
- **Provider Integration**: Utilizzo dei provider AI esistenti

## 🎯 Flusso di Utilizzo

### 1. Analisi Repository
```bash
# In default chat, scrivi:
analizza la repository https://github.com/user/repo e verifica la sicurezza del codice
```

**Il sistema:**
1. 🐳 Crea una VM Docker isolata
2. 📥 Clona la repository
3. 🔧 Installa VS Code e strumenti di sviluppo
4. 🔍 Esegue l'analisi richiesta
5. 📋 Crea una pull request con i risultati
6. 🧹 Pulisce automaticamente la VM

### 2. Task Autonomi
```bash
# Comando per task autonomi
/vm create
/vm list
/vm logs <vm-id>
/vm cleanup
```

## 🛠️ Architettura del Sistema

### **Componenti Principali**

#### 1. VM Manager (`src/cli/automation/vm/vm-manager.ts`)
- Gestione del lifecycle delle VM Docker
- Esecuzione di task nelle VM
- Monitoraggio dello stato e dei log

#### 2. Autonomous VM Agent (`src/cli/automation/agents/autonomous-vm-agent.ts`)
- Agente specializzato per operazioni in VM
- Gestione di task complessi e autonomi
- Integrazione con il sistema di eventi

#### 3. Agent Status UI (`src/cli/ui/agent-status-ui.ts`)
- Visualizzazione degli agenti attivi
- Gestione dei pannelli di log
- Scorciatoie da tastiera

#### 4. VM Integration (`src/cli/core/vm-integration.ts`)
- Integrazione principale con il CLI
- Gestione delle richieste di analisi
- Coordinamento tra componenti

### **Sistema di Eventi**

Il sistema utilizza l'event bus esistente con nuovi eventi:

```typescript
// Eventi VM
VM_CREATED: 'vm.created'
VM_DESTROYED: 'vm.destroyed'
VM_TASK_STARTED: 'vm.task.started'
VM_TASK_COMPLETED: 'vm.task.completed'
VM_TASK_FAILED: 'vm.task.failed'

// Eventi Agent VM
VM_AGENT_CREATED: 'vm.agent.created'
VM_AGENT_DESTROYED: 'vm.agent.destroyed'
AGENT_TASK_COMPLETED: 'agent.task.completed'
AGENT_TASK_FAILED: 'agent.task.failed'
```

## 🎮 Controlli UI

### **Scorciatoie da Tastiera**

- **`L`**: Mostra log dell'agente attivo
- **`ESC`**: Torna al chat principale
- **`R`**: Aggiorna i log
- **`C`**: Pulisci i log
- **`N`**: Prossimo agente (nei log)
- **`P`**: Agente precedente (nei log)

### **Icone degli Agenti**

- 🐳 **VM Agent**: Agente che gestisce VM
- 🔍 **Analysis Agent**: Agente di analisi
- 🚀 **Deployment Agent**: Agente di deployment
- 🤖 **Custom Agent**: Agente personalizzato

### **Indicatori di Stato**

- ● **Verde**: Attivo
- ○ **Giallo**: Inattivo
- ◐ **Blu**: Lavorando
- ✓ **Verde**: Completato
- ✗ **Rosso**: Errore

## 🔧 Configurazione

### **Configurazione VM**

```typescript
interface VMIntegrationConfig {
  enabled: boolean;
  autoCleanup: boolean;
  maxConcurrentVMs: number;
  defaultMemory: string;
  defaultCPU: string;
  timeoutMinutes: number;
}
```

### **Requisiti di Sistema**

- **Docker**: Installato e funzionante
- **Node.js**: Versione 18+
- **Linux**: Sistema operativo supportato
- **Memoria**: Minimo 4GB RAM disponibile

## 📊 Monitoraggio e Metriche

### **Metriche Agente VM**

```typescript
interface VMAgentMetrics {
  vmsCreated: number;
  vmsDestroyed: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalExecutionTime: number;
  averageTaskDuration: number;
  lastActive: Date;
}
```

### **Comandi di Monitoraggio**

```bash
/vm-status          # Stato del sistema VM
/vm list            # Lista VM attive
/vm logs <vm-id>    # Log di una VM specifica
```

## 🔒 Sicurezza

### **Isolamento**
- Ogni VM è completamente isolata
- Nessun accesso al filesystem host
- Rete isolata per ogni container
- Cleanup automatico dopo utilizzo

### **Permessi**
- Esecuzione limitata di comandi sicuri
- Accesso controllato ai file
- Monitoraggio di tutte le operazioni
- Log dettagliati per audit

## 🚀 Utilizzo Avanzato

### **Task Personalizzati**

```typescript
const task = {
  type: 'custom',
  description: 'Analisi personalizzata del codice',
  commands: [
    'npm install',
    'npm run test',
    'npm run lint',
    'echo "Analisi completata" > report.txt'
  ],
  requirements: {
    vscode: true,
    node: true,
    memory: '4g'
  }
};

await vmAgent.executeAutonomousTask(task);
```

### **Integrazione con Provider AI**

Il sistema utilizza i provider AI esistenti per:
- Generazione di comandi di analisi
- Interpretazione dei risultati
- Creazione di report intelligenti

## 🔄 Flusso di Eventi

1. **Richiesta Utente**: L'utente chiede di analizzare una repository
2. **Creazione VM**: Il sistema crea una VM Docker isolata
3. **Setup Ambiente**: Installazione di strumenti necessari
4. **Esecuzione Task**: Esecuzione dei comandi di analisi
5. **Raccolta Risultati**: Raccolta e analisi dei risultati
6. **Creazione PR**: Creazione automatica di pull request
7. **Cleanup**: Pulizia automatica della VM
8. **Notifica**: Notifica di completamento nel chat principale

## 🐛 Troubleshooting

### **Problemi Comuni**

1. **Docker non disponibile**
   ```
   ❌ Docker not available - VM features will be limited
   ```
   **Soluzione**: Installare Docker e assicurarsi che sia in esecuzione

2. **VM non si avvia**
   ```
   ❌ Failed to create VM: Docker command failed
   ```
   **Soluzione**: Verificare i permessi Docker e la disponibilità di risorse

3. **Task fallisce**
   ```
   ❌ Task failed in VM: Command not found
   ```
   **Soluzione**: Verificare che i comandi siano disponibili nell'immagine Docker

### **Log e Debug**

```bash
# Visualizza log di una VM specifica
/vm logs <vm-id>

# Stato del sistema
/vm-status

# Cleanup manuale
/vm-cleanup
```

## 🔮 Roadmap

### **Funzionalità Future**

- [ ] **Multi-VM Orchestration**: Gestione di multiple VM simultanee
- [ ] **Persistent Storage**: Storage persistente per VM
- [ ] **Custom Images**: Supporto per immagini Docker personalizzate
- [ ] **GPU Support**: Supporto per GPU nelle VM
- [ ] **Network Isolation**: Isolamento di rete avanzato
- [ ] **Metrics Dashboard**: Dashboard web per metriche
- [ ] **Scheduling**: Pianificazione automatica di task

### **Integrazioni**

- [ ] **Kubernetes**: Supporto per cluster Kubernetes
- [ ] **Cloud Providers**: Integrazione con AWS, GCP, Azure
- [ ] **CI/CD**: Integrazione con pipeline CI/CD
- [ ] **Monitoring**: Integrazione con sistemi di monitoring

## 📝 Esempi di Utilizzo

### **Analisi di Sicurezza**

```bash
# Analizza vulnerabilità di sicurezza
analizza la repository https://github.com/user/app e verifica le vulnerabilità di sicurezza, controlla le dipendenze e genera un report dettagliato
```

### **Analisi di Performance**

```bash
# Analizza performance del codice
analizza la repository https://github.com/user/app e ottimizza le performance, identifica i bottleneck e suggerisci miglioramenti
```

### **Code Review Automatico**

```bash
# Code review automatico
analizza la repository https://github.com/user/app e fai una code review completa, controlla la qualità del codice e suggerisci refactoring
```

## 🤝 Contribuire

Per contribuire al sistema VM:

1. **Fork** del repository
2. **Branch** per la feature (`git checkout -b feature/vm-enhancement`)
3. **Commit** delle modifiche (`git commit -am 'Add VM enhancement'`)
4. **Push** del branch (`git push origin feature/vm-enhancement`)
5. **Pull Request**

### **Linee Guida**

- Mantenere la compatibilità con il sistema esistente
- Aggiungere test per nuove funzionalità
- Documentare le modifiche
- Seguire le convenzioni di codice esistenti

---

**NikCLI VM Integration System** - Trasforma il tuo CLI in una piattaforma enterprise con agenti autonomi! 🚀