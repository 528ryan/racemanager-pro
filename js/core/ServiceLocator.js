/**
 * ServiceLocator - Container de injeção de dependência
 * Gerencia instâncias de serviços e suas dependências
 */
export class ServiceLocator {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
        this.config = new Map();
    }

    /**
     * Registra um serviço singleton
     * @param {string} name - Nome do serviço
     * @param {class|function} ServiceClass - Classe do serviço
     * @param {array} dependencies - Array de dependências
     */
    registerSingleton(name, ServiceClass, dependencies = []) {
        this.services.set(name, {
            type: 'singleton',
            ServiceClass,
            dependencies,
            instance: null
        });
    }

    /**
     * Registra um serviço transient (nova instância a cada get)
     * @param {string} name - Nome do serviço
     * @param {class|function} ServiceClass - Classe do serviço
     * @param {array} dependencies - Array de dependências
     */
    registerTransient(name, ServiceClass, dependencies = []) {
        this.services.set(name, {
            type: 'transient',
            ServiceClass,
            dependencies,
            instance: null
        });
    }

    /**
     * Registra uma factory para criação customizada de serviços
     * @param {string} name - Nome do serviço
     * @param {function} factory - Função factory
     */
    registerFactory(name, factory) {
        this.factories.set(name, factory);
    }

    /**
     * Registra uma instância existente
     * @param {string} name - Nome do serviço
     * @param {any} instance - Instância do serviço
     */
    registerInstance(name, instance) {
        this.singletons.set(name, instance);
    }

    /**
     * Obtém uma instância do serviço
     * @param {string} name - Nome do serviço
     * @returns {any} Instância do serviço
     */
    get(name) {
        // Verifica se é uma instância registrada diretamente
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        // Verifica se é uma factory
        if (this.factories.has(name)) {
            return this.factories.get(name)(this);
        }

        // Verifica se é um serviço registrado
        if (!this.services.has(name)) {
            throw new Error(`Service '${name}' not registered`);
        }

        const service = this.services.get(name);

        // Para singletons, retorna a instância existente ou cria uma nova
        if (service.type === 'singleton') {
            if (service.instance) {
                return service.instance;
            }
            
            service.instance = this.createInstance(service);
            return service.instance;
        }

        // Para transients, sempre cria uma nova instância
        if (service.type === 'transient') {
            return this.createInstance(service);
        }

        throw new Error(`Unknown service type for '${name}'`);
    }

    /**
     * Verifica se um serviço está registrado
     * @param {string} name - Nome do serviço
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || 
               this.singletons.has(name) || 
               this.factories.has(name);
    }

    /**
     * Remove um serviço do container
     * @param {string} name - Nome do serviço
     */
    remove(name) {
        this.services.delete(name);
        this.singletons.delete(name);
        this.factories.delete(name);
        this.config.delete(name);
    }

    /**
     * Limpa todos os serviços
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
        this.config.clear();
    }

    /**
     * Configura parâmetros para um serviço
     * @param {string} name - Nome do serviço
     * @param {object} config - Configuração
     */
    configure(name, config) {
        this.config.set(name, config);
    }

    /**
     * Obtém a configuração de um serviço
     * @param {string} name - Nome do serviço
     * @returns {object}
     */
    getConfig(name) {
        return this.config.get(name) || {};
    }

    /**
     * Lista todos os serviços registrados
     * @returns {array}
     */
    getRegisteredServices() {
        const services = [];
        
        for (const [name, service] of this.services) {
            services.push({
                name,
                type: service.type,
                dependencies: service.dependencies,
                hasInstance: !!service.instance
            });
        }
        
        for (const name of this.singletons.keys()) {
            services.push({
                name,
                type: 'instance',
                dependencies: [],
                hasInstance: true
            });
        }
        
        for (const name of this.factories.keys()) {
            services.push({
                name,
                type: 'factory',
                dependencies: [],
                hasInstance: false
            });
        }
        
        return services;
    }

    /**
     * Cria uma instância resolvendo suas dependências
     * @param {object} service - Configuração do serviço
     * @returns {any} Instância criada
     */
    createInstance(service) {
        const { ServiceClass, dependencies } = service;
        
        // Resolve dependências
        const resolvedDependencies = dependencies.map(dep => {
            if (typeof dep === 'string') {
                return this.get(dep);
            }
            return dep;
        });

        // Obtém configuração se existir
        const config = this.getConfig(service.name) || {};
        
        // Cria a instância
        if (typeof ServiceClass === 'function') {
            if (ServiceClass.prototype && ServiceClass.prototype.constructor === ServiceClass) {
                // É uma classe
                return new ServiceClass(...resolvedDependencies, config);
            } else {
                // É uma função factory
                return ServiceClass(...resolvedDependencies, config);
            }
        }
        
        throw new Error('ServiceClass must be a class or function');
    }

    /**
     * Injeta dependências em um objeto existente
     * @param {object} target - Objeto alvo
     * @param {array} dependencies - Lista de dependências { name, property }
     */
    inject(target, dependencies) {
        dependencies.forEach(({ name, property }) => {
            const service = this.get(name);
            target[property || name] = service;
        });
    }

    /**
     * Decorator para injeção automática de dependências
     * @param {array} dependencies - Lista de dependências
     */
    static Injectable(dependencies = []) {
        return function(target) {
            target._dependencies = dependencies;
            return target;
        };
    }

    /**
     * Resolve um serviço com suas dependências de forma lazy
     * @param {string} name - Nome do serviço
     * @returns {Promise} Promise que resolve com a instância
     */
    async resolve(name) {
        return new Promise((resolve) => {
            try {
                const instance = this.get(name);
                resolve(instance);
            } catch (error) {
                console.error(`Failed to resolve service '${name}':`, error);
                throw error;
            }
        });
    }
}

// Instância singleton
export const serviceLocator = new ServiceLocator();

// Decorator helper
export const Injectable = ServiceLocator.Injectable;