# 🤖 AI Agents CLI

Un potente CLI con AI agents che eseguono in parallelo, costruito con TypeScript, Next.js, Tailwind CSS v3, e Gemini AI.

## ✨ Caratteristiche

- **CLI con AI Agents in Parallelo**: Esegui più agenti AI contemporaneamente
- **4 Agenti AI Specializzati**:
  - 🔍 **AI Analysis**: Analisi del codice con insights dettagliati
  - 🛠️ **Code Generator**: Generazione automatica di codice TypeScript
  - 📝 **Code Review**: Review completa del codice con suggerimenti
  - ⚡ **Optimization**: Ottimizzazione del codice per performance e leggibilità
- **Dashboard Web**: Interfaccia Next.js con Tailwind CSS per gestire gli agenti
- **State Management**: Zustand store per gestire lo stato dell'applicazione
- **Esecuzione Parallela**: Capacità di eseguire più agenti contemporaneamente

## 🚀 Installazione

1. **Installa le dipendenze**:
```bash
npm install
```

2. **Configura la chiave API di Gemini**:
```bash
export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
```

## 📋 Utilizzo

### CLI Commands

#### Lista degli agenti disponibili
```bash
npm run cli:list
```

#### Esegui un singolo agente
```bash
npm run cli run ai-analysis -- --task "function add(a, b) { return a + b; }"
npm run cli run code-generator -- --task "Create a function to validate emails"
npm run cli run code-review -- --task "function process(data) { return data.map(x => x * 2); }"
npm run cli run optimization -- --task "for(let i=0; i<arr.length; i++) { console.log(arr[i]); }"
```

#### Esegui agenti in parallelo
```bash
npm run cli run-parallel ai-analysis code-review optimization -- --task "function fibonacci(n) { if(n <= 1) return n; return fibonacci(n-1) + fibonacci(n-2); }"
```

### Dashboard Web

1. **Avvia il server di sviluppo**:
```bash
npm run dev
```

2. **Apri il browser** su `http://localhost:3000`

3. **Utilizza l'interfaccia** per:
   - Inserire codice da analizzare
   - Eseguire singoli agenti o agenti in parallelo
   - Visualizzare i risultati e la cronologia

## 🏗️ Struttura del Progetto

```
ai-agents-cli/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── analyze/route.ts      # API per analisi singola
│   │   └── run-agent/route.ts    # API per esecuzione agenti
│   └── page.tsx                  # Dashboard principale
├── src/
│   ├── cli/                      # CLI Implementation
│   │   ├── agents/
│   │   │   ├── ai-agent.ts       # Agente di analisi AI
│   │   │   ├── code-generator-agent.ts
│   │   │   ├── code-review-agent.ts
│   │   │   ├── optimization-agent.ts
│   │   │   ├── base-agent.ts     # Classe base per agenti
│   │   │   ├── agent-manager.ts  # Gestore degli agenti
│   │   │   └── types.ts          # Tipi TypeScript
│   │   ├── index.ts              # Entry point del CLI
│   │   └── register-agents.ts    # Registrazione agenti
│   ├── store/
│   │   └── index.ts              # Zustand store
│   └── types/
│       └── agent.ts              # Tipi per agenti
├── bin/
│   └── cli.js                    # Executable CLI
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## 🔧 Agenti Disponibili

### 1. AI Analysis Agent (`ai-analysis`)
Analizza il codice fornito e fornisce insights su:
- Funzionalità del codice
- Potenziali miglioramenti
- Best practices
- Problemi di sicurezza

### 2. Code Generator Agent (`code-generator`)
Genera codice TypeScript basato su descrizioni testuali:
- Funzioni con tipi appropriati
- Gestione degli errori
- Documentazione JSDoc
- Best practices moderne

### 3. Code Review Agent (`code-review`)
Esegue review completa del codice controllando:
- Qualità del codice
- Potenziali bug
- Vulnerabilità di sicurezza
- Ottimizzazioni delle performance
- Type safety

### 4. Optimization Agent (`optimization`)
Ottimizza il codice esistente per:
- Efficienza algoritmica
- Uso della memoria
- Leggibilità del codice
- Funzionalità moderne JavaScript/TypeScript

## 🎯 Esempi di Utilizzo

### Esempio 1: Analisi Parallela Completa
```bash
npm run cli run-parallel ai-analysis code-review optimization -- --task "
function processUsers(users) {
  let result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].active) {
      result.push(users[i].name);
    }
  }
  return result;
}
"
```

### Esempio 2: Generazione di Codice
```bash
npm run cli run code-generator -- --task "Create a TypeScript class for managing a shopping cart with add, remove, and calculate total methods"
```

### Esempio 3: Review di Sicurezza
```bash
npm run cli run code-review -- --task "
function authenticate(username, password) {
  if (username === 'admin' && password === 'password123') {
    return true;
  }
  return false;
}
"
```

## 🔑 Configurazione API

Per utilizzare gli agenti AI, è necessario configurare la chiave API di Google Gemini:

1. Ottieni una chiave API da [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Imposta la variabile d'ambiente:
   ```bash
   export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
   ```

## 🛠️ Sviluppo

### Aggiungere Nuovi Agenti

1. Crea una nuova classe che estende `BaseAgent`
2. Implementa i metodi richiesti
3. Registra l'agente in `register-agents.ts`

```typescript
import { BaseAgent } from './base-agent';

export class MyCustomAgent extends BaseAgent {
  name = 'my-custom-agent';
  description = 'Description of my custom agent';

  async run(task?: string): Promise<any> {
    // Implementa la logica dell'agente
    return { result: 'Custom agent result' };
  }
}
```

### Comandi di Sviluppo

```bash
npm run dev          # Avvia Next.js dev server
npm run build        # Build per produzione
npm run start        # Avvia server di produzione
npm run lint         # Esegui linting
npm run cli          # Esegui CLI direttamente
```

## 📝 Note Tecniche

- **TypeScript**: Tipizzazione completa per tutti i componenti
- **Next.js 14**: App Router con API Routes
- **Tailwind CSS v3**: Styling moderno e responsive
- **Zustand**: State management leggero e performante
- **Commander.js**: Parsing robusto dei comandi CLI
- **Chalk & Ora**: Output colorato e spinners per il CLI
- **Google AI SDK**: Integrazione nativa con Gemini

## 🚀 Deploy

Il progetto può essere deployato su qualsiasi piattaforma che supporta Next.js:

- **Vercel**: Deploy automatico con git push
- **Netlify**: Supporto completo per Next.js
- **Docker**: Containerizzazione per deploy personalizzati

## 📄 Licenza

MIT License - vedi il file LICENSE per dettagli.

---

**Sviluppato con ❤️ usando TypeScript, Next.js, e Gemini AI**
