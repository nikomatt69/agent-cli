# AI Agent Prompts & Automation System

Questa cartella contiene tutti i prompts, system prompts e configurazioni per l'automazione continua del sistema multi-agente AI CLI.

## Struttura

```
prompts/
├── system/                 # System prompts per ogni agente
│   ├── base-agent.txt     # Prompt base per tutti gli agenti
│   ├── frontend-agent.txt # System prompt per Frontend Agent
│   ├── backend-agent.txt  # System prompt per Backend Agent
│   └── testing-agent.txt  # System prompt per Testing Agent
├── user/                  # Template prompt utente
│   ├── task-templates.txt # Template per diversi tipi di task
│   └── interaction-flows.txt # Flussi di interazione
├── planning/              # Sistema di pianificazione automatica
│   ├── human-level-plans.txt # Piani comprensibili agli umani
│   ├── todo-templates.txt    # Template per TODO automatici
│   └── execution-flows.txt   # Flussi di esecuzione
├── automation/            # Configurazioni automazione
│   ├── continuous-mode.txt   # Modalità continua
│   ├── approval-rules.txt    # Regole per approvazione automatica
│   └── safety-checks.txt     # Controlli di sicurezza
└── logs/                  # Log e tracciamento
    ├── execution-log.md      # Log delle esecuzioni
    ├── decision-log.md       # Log delle decisioni
    └── human-feedback.md     # Feedback umano raccolto
```

## Utilizzo

1. **System Prompts**: Definiscono il comportamento e le capacità di ogni agente
2. **User Templates**: Forniscono template per interazioni comuni
3. **Planning**: Gestiscono la pianificazione automatica e human-readable
4. **Automation**: Configurano l'esecuzione continua e le regole di sicurezza
5. **Logs**: Tracciano tutte le attività per trasparenza e debugging

## Modalità Continua

Il sistema può operare in modalità continua, eseguendo task automaticamente basandosi su:
- Piani pre-approvati
- Regole di sicurezza configurate
- Feedback umano precedente
- Metriche di successo

## Trasparenza

Tutti i processi sono tracciati e documentati per mantenere trasparenza completa nelle decisioni e azioni degli agenti AI.
