/**
 * EventBus - Sistema de mensageria para comunicação entre microserviços
 * Implementa padrão Publisher-Subscriber para baixo acoplamento
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.middleware = [];
        this.eventHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Registra um listener para um evento específico
     * @param {string} event - Nome do evento
     * @param {function} listener - Função callback
     * @param {object} options - Opções (priority, once, context)
     */
    on(event, listener, options = {}) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const listenerConfig = {
            fn: listener,
            priority: options.priority || 0,
            once: options.once || false,
            context: options.context || null,
            id: this.generateId()
        };

        const listeners = this.listeners.get(event);
        listeners.push(listenerConfig);
        
        // Ordena por prioridade (maior prioridade primeiro)
        listeners.sort((a, b) => b.priority - a.priority);

        return listenerConfig.id;
    }

    /**
     * Remove um listener específico
     * @param {string} event - Nome do evento
     * @param {string|function} listenerOrId - ID do listener ou função
     */
    off(event, listenerOrId) {
        if (!this.listeners.has(event)) return;

        const listeners = this.listeners.get(event);
        const index = listeners.findIndex(l => 
            l.id === listenerOrId || l.fn === listenerOrId
        );

        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Registra um listener que executa apenas uma vez
     */
    once(event, listener, options = {}) {
        return this.on(event, listener, { ...options, once: true });
    }

    /**
     * Emite um evento para todos os listeners registrados
     * @param {string} event - Nome do evento
     * @param {any} data - Dados do evento
     * @param {object} metadata - Metadados (source, timestamp, etc.)
     */
    async emit(event, data = null, metadata = {}) {
        const eventData = {
            type: event,
            data,
            metadata: {
                timestamp: Date.now(),
                source: metadata.source || 'unknown',
                correlationId: metadata.correlationId || this.generateId(),
                ...metadata
            }
        };

        // Salva no histórico
        this.saveToHistory(eventData);

        // Aplica middleware
        let processedData = eventData;
        for (const middleware of this.middleware) {
            try {
                processedData = await middleware(processedData);
                if (!processedData) break; // Middleware cancelou o evento
            } catch (error) {
                console.error('EventBus middleware error:', error);
            }
        }

        if (!processedData) return false;

        // Executa listeners
        if (!this.listeners.has(event)) return true;

        const listeners = [...this.listeners.get(event)];
        const results = [];

        for (const listener of listeners) {
            try {
                const context = listener.context || this;
                const result = await listener.fn.call(context, processedData.data, processedData.metadata);
                results.push(result);

                // Remove listener se for 'once'
                if (listener.once) {
                    this.off(event, listener.id);
                }
            } catch (error) {
                console.error(`EventBus listener error for event '${event}':`, error);
            }
        }

        return results;
    }

    /**
     * Adiciona middleware para processamento de eventos
     */
    use(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Remove todos os listeners de um evento
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Lista todos os eventos registrados
     */
    getEvents() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Obtém o número de listeners para um evento
     */
    getListenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).length : 0;
    }

    /**
     * Obtém histórico de eventos
     */
    getHistory(filter = null) {
        if (!filter) return this.eventHistory;
        return this.eventHistory.filter(event => event.type === filter);
    }

    /**
     * Limpa o histórico de eventos
     */
    clearHistory() {
        this.eventHistory = [];
    }

    // Métodos privados
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    saveToHistory(eventData) {
        this.eventHistory.push(eventData);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
}

// Instância singleton
export const eventBus = new EventBus();

// Middleware de logging para desenvolvimento (browser only)
if (typeof window !== 'undefined') {
    eventBus.use(async (eventData) => {
        console.log(`🔄 Event: ${eventData.type}`, eventData);
        return eventData;
    });
}