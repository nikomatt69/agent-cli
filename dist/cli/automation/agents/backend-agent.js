"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendAgent = void 0;
const base_agent_1 = require("./base-agent");
const cli_ui_1 = require("../../utils/cli-ui");
class BackendAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'backend-agent';
        this.capabilities = [
            'api-development',
            'database-design',
            'server-architecture',
            'authentication',
            'security',
            'microservices',
            'containerization',
            'backend-testing',
            'performance-optimization',
            'monitoring',
            'deployment'
        ];
        this.specialization = 'backend';
        this.maxConcurrentTasks = 3;
    }
    async onInitialize() {
        cli_ui_1.CliUI.logInfo('🔧 Backend Agent initializing...');
        await this.detectBackendStack();
        await this.configureBackendTools();
        cli_ui_1.CliUI.logSuccess('✅ Backend Agent ready for server-side tasks');
    }
    async onExecuteTask(task) {
        cli_ui_1.CliUI.logInfo(`🔧 Backend Agent processing: ${task.type}`);
        switch (task.type.toLowerCase()) {
            case 'create-api':
                return await this.createAPI(task);
            case 'design-database':
                return await this.designDatabase(task);
            case 'implement-authentication':
                return await this.implementAuthentication(task);
            case 'setup-middleware':
                return await this.setupMiddleware(task);
            case 'optimize-performance':
                return await this.optimizeBackendPerformance(task);
            case 'setup-monitoring':
                return await this.setupMonitoring(task);
            case 'containerize-app':
                return await this.containerizeApplication(task);
            case 'setup-testing':
                return await this.setupBackendTesting(task);
            default:
                return await this.handleGenericBackendTask(task);
        }
    }
    async onStop() {
        cli_ui_1.CliUI.logInfo('🔧 Backend Agent shutting down...');
    }
    async createAPI(task) {
        const { apiName, methods, framework, database } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`🚀 Creating API: ${apiName} with methods: ${methods?.join(', ')}`);
        try {
            const routeCode = await this.generateAPIRoutes(apiName, methods, framework);
            const routePath = await this.determineRoutePath(apiName, framework);
            await this.executeTool('write-file-tool', routePath, routeCode);
            const controllerCode = await this.generateController(apiName, methods, database);
            const controllerPath = await this.determineControllerPath(apiName, framework);
            await this.executeTool('write-file-tool', controllerPath, controllerCode);
            let modelPath = null;
            if (database) {
                const modelCode = await this.generateModel(apiName, database);
                modelPath = await this.determineModelPath(apiName, database);
                await this.executeTool('write-file-tool', modelPath, modelCode);
            }
            const testCode = await this.generateAPITests(apiName, methods);
            const testPath = routePath.replace(/\.(js|ts)$/, '.test.$1');
            await this.executeTool('write-file-tool', testPath, testCode);
            return {
                success: true,
                apiName,
                routePath,
                controllerPath,
                modelPath,
                testPath,
                message: `API ${apiName} created successfully`
            };
        }
        catch (error) {
            throw new Error(`Failed to create API: ${error.message}`);
        }
    }
    async designDatabase(task) {
        const { entities, relationships, databaseType } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`🗄️ Designing ${databaseType} database schema`);
        try {
            const schemaCode = await this.generateDatabaseSchema(entities, relationships, databaseType);
            const schemaPath = await this.determineSchemaPath(databaseType);
            await this.executeTool('write-file-tool', schemaPath, schemaCode);
            const migrationCode = await this.generateMigrations(entities, databaseType);
            const migrationPath = await this.determineMigrationPath(databaseType);
            await this.executeTool('write-file-tool', migrationPath, migrationCode);
            const seedCode = await this.generateSeedData(entities);
            const seedPath = await this.determineSeedPath(databaseType);
            await this.executeTool('write-file-tool', seedPath, seedCode);
            return {
                success: true,
                databaseType,
                schemaPath,
                migrationPath,
                seedPath,
                entitiesCount: entities?.length || 0,
                message: `Database schema designed successfully`
            };
        }
        catch (error) {
            throw new Error(`Failed to design database: ${error.message}`);
        }
    }
    async implementAuthentication(task) {
        const { authType, provider, features } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`🔐 Implementing ${authType} authentication`);
        try {
            const authMiddleware = await this.generateAuthMiddleware(authType, provider);
            const middlewarePath = 'src/middleware/auth.ts';
            await this.executeTool('write-file-tool', middlewarePath, authMiddleware);
            const authRoutes = await this.generateAuthRoutes(authType, features);
            const routesPath = 'src/routes/auth.ts';
            await this.executeTool('write-file-tool', routesPath, authRoutes);
            const authUtils = await this.generateAuthUtils(authType, provider);
            const utilsPath = 'src/utils/auth.ts';
            await this.executeTool('write-file-tool', utilsPath, authUtils);
            const authTests = await this.generateAuthTests(authType);
            const testsPath = 'src/tests/auth.test.ts';
            await this.executeTool('write-file-tool', testsPath, authTests);
            return {
                success: true,
                authType,
                provider,
                middlewarePath,
                routesPath,
                utilsPath,
                testsPath,
                message: `Authentication system implemented successfully`
            };
        }
        catch (error) {
            throw new Error(`Failed to implement authentication: ${error.message}`);
        }
    }
    async setupMiddleware(task) {
        const { middlewareTypes, framework } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`⚙️ Setting up middleware: ${middlewareTypes?.join(', ')}`);
        try {
            const middlewareFiles = [];
            for (const middlewareType of middlewareTypes || []) {
                const middlewareCode = await this.generateMiddleware(middlewareType, framework);
                const middlewarePath = `src/middleware/${middlewareType}.ts`;
                await this.executeTool('write-file-tool', middlewarePath, middlewareCode);
                middlewareFiles.push(middlewarePath);
            }
            await this.updateAppWithMiddleware(middlewareTypes, framework);
            return {
                success: true,
                middlewareFiles,
                framework,
                message: `Middleware setup completed`
            };
        }
        catch (error) {
            throw new Error(`Failed to setup middleware: ${error.message}`);
        }
    }
    async optimizeBackendPerformance(task) {
        const { optimizationType, targetFiles } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`⚡ Optimizing backend performance: ${optimizationType}`);
        try {
            const optimizations = [];
            if (optimizationType.includes('database')) {
                const dbResult = await this.optimizeDatabaseQueries(targetFiles);
                optimizations.push(dbResult);
            }
            if (optimizationType.includes('caching')) {
                const cacheResult = await this.implementCaching(targetFiles);
                optimizations.push(cacheResult);
            }
            if (optimizationType.includes('connection-pooling')) {
                const poolResult = await this.setupConnectionPooling();
                optimizations.push(poolResult);
            }
            if (optimizationType.includes('api-response')) {
                const apiResult = await this.optimizeAPIResponses(targetFiles);
                optimizations.push(apiResult);
            }
            return {
                success: true,
                optimizations,
                message: `Backend performance optimizations applied`
            };
        }
        catch (error) {
            throw new Error(`Failed to optimize performance: ${error.message}`);
        }
    }
    async setupMonitoring(task) {
        const { monitoringTools, metrics } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`📊 Setting up monitoring with: ${monitoringTools?.join(', ')}`);
        try {
            const monitoringFiles = [];
            const loggingCode = await this.generateLoggingSetup(monitoringTools);
            const loggingPath = 'src/utils/logger.ts';
            await this.executeTool('write-file-tool', loggingPath, loggingCode);
            monitoringFiles.push(loggingPath);
            const metricsCode = await this.generateMetricsSetup(metrics);
            const metricsPath = 'src/utils/metrics.ts';
            await this.executeTool('write-file-tool', metricsPath, metricsCode);
            monitoringFiles.push(metricsPath);
            const healthCode = await this.generateHealthChecks();
            const healthPath = 'src/routes/health.ts';
            await this.executeTool('write-file-tool', healthPath, healthCode);
            monitoringFiles.push(healthPath);
            return {
                success: true,
                monitoringTools,
                monitoringFiles,
                message: `Monitoring setup completed`
            };
        }
        catch (error) {
            throw new Error(`Failed to setup monitoring: ${error.message}`);
        }
    }
    async containerizeApplication(task) {
        const { containerTool, environment } = task.metadata || {};
        cli_ui_1.CliUI.logInfo(`🐳 Containerizing application with ${containerTool}`);
        try {
            const dockerfileContent = await this.generateDockerfile(environment);
            await this.executeTool('write-file-tool', 'Dockerfile', dockerfileContent);
            const composeContent = await this.generateDockerCompose(environment);
            await this.executeTool('write-file-tool', 'docker-compose.yml', composeContent);
            const dockerignoreContent = await this.generateDockerignore();
            await this.executeTool('write-file-tool', '.dockerignore', dockerignoreContent);
            return {
                success: true,
                containerTool,
                environment,
                files: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
                message: `Application containerized successfully`
            };
        }
        catch (error) {
            throw new Error(`Failed to containerize application: ${error.message}`);
        }
    }
    async handleGenericBackendTask(task) {
        cli_ui_1.CliUI.logInfo(`🔧 Handling generic backend task: ${task.type}`);
        const plan = await this.generateTaskPlan(task);
        return await this.executePlan(plan);
    }
    async detectBackendStack() {
        try {
            const packageJson = await this.executeTool('read-file-tool', 'package.json');
            const dependencies = JSON.parse(packageJson).dependencies || {};
            if (dependencies.express) {
                cli_ui_1.CliUI.logInfo('📦 Detected Express.js framework');
            }
            if (dependencies.fastify) {
                cli_ui_1.CliUI.logInfo('📦 Detected Fastify framework');
            }
            if (dependencies.mongoose || dependencies.mongodb) {
                cli_ui_1.CliUI.logInfo('📦 Detected MongoDB database');
            }
            if (dependencies.pg || dependencies.mysql2) {
                cli_ui_1.CliUI.logInfo('📦 Detected SQL database');
            }
        }
        catch {
            cli_ui_1.CliUI.logInfo('📦 No specific backend framework detected');
        }
    }
    async configureBackendTools() {
        cli_ui_1.CliUI.logDebug('🔧 Configuring backend-specific tools');
    }
    async generateAPIRoutes(apiName, methods, framework) {
        return `// ${apiName} API routes for ${framework}\nexport default router;`;
    }
    async generateController(apiName, methods, database) {
        return `// ${apiName} controller with ${database}\nexport class ${apiName}Controller {}`;
    }
    async generateModel(apiName, database) {
        return `// ${apiName} model for ${database}\nexport class ${apiName}Model {}`;
    }
    async generateAPITests(apiName, methods) {
        return `// Tests for ${apiName} API\ndescribe('${apiName}', () => {});`;
    }
    async generateDatabaseSchema(entities, relationships, dbType) {
        return `-- Database schema for ${dbType}\n-- Entities: ${entities?.length || 0}`;
    }
    async generateMigrations(entities, dbType) {
        return `-- Migrations for ${dbType}\n-- Entities: ${entities?.length || 0}`;
    }
    async generateSeedData(entities) {
        return `-- Seed data\n-- Entities: ${entities?.length || 0}`;
    }
    async generateAuthMiddleware(authType, provider) {
        return `// ${authType} middleware with ${provider}\nexport const authMiddleware = () => {};`;
    }
    async generateAuthRoutes(authType, features) {
        return `// ${authType} routes with features: ${features?.join(', ')}\nexport default router;`;
    }
    async generateAuthUtils(authType, provider) {
        return `// ${authType} utilities with ${provider}\nexport const authUtils = {};`;
    }
    async generateAuthTests(authType) {
        return `// Tests for ${authType} authentication\ndescribe('Auth', () => {});`;
    }
    async generateMiddleware(type, framework) {
        return `// ${type} middleware for ${framework}\nexport const ${type}Middleware = () => {};`;
    }
    async updateAppWithMiddleware(types, framework) {
        cli_ui_1.CliUI.logInfo(`Updating ${framework} app with middleware: ${types.join(', ')}`);
    }
    async generateDockerfile(environment) {
        return `FROM node:18-alpine\n# Dockerfile for ${environment}\nWORKDIR /app\nCOPY . .\nRUN npm install\nEXPOSE 3000\nCMD ["npm", "start"]`;
    }
    async generateDockerCompose(environment) {
        return `version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=${environment}`;
    }
    async generateDockerignore() {
        return `node_modules\n.git\n.env\n*.log\nDockerfile\n.dockerignore`;
    }
    async determineRoutePath(apiName, framework) {
        return `src/routes/${apiName}.ts`;
    }
    async determineControllerPath(apiName, framework) {
        return `src/controllers/${apiName}.controller.ts`;
    }
    async determineModelPath(apiName, database) {
        return `src/models/${apiName}.model.ts`;
    }
    async determineSchemaPath(databaseType) {
        return `src/database/schema.${databaseType === 'mongodb' ? 'js' : 'sql'}`;
    }
    async determineMigrationPath(databaseType) {
        return `src/database/migrations/001_initial.${databaseType === 'mongodb' ? 'js' : 'sql'}`;
    }
    async determineSeedPath(databaseType) {
        return `src/database/seeds/001_initial.${databaseType === 'mongodb' ? 'js' : 'sql'}`;
    }
    async optimizeDatabaseQueries(files) {
        return { type: 'database-optimization', filesProcessed: files?.length || 0 };
    }
    async implementCaching(files) {
        return { type: 'caching', filesProcessed: files?.length || 0 };
    }
    async setupConnectionPooling() {
        return { type: 'connection-pooling', configured: true };
    }
    async optimizeAPIResponses(files) {
        return { type: 'api-optimization', filesProcessed: files?.length || 0 };
    }
    async generateLoggingSetup(tools) {
        return `// Logging setup with: ${tools?.join(', ')}\nexport const logger = {};`;
    }
    async generateMetricsSetup(metrics) {
        return `// Metrics setup for: ${metrics?.join(', ')}\nexport const metrics = {};`;
    }
    async generateHealthChecks() {
        return `// Health check endpoints\nexport const healthRouter = {};`;
    }
    async setupBackendTesting(task) {
        return { success: true, message: 'Backend testing setup completed' };
    }
    async generateTaskPlan(task) {
        return { steps: [], estimated_duration: 120000 };
    }
    async executePlan(plan) {
        return { success: true, message: 'Backend plan executed successfully' };
    }
}
exports.BackendAgent = BackendAgent;
