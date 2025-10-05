/**
 * StateManager - Gerenciador centralizado de estado com padrão Observer
 * Implementa store reativo para toda a aplicação
 */
import { eventBus } from './EventBus.js';

export class StateManager {
    constructor() {
        this.state = {
            // Auth state
            auth: {
                user: null,
                isAuthenticated: false,
                isLoading: false,
                authInitialized: false
            },
            
            // Championship state
            championships: {
                list: [],
                current: null,
                loading: false,
                error: null
            },
            
            // Social state
            social: {
                posts: [],
                following: [],
                followers: [],
                loading: false
            },
            
            // UI state
            ui: {
                activeModal: null,
                sidebarOpen: false,
                theme: 'dark',
                loading: false,
                notifications: []
            },
            
            // Results state
            results: {},
            
            // App state
            app: {
                initialized: false,
                version: '2.0.0',
                environment: 'development'
            }
        };
        
        this.subscribers = new Map();
        this.middleware = [];
        this.history = [];
        this.maxHistorySize = 50;
        
        // Bind methods
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        this.setState = this.setState.bind(this);
        this.getState = this.getState.bind(this);
    }

    /**
     * Obtém o estado atual ou uma parte específica
     * @param {string} path - Caminho para o estado (ex: 'auth.user')
     */
    getState(path = null) {
        if (!path) return { ...this.state };
        
        return this.getNestedValue(this.state, path);
    }

    /**
     * Atualiza o estado de forma imutável
     * @param {string} path - Caminho para o estado
     * @param {any} value - Novo valor
     * @param {object} options - Opções (silent, source, etc.)
     */
    setState(path, value, options = {}) {
        const oldState = { ...this.state };
        const newState = { ...this.state };
        
        // Atualiza o estado
        this.setNestedValue(newState, path, value);
        
        // Valida o estado
        if (this.middleware.length > 0) {
            for (const middleware of this.middleware) {
                const result = middleware(newState, oldState, { path, value });
                if (result === false) {
                    console.warn(`State update blocked by middleware for path: ${path}`);
                    return false;
                }
            }
        }
        
        this.state = newState;
        
        // Salva no histórico
        this.saveToHistory(path, value, oldState);
        
        // Notifica subscribers se não for silent
        if (!options.silent) {
            this.notifySubscribers(path, value, oldState, options);
        }
        
        // Emite evento global
        eventBus.emit('state.changed', {
            path,
            value,
            oldValue: this.getNestedValue(oldState, path),
            state: newState
        }, {
            source: options.source || 'StateManager'
        });
        
        return true;
    }

    /**
     * Atualiza múltiplas partes do estado de uma vez
     * @param {object} updates - Objeto com updates { path: value }
     */
    batchUpdate(updates, options = {}) {
        const oldState = { ...this.state };
        let newState = { ...this.state };
        
        // Aplica todas as mudanças
        Object.entries(updates).forEach(([path, value]) => {
            this.setNestedValue(newState, path, value);
        });
        
        // Valida o estado
        if (this.middleware.length > 0) {
            for (const middleware of this.middleware) {
                const result = middleware(newState, oldState, { batch: true, updates });
                if (result === false) {
                    console.warn('Batch state update blocked by middleware');
                    return false;
                }
            }
        }
        
        this.state = newState;
        
        // Notifica subscribers
        if (!options.silent) {
            Object.entries(updates).forEach(([path, value]) => {
                this.notifySubscribers(path, value, oldState, options);
            });
        }
        
        // Emite evento global
        eventBus.emit('state.batch_changed', {
            updates,
            state: newState,
            oldState
        }, {
            source: options.source || 'StateManager'
        });
        
        return true;
    }

    /**
     * Subscribe para mudanças no estado
     * @param {string|function} pathOrCallback - Caminho específico ou callback geral
     * @param {function} callback - Callback para mudanças
     */
    subscribe(pathOrCallback, callback = null) {
        let subscribePath = '*';
        let subscribeCallback = pathOrCallback;
        
        if (typeof pathOrCallback === 'string' && callback) {
            subscribePath = pathOrCallback;
            subscribeCallback = callback;
        }
        
        if (!this.subscribers.has(subscribePath)) {
            this.subscribers.set(subscribePath, []);
        }
        
        const id = this.generateId();
        this.subscribers.get(subscribePath).push({
            id,
            callback: subscribeCallback
        });
        
        return id;
    }

    /**
     * Remove um subscriber
     */
    unsubscribe(pathOrId, id = null) {
        if (typeof pathOrId === 'string' && id) {
            // Remove subscriber específico de um path
            if (this.subscribers.has(pathOrId)) {
                const subs = this.subscribers.get(pathOrId);
                const index = subs.findIndex(sub => sub.id === id);
                if (index !== -1) {
                    subs.splice(index, 1);
                }
            }
        } else {
            // Remove subscriber por ID em todos os paths
            for (const [path, subs] of this.subscribers) {
                const index = subs.findIndex(sub => sub.id === pathOrId);
                if (index !== -1) {
                    subs.splice(index, 1);
                    break;
                }
            }
        }
    }

    /**
     * Adiciona middleware para validação de estado
     */
    use(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Reseta o estado para o inicial
     */
    reset() {
        const initialState = this.getInitialState();
        this.setState('', initialState, { silent: false, source: 'StateManager.reset' });
    }

    /**
     * Obtém histórico de mudanças
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Limpa o histórico
     */
    clearHistory() {
        this.history = [];
    }

    // Métodos privados
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    notifySubscribers(path, value, oldState, options) {
        // Notifica subscribers específicos do path
        if (this.subscribers.has(path)) {
            this.subscribers.get(path).forEach(sub => {
                try {
                    sub.callback(value, this.getNestedValue(oldState, path), { path, options });
                } catch (error) {
                    console.error('StateManager subscriber error:', error);
                }
            });
        }
        
        // Notifica subscribers globais
        if (this.subscribers.has('*')) {
            this.subscribers.get('*').forEach(sub => {
                try {
                    sub.callback(this.state, oldState, { path, value, options });
                } catch (error) {
                    console.error('StateManager global subscriber error:', error);
                }
            });
        }
    }

    saveToHistory(path, value, oldState) {
        this.history.push({
            timestamp: Date.now(),
            path,
            value,
            oldValue: this.getNestedValue(oldState, path)
        });
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    getInitialState() {
        return {
            auth: {
                user: null,
                isAuthenticated: false,
                isLoading: false,
                authInitialized: false
            },
            championships: {
                list: [],
                current: null,
                loading: false,
                error: null
            },
            social: {
                posts: [],
                following: [],
                followers: [],
                loading: false
            },
            ui: {
                activeModal: null,
                sidebarOpen: false,
                theme: 'dark',
                loading: false,
                notifications: []
            },
            results: {},
            app: {
                initialized: false,
                version: '2.0.0',
                environment: 'development'
            }
        };
    }
}

// Instância singleton
export const stateManager = new StateManager();

// Middleware de validação
stateManager.use((newState, oldState, context) => {
    // Validações básicas
    if (newState.auth && typeof newState.auth.isAuthenticated !== 'boolean') {
        console.error('Invalid auth.isAuthenticated state');
        return false;
    }
    
    return true;
});