/**
 * BaseComponent - Classe base para todos os componentes
 * Fornece funcionalidades comuns como lifecycle, state, events
 */
import { eventBus } from '../core/EventBus.js';
import { stateManager } from '../core/StateManager.js';

export class BaseComponent {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.getElementById(element) : element;
        this.options = { ...this.defaultOptions, ...options };
        this.state = {};
        this.events = new Map();
        this.subscriptions = [];
        this.children = new Set();
        this.parent = null;
        this.isDestroyed = false;
        
        // Bind methods
        this.render = this.render.bind(this);
        this.destroy = this.destroy.bind(this);
        this.emit = this.emit.bind(this);
        this.on = this.on.bind(this);
        
        // Initialize component
        this.initialize();
    }

    get defaultOptions() {
        return {
            autoRender: true,
            bindEvents: true,
            subscribeToGlobalState: false
        };
    }

    /**
     * Inicialização do componente
     */
    initialize() {
        if (!this.element) {
            console.warn(`Component ${this.constructor.name} initialized without element`);
            return;
        }

        this.element.setAttribute('data-component', this.constructor.name);
        
        // Subscribe to global state if enabled
        if (this.options.subscribeToGlobalState) {
            this.subscribeToGlobalState();
        }
        
        // Bind DOM events
        if (this.options.bindEvents) {
            this.bindEvents();
        }
        
        // Auto render
        if (this.options.autoRender) {
            this.render();
        }
        
        // Lifecycle hook
        this.onInitialize();
        
        // Emit initialized event
        this.emit('initialized');
    }

    /**
     * Lifecycle hook - chamado após inicialização
     */
    onInitialize() {
        // Override in subclasses
    }

    /**
     * Lifecycle hook - chamado antes do render
     */
    beforeRender() {
        // Override in subclasses
    }

    /**
     * Lifecycle hook - chamado após o render
     */
    afterRender() {
        // Override in subclasses
    }

    /**
     * Lifecycle hook - chamado antes da destruição
     */
    beforeDestroy() {
        // Override in subclasses
    }

    /**
     * Renderiza o componente
     */
    render() {
        if (this.isDestroyed) return;
        
        this.beforeRender();
        
        const html = this.template();
        if (html && this.element) {
            this.element.innerHTML = html;
            this.bindComponentEvents();
        }
        
        this.afterRender();
        this.emit('rendered');
    }

    /**
     * Template do componente - deve ser sobrescrito
     */
    template() {
        return '<div>BaseComponent - Override template() method</div>';
    }

    /**
     * Bind de eventos DOM específicos do componente
     */
    bindEvents() {
        // Override in subclasses
    }

    /**
     * Bind eventos após render
     */
    bindComponentEvents() {
        // Re-bind events after re-render
        this.bindEvents();
    }

    /**
     * Atualiza o estado interno do componente
     */
    setState(newState, callback) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        
        this.onStateChange(this.state, oldState);
        
        if (this.options.autoRender) {
            this.render();
        }
        
        if (callback) {
            callback(this.state);
        }
        
        this.emit('stateChanged', { newState: this.state, oldState });
    }

    /**
     * Callback para mudanças de estado
     */
    onStateChange(newState, oldState) {
        // Override in subclasses
    }

    /**
     * Subscribe para mudanças no estado global
     */
    subscribeToGlobalState() {
        const subscription = stateManager.subscribe((newState, oldState) => {
            this.onGlobalStateChange(newState, oldState);
        });
        
        this.subscriptions.push({
            type: 'global-state',
            id: subscription,
            unsubscribe: () => stateManager.unsubscribe(subscription)
        });
    }

    /**
     * Callback para mudanças no estado global
     */
    onGlobalStateChange(newState, oldState) {
        // Override in subclasses
    }

    /**
     * Adiciona um listener de evento
     */
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        this.events.get(event).push(handler);
        
        return () => this.off(event, handler);
    }

    /**
     * Remove um listener de evento
     */
    off(event, handler) {
        if (!this.events.has(event)) return;
        
        const handlers = this.events.get(event);
        const index = handlers.indexOf(handler);
        
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * Emite um evento
     */
    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in component event handler for '${event}':`, error);
                }
            });
        }
        
        // Emite também no EventBus global
        eventBus.emit(`component.${this.constructor.name}.${event}`, data, {
            source: this.constructor.name,
            componentId: this.element?.id
        });
    }

    /**
     * Adiciona um componente filho
     */
    addChild(child) {
        if (child instanceof BaseComponent) {
            child.parent = this;
            this.children.add(child);
        }
    }

    /**
     * Remove um componente filho
     */
    removeChild(child) {
        if (this.children.has(child)) {
            child.parent = null;
            this.children.delete(child);
        }
    }

    /**
     * Encontra um elemento dentro do componente
     */
    find(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Encontra múltiplos elementos dentro do componente
     */
    findAll(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }

    /**
     * Adiciona uma classe CSS ao elemento
     */
    addClass(className) {
        if (this.element) {
            this.element.classList.add(className);
        }
    }

    /**
     * Remove uma classe CSS do elemento
     */
    removeClass(className) {
        if (this.element) {
            this.element.classList.remove(className);
        }
    }

    /**
     * Toggle de classe CSS
     */
    toggleClass(className) {
        if (this.element) {
            this.element.classList.toggle(className);
        }
    }

    /**
     * Mostra o componente
     */
    show() {
        if (this.element) {
            this.element.style.display = '';
            this.removeClass('hidden');
        }
        this.emit('shown');
    }

    /**
     * Esconde o componente
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.addClass('hidden');
        }
        this.emit('hidden');
    }

    /**
     * Destrói o componente
     */
    destroy() {
        if (this.isDestroyed) return;
        
        this.beforeDestroy();
        
        // Destroy children first
        this.children.forEach(child => child.destroy());
        
        // Remove from parent
        if (this.parent) {
            this.parent.removeChild(this);
        }
        
        // Unsubscribe from all subscriptions
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
        
        // Clear events
        this.events.clear();
        
        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.isDestroyed = true;
        this.emit('destroyed');
    }

    /**
     * Força uma re-renderização
     */
    forceUpdate() {
        this.render();
    }

    /**
     * Obtém dados do elemento
     */
    getData(key) {
        return this.element ? this.element.dataset[key] : null;
    }

    /**
     * Define dados no elemento
     */
    setData(key, value) {
        if (this.element) {
            this.element.dataset[key] = value;
        }
    }
}