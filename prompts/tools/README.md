# Tool-Specific System Prompts

Ogni tool, azione e comando ha il proprio system prompt dedicato per massima precisione e controllo.

## Struttura

```
prompts/tools/
├── atomic-tools/           # Prompts per atomic tools
│   ├── read-file-tool.txt
│   ├── write-file-tool.txt
│   ├── replace-in-file-tool.txt
│   ├── run-command-tool.txt
│   └── find-files-tool.txt
├── analysis-tools/         # Prompts per strumenti di analisi
│   ├── grep-search.txt
│   ├── codebase-search.txt
│   └── file-analysis.txt
├── agent-actions/          # Prompts per azioni degli agenti
│   ├── task-execution.txt
│   ├── error-handling.txt
│   ├── result-formatting.txt
│   └── collaboration.txt
├── cli-commands/           # Prompts per comandi CLI
│   ├── chat-command.txt
│   ├── plan-command.txt
│   ├── agent-command.txt
│   └── list-command.txt
├── workflow-steps/         # Prompts per step di workflow
│   ├── analysis-step.txt
│   ├── implementation-step.txt
│   ├── testing-step.txt
│   └── deployment-step.txt
└── safety-prompts/         # Prompts per controlli di sicurezza
    ├── approval-required.txt
    ├── risk-assessment.txt
    └── rollback-procedures.txt
```

## Principi dei Tool Prompts

1. **SPECIFICITÀ**: Ogni prompt è ottimizzato per il tool specifico
2. **CONTESTO**: Include il contesto operativo del tool
3. **SAFETY**: Definisce limiti e controlli di sicurezza
4. **OUTPUT**: Specifica formato di output atteso
5. **ERROR HANDLING**: Gestione errori specifica per il tool

## Utilizzo

Ogni tool carica automaticamente il proprio system prompt prima dell'esecuzione per garantire:
- Comportamento coerente e prevedibile
- Controlli di sicurezza appropriati
- Output formattato correttamente
- Gestione errori specifica
- Logging e tracciamento adeguati
