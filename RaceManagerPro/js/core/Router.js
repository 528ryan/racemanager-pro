/**
 * Router.js - Sistema de roteamento SPA avançado para RaceManagerPro
 */

class Router {
    constructor() {
        this.routes = [
            { path: '/', component: () => import('../pages/FeedPage.js'), name: 'Feed' },
            { path: '/feed', component: () => import('../pages/FeedPage.js'), name: 'Feed' },
            { path: '/profile', component: () => import('../pages/ProfilePage.js'), name: 'Profile' },
            { path: '/profile/:userId', component: () => import('../pages/ProfilePage.js'), name: 'Profile' },
            { path: '/championships', component: () => import('../pages/ChampionshipsPage.js'), name: 'Championships' },
            { path: '/championships/:championshipId', component: () => import('../pages/ChampionshipsPage.js'), name: 'Championship Details' },
            { path: '/races', component: () => import('../pages/RacesPage.js'), name: 'Races' },
            { path: '/races/:raceId', component: () => import('../pages/RacesPage.js'), name: 'Race Details' },
            { path: '/drivers', component: () => import('../pages/DriversPage.js'), name: 'Drivers' },
            { path: '/drivers/:driverId', component: () => import('../pages/DriversPage.js'), name: 'Driver Profile' }
        ];
        this.middleware = [];
        this.beforeHooks = [];
        this.afterHooks = [];
        this.currentRoute = null;
        this.isNavigating = false;
        
        // Configurar eventos do navegador
        this.setupEventListeners();
        
        // Estado atual da rota
        this.currentState = {
            path: '/',
            params: {},
            query: {}
        };
    }

    // Configurar listeners de eventos
    setupEventListeners() {
        // Interceptar links
        document.addEventListener('click', this.handleLinkClick.bind(this));
        
        // Gerenciar histórico do navegador
        window.addEventListener('popstate', this.handlePopState.bind(this));
        
        // Carregar rota inicial
        document.addEventListener('DOMContentLoaded', () => {
            this.handleInitialRoute();
        });
    }

    // Interceptar cliques em links
    handleLinkClick(event) {
        const link = event.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Verificar se é um link interno
        if (href.startsWith('/') || href.startsWith('#')) {
            event.preventDefault();
            this.navigate(href);
        }
    }

    // Adicionar middleware
    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    // Hook antes da navegação
    beforeEach(callback) {
        this.beforeHooks.push(callback);
        return this;
    }

    // Hook depois da navegação
    afterEach(callback) {
        this.afterHooks.push(callback);
        return this;
    }

    // Navegar para uma rota
    async navigate(path, options = {}) {
        if (this.isNavigating) return;
        
        try {
            this.isNavigating = true;
            this.showLoading();

            // Executar hooks antes da navegação
            for (const hook of this.beforeHooks) {
                const result = await hook(path, this.currentRoute);
                if (result === false) {
                    this.isNavigating = false;
                    this.hideLoading();
                    return;
                }
            }

            // Encontrar rota correspondente
            const route = this.findRoute(path);
            if (!route) {
                console.warn(`❌ Route not found: ${path}`);
                this.isNavigating = false;
                this.hideLoading();
                return;
            }

            // Executar middleware
            for (const middleware of this.middleware) {
                const result = await middleware(route);
                if (result === false) {
                    this.isNavigating = false;
                    this.hideLoading();
                    return;
                }
            }

            // Atualizar histórico do navegador se não for substituição
            if (!options.replace) {
                history.pushState({ path }, '', path);
            } else {
                history.replaceState({ path }, '', path);
            }

            // Renderizar nova rota
            await this.renderRoute(route);

            // Atualizar estado atual
            this.currentRoute = route;
            this.currentState.path = path;

            // Executar hooks após navegação
            for (const hook of this.afterHooks) {
                await hook(route, this.currentRoute);
            }

            console.log(`✅ Navigated to: ${path}`);

        } catch (error) {
            console.error(`❌ Navigation error:`, error);
        } finally {
            this.isNavigating = false;
            this.hideLoading();
        }
    }

    // Encontrar rota correspondente
    findRoute(path) {
        // Limpar query string e fragmento
        const cleanPath = path.split('?')[0].split('#')[0];
        
        // Buscar rota exata primeiro
        let route = this.routes.find(r => r.path === cleanPath);
        
        // Se não encontrar, buscar rotas dinâmicas
        if (!route) {
            for (const r of this.routes) {
                if (this.matchDynamicRoute(cleanPath, r.path)) {
                    route = { ...r };
                    route.params = this.extractParams(cleanPath, r.path);
                    break;
                }
            }
        }

        if (route) {
            // Extrair query parameters
            const [, queryString] = path.split('?');
            route.query = this.parseQuery(queryString);
        }

        return route;
    }

    // Verificar se rota dinâmica corresponde
    matchDynamicRoute(path, routePath) {
        const pathParts = path.split('/').filter(Boolean);
        const routeParts = routePath.split('/').filter(Boolean);
        
        if (pathParts.length !== routeParts.length) {
            return false;
        }
        
        return routeParts.every((part, index) => {
            return part.startsWith(':') || part === pathParts[index];
        });
    }

