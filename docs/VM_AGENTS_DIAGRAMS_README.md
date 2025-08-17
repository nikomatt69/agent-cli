# VM Agents Architecture Diagrams

Questa cartella contiene 5 diagrammi Mermaid che documentano l'integrazione completa dei VM agents nel sistema NikCLI factory.

## 📋 **Diagrammi Disponibili**

### 1. **VM_Agent_Factory_Architecture.mmd**
**Tipo:** Graph TB (Top-Bottom)  
**Scopo:** Mostra l'architettura completa del sistema VM Agent Factory

**Componenti documentati:**
- User Interface Layer (CLI commands, help)
- Command Processing (flag parsing, auto-detection) 
- Agent Factory Core (blueprint creation)
- VM Configuration (container config, capabilities, tools)
- Blueprint Storage (registry, metadata)
- Output & Launch (display, instance creation)

**Uso:** Comprensione generale dell'architettura VM agents

---

### 2. **Agent_Creation_Flow.mmd**
**Tipo:** Flowchart TD (Top-Down)  
**Scopo:** Illustra il flusso completo di creazione di un agent (standard vs VM)

**Processi documentati:**
- Input parsing e flag detection
- Auto-detection keywords VM
- Standard agent creation flow
- VM agent creation flow (config, capabilities, tools, prompt)
- Blueprint generation e storage
- Error handling

**Uso:** Debug e ottimizzazione del processo di creazione agent

---

### 3. **VM_Agent_Lifecycle.mmd**
**Tipo:** State Diagram  
**Scopo:** Documenta tutti gli stati e transizioni di un VM agent

**Stati documentati:**
- BlueprintCreated → Launching → Running → Stopping → Stopped
- Substates: ProcessingChat, ExecutingTask, RepositoryAnalysis
- Error handling e recovery
- Container metadata management

**Uso:** Monitoraggio lifecycle e troubleshooting stati agent

---

### 4. **Container_Integration_Flow.mmd**
**Tipo:** Graph TB con auto-registration  
**Scopo:** Mostra l'integrazione container-to-agent con auto-registrazione

**Flussi documentati:**
- Container creation e management
- Auto-registration system (event-driven)
- Agent factory integration
- Security & proxy setup
- Runtime integration
- Container states e lifecycle management
- Event system e monitoring

**Uso:** Implementazione auto-registration e container lifecycle

---

### 5. **Command_Flow_Architecture.mmd**
**Tipo:** Sequence Diagram  
**Scopo:** Sequenza dettagliata di interazioni tra componenti

**Fasi documentate:**
1. **Agent Creation Phase:** `/create-agent --vm` → blueprint creation
2. **Agent Launch Phase:** `/launch-agent` → container startup
3. **Chat Interaction Phase:** VM mode → streaming AI responses
4. **Container Command Execution:** Command execution → AI analysis
5. **Error Handling & Recovery:** Error scenarios e fallback
6. **Cleanup & Shutdown:** Stop agent → cleanup resources

**Uso:** Debug interazioni tra componenti e timing issues

---

## 🎯 **Come Utilizzare i Diagrammi**

### **Per Sviluppatori:**
- Consultare **VM_Agent_Factory_Architecture** per overview architetturale
- Usare **Agent_Creation_Flow** per implementare nuovi tipi di agent
- Riferirsi a **Command_Flow_Architecture** per debug API calls

### **Per System Architects:**
- **Container_Integration_Flow** per pianificare scalabilità container
- **VM_Agent_Lifecycle** per design monitoring e health checks

### **Per Debugging:**
- **Command_Flow_Architecture** per tracciare call sequence
- **VM_Agent_Lifecycle** per identificare stati problematici
- **Agent_Creation_Flow** per debug creazione blueprint

## 🔧 **Rendering dei Diagrammi**

### **Online (Consigliato):**
- [Mermaid Live Editor](https://mermaid.live/)
- [GitHub](https://github.com) (supporto nativo Mermaid)
- [GitLab](https://gitlab.com) (supporto nativo Mermaid)

### **IDE Extensions:**
- **VS Code:** Mermaid Preview Extension
- **IntelliJ:** Mermaid Plugin
- **Obsidian:** Native Mermaid support

### **CLI Tools:**
```bash
# Installa mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Genera PNG/SVG
mmdc -i VM_Agent_Factory_Architecture.mmd -o architecture.png
mmdc -i Agent_Creation_Flow.mmd -o creation_flow.svg
```

## 📚 **Convenzioni Diagrammi**

### **Colori e Stili:**
- 🔵 **Blu:** Processi core e factory logic
- 🟣 **Viola:** VM-specific operations
- 🟢 **Verde:** Success states e outputs
- 🟠 **Arancione:** Decision points e routing
- 🔴 **Rosso:** Error states e fallback
- 🟡 **Giallo:** Intermediate states e processing

### **Icone Standard:**
- 🐳 **Container/VM operations**
- 🤖 **AI/Agent operations** 
- 🔒 **Security/Auth operations**
- 📋 **Blueprint/Config operations**
- 🌊 **Streaming operations**
- ⚙️ **System operations**

## 🔄 **Mantenimento Diagrammi**

I diagrammi devono essere aggiornati quando:
- Si aggiungono nuovi tipi di agent
- Si modificano i flussi di creazione/launch
- Si cambiano le integrazioni container
- Si aggiungono nuovi stati lifecycle
- Si modificano le sequenze di command flow

**Update Process:**
1. Modificare il file `.mmd` appropriato
2. Testare rendering online
3. Aggiornare questo README se necessario
4. Committare con messaggio descrittivo

---

**Documentazione completa del sistema VM Agents Factory Integration** 🎉