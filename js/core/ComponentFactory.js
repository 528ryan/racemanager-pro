/**
 * ComponentFactory - Factory para criação e gerenciamento de componentes
 * Implementa padrões Factory e Registry
 */
import { BaseComponent } from '../components/BaseComponent.js';
import { eventBus } from './EventBus.js';

export class ComponentFactory {
    constructor() {
        this.components = new Map(); // Registro de tipos de componentes
        this.instances = new Map();  // Instâncias ativas
        this.templates = new Map();  // Templates cachados
        this.config = new Map();     // Configurações padrão
    }

    /**
     * Registra um tipo de componente
     * @param {string} name - Nome do componente
     * @param {class} ComponentClass - Classe do componente
     * @param {object} defaultConfig - Configuração padrão
     */
    register(name, ComponentClass, defaultConfig = {}) {
        if (!ComponentClass.prototype || !(ComponentClass.prototype instanceof BaseComponent)) {
            throw new Error(`Component '${name}' must extend BaseComponent`);
        }

        this.components.set(name, ComponentClass);
        this.config.set(name, defaultConfig);
        
        console.log(`✅ Component '${name}' registered`);
    }

    /**
     * Cria uma instância de componente
     * @param {string} name - Nome do componente
     * @param {HTMLElement|string} element - Elemento DOM ou seletor
     * @param {object} options - Opções de configuração
     * @returns {BaseComponent} Instância do componente
     */
    create(name, element, options = {}) {
        if (!this.components.has(name)) {
            throw new Error(`Component '${name}' not registered`);
        }

        const ComponentClass = this.components.get(name);
        const defaultConfig = this.config.get(name) || {};
        const mergedOptions = { ...defaultConfig, ...options };

        // Resolve elemento
        const targetElement = typeof element === 'string' 
            ? document.querySelector(element) || document.getElementById(element)
            : element;

        if (!targetElement) {
            throw new Error(`Element not found for component '${name}'`);
        }

        // Cria instância
        const instance = new ComponentClass(targetElement, mergedOptions);
        
        // Registra instância
        const instanceId = this.generateInstanceId();
        instance._factoryId = instanceId;
        this.instances.set(instanceId, {
            name,
            instance,
            element: targetElement,
            created: Date.now()
        });

        // Emite evento
        eventBus.emit('component.created', {
            name,
            instanceId,
            element: targetElement
        });

        console.log(`🔧 Component '${name}' created with ID: ${instanceId}`);
        
        return instance;
    }

    /**
     * Cria múltiplos componentes de uma vez
     * @param {array} definitions - Array de definições { name, element, options }
     * @returns {array} Array de instâncias criadas
     */
    createMultiple(definitions) {
        return definitions.map(({ name, element, options }) => 
            this.create(name, element, options)
        );
    }

    /**
     * Auto-cria componentes baseado em atributos data-component
     * @param {HTMLElement} container - Container para buscar componentes
     */
    autoCreate(container = document) {
        const elements = container.querySelectorAll('[data-component]');
        const created = [];

        elements.forEach(element => {
            const componentName = element.getAttribute('data-component');
            
            if (this.components.has(componentName)) {
                try {
                    // Evita criar o mesmo componente duas vezes
                    if (!element.hasAttribute('data-component-initialized')) {
                        const instance = this.create(componentName, element);
                        element.setAttribute('data-component-initialized', 'true');
                        created.push(instance);
                    }
                } catch (error) {
                    console.error(`Failed to auto-create component '${componentName}':`, error);
                }
            }
        });

        return created;
    }

    /**
     * Obtém uma instância por ID
     * @param {string} instanceId - ID da instância
     * @returns {BaseComponent|null}
     */
    getInstance(instanceId) {
        const record = this.instances.get(instanceId);
        return record ? record.instance : null;
    }

    /**
     * Obtém todas as instâncias de um tipo de componente
     * @param {string} name - Nome do componente
     * @returns {array} Array de instâncias
     */
    getInstancesByType(name) {
        const instances = [];
        
        for (const [id, record] of this.instances) {
            if (record.name === name) {
                instances.push(record.instance);
            }
        }
        
        return instances;
    }