    // Extrair parâmetros da rota dinâmica
    extractParams(path, routePath) {
        const pathParts = path.split('/').filter(Boolean);
        const routeParts = routePath.split('/').filter(Boolean);
        const params = {};
        
        routeParts.forEach((part, index) => {
            if (part.startsWith(':')) {
                const paramName = part.slice(1);
                params[paramName] = pathParts[index];
            }
        });
        
        return params;
    }

    // Analisar query string
    parseQuery(queryString) {
        const params = {};
        if (!queryString) return params;
        
        queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key) {
                params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : true;
            }
        });
        
        return params;
    }

    // Renderizar rota
    async renderRoute(route) {
        try {
            const container = document.getElementById('app-container');
            if (!container) {
                console.error('❌ App container not found');
                return;
            }

            // Carregar componente
            const ComponentClass = await this.loadComponent(route.component);
            
            if (!ComponentClass) {
                console.error(`❌ Component not found for route: ${route.path}`);
                return;
            }

            // Criar instância do componente
            const component = new ComponentClass();
            
            // Renderizar componente
            const html = await component.render(route.params || {}, route.query || {});
            container.innerHTML = html;
            
            // Inicializar componente se tiver método init
            if (component.init && typeof component.init === 'function') {
                await component.init();
            }

            // Atualizar navegação
            this.updateNavigation(route);
            
            // Atualizar breadcrumbs
            this.updateBreadcrumbs(route);

        } catch (error) {
            console.error(`❌ Error rendering route:`, error);
            document.getElementById('app-container').innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="text-center">
                        <h2 class="text-2xl font-bold text-red-400 mb-2">Error Loading Page</h2>
                        <p class="text-gray-400">Please try again or contact support.</p>
                    </div>
                </div>
            `;
        }
    }

    // Carregar componente dinamicamente
    async loadComponent(componentPath) {
        try {
            const module = await componentPath();
            return module.default;
        } catch (error) {
            console.error('❌ Error loading component:', error);
            return null;
        }
    }

    // Mostrar loading
    showLoading() {
        const container = document.getElementById('app-container');
        if (container && !this.isNavigating) {
            container.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    // Esconder loading
    hideLoading() {
        const container = document.getElementById('app-container');
        if (container) {
            container.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    // Atualizar navegação ativa
    updateNavigation(route) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active', 'text-orange-500', 'border-orange-500');
            link.classList.add('text-gray-300', 'border-transparent');
        });

        const activeLink = document.querySelector(`[href="${route.path}"], [href="${route.path.split('/')[1] ? '/' + route.path.split('/')[1] : '/'}"]`);
        if (activeLink && activeLink.classList.contains('nav-link')) {
            activeLink.classList.add('active', 'text-orange-500', 'border-orange-500');
            activeLink.classList.remove('text-gray-300', 'border-transparent');
        }
    }

    // Atualizar breadcrumbs
    updateBreadcrumbs(route) {
        const breadcrumbsContainer = document.getElementById('breadcrumbs');
        if (!breadcrumbsContainer) return;

        const pathParts = route.path.split('/').filter(Boolean);
        const breadcrumbs = ['Home'];
        
        // Construir breadcrumbs baseado no caminho
        let currentPath = '';
        pathParts.forEach(part => {
            currentPath += `/${part}`;
            if (!part.startsWith(':')) {
                breadcrumbs.push(part.charAt(0).toUpperCase() + part.slice(1));
            }
        });

        // Se tiver nome específico da rota, usar ele
        if (route.name && route.name !== breadcrumbs[breadcrumbs.length - 1]) {
            breadcrumbs[breadcrumbs.length - 1] = route.name;
        }

        breadcrumbsContainer.innerHTML = breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return `
                <span class="${isLast ? 'text-orange-500' : 'text-gray-400 hover:text-white cursor-pointer'}">
                    ${crumb}
                </span>
                ${!isLast ? '<span class="text-gray-600">/</span>' : ''}
            `;
        }).join('');
    }

    // Gerenciar histórico do navegador
    handlePopState(event) {
        const path = event.state?.path || window.location.pathname;
        this.navigate(path, { replace: true });
    }

    // Carregar rota inicial
    handleInitialRoute() {
        const path = window.location.pathname + window.location.search;
        this.navigate(path, { replace: true });
    }

    // Registrar nova rota programaticamente
    addRoute(path, component, name) {
        this.routes.push({ path, component, name });
        console.log(`📍 Route registered: ${path}`);
        return this;
    }

    // Remover rota
    removeRoute(path) {
        const index = this.routes.findIndex(r => r.path === path);
        if (index > -1) {
            this.routes.splice(index, 1);
            console.log(`🗑️ Route removed: ${path}`);
        }
        return this;
    }

    // Obter rota atual
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Obter estado atual
    getCurrentState() {
        return { ...this.currentState };
    }

    // Verificar se está em rota específica
    isActive(path) {
        return this.currentState.path === path;
    }

    // Voltar no histórico
    back() {
        history.back();
    }

    // Avançar no histórico
    forward() {
        history.forward();
    }

    // Ir para rota específica no histórico
    go(delta) {
        history.go(delta);
    }
}

// Instância global do router
window.Router = new Router();

export default Router;