    /**
     * Destrói uma instância específica
     * @param {string|BaseComponent} instanceOrId - ID da instância ou instância
     */
    destroy(instanceOrId) {
        let instanceId;
        let instance;

        if (typeof instanceOrId === 'string') {
            instanceId = instanceOrId;
            const record = this.instances.get(instanceId);
            instance = record ? record.instance : null;
        } else {
            instance = instanceOrId;
            instanceId = instance._factoryId;
        }

        if (!instance || !instanceId) {
            console.warn('Instance not found for destruction');
            return;
        }

        // Destrói a instância
        instance.destroy();
        
        // Remove do registro
        this.instances.delete(instanceId);
        
        // Emite evento
        eventBus.emit('component.destroyed', {
            instanceId,
            name: instance.constructor.name
        });

        console.log(`🗑️ Component instance '${instanceId}' destroyed`);
    }

    /**
     * Destrói todas as instâncias de um tipo
     * @param {string} name - Nome do componente
     */
    destroyAllOfType(name) {
        const instances = this.getInstancesByType(name);
        instances.forEach(instance => this.destroy(instance));
    }

    /**
     * Destrói todas as instâncias
     */
    destroyAll() {
        const instanceIds = Array.from(this.instances.keys());
        instanceIds.forEach(id => this.destroy(id));
    }

    /**
     * Renderiza um template de componente
     * @param {string} name - Nome do componente
     * @param {object} data - Dados para o template
     * @returns {string} HTML renderizado
     */
    renderTemplate(name, data = {}) {
        if (!this.templates.has(name)) {
            throw new Error(`Template for '${name}' not found`);
        }

        const template = this.templates.get(name);
        
        if (typeof template === 'function') {
            return template(data);
        }
        
        // Simple template substitution
        return this.interpolateTemplate(template, data);
    }

    /**
     * Registra um template
     * @param {string} name - Nome do template
     * @param {string|function} template - Template ou função template
     */
    registerTemplate(name, template) {
        this.templates.set(name, template);
    }

    /**
     * Obtém estatísticas dos componentes
     * @returns {object} Estatísticas
     */
    getStats() {
        const stats = {
            registered: this.components.size,
            instances: this.instances.size,
            templates: this.templates.size,
            byType: {}
        };

        // Conta instâncias por tipo
        for (const [id, record] of this.instances) {
            if (!stats.byType[record.name]) {
                stats.byType[record.name] = 0;
            }
            stats.byType[record.name]++;
        }

        return stats;
    }

    /**
     * Lista todos os componentes registrados
     * @returns {array}
     */
    getRegisteredComponents() {
        return Array.from(this.components.keys());
    }

    /**
     * Verifica se um componente está registrado
     * @param {string} name - Nome do componente
     * @returns {boolean}
     */
    isRegistered(name) {
        return this.components.has(name);
    }

    /**
     * Configura um componente
     * @param {string} name - Nome do componente
     * @param {object} config - Configuração
     */
    configure(name, config) {
        const existing = this.config.get(name) || {};
        this.config.set(name, { ...existing, ...config });
    }

    // Métodos privados
    generateInstanceId() {
        return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    interpolateTemplate(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data.hasOwnProperty(key) ? data[key] : match;
        });
    }

    /**
     * Limpa componentes órfãos (elementos removidos do DOM)
     */
    cleanup() {
        const orphaned = [];
        
        for (const [id, record] of this.instances) {
            if (!document.contains(record.element)) {
                orphaned.push(id);
            }
        }
        
        orphaned.forEach(id => {
            console.log(`🧹 Cleaning up orphaned component: ${id}`);
            this.destroy(id);
        });
        
        return orphaned.length;
    }
}

// Instância singleton
export const componentFactory = new ComponentFactory();

// Auto-cleanup periódico
setInterval(() => {
    componentFactory.cleanup();
}, 30000); // A cada 30 segundos