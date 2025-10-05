/**
 * Router.js - Sistema de roteamento SPA para MotorSport Pro
 * Gerencia navegação entre páginas, URLs e histórico do browser
 */

export class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.middlewares = [];
        this.beforeRouteChange = [];
        this.afterRouteChange = [];
        
        // Bind methods
        this.navigate = this.navigate.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        
        // Initialize
        this.init();
        
        console.log('🛣️ Router initialized');
    }

    /**
     * Initialize router
     */
    init() {
        // Listen to browser back/forward buttons
        window.addEventListener('popstate', this.handlePopState);
        
        // Handle initial route
        this.handleInitialRoute();
        
        // Setup link intercepts
        this.setupLinkIntercepts();
    }

    /**
     * Register a route
     */
    addRoute(path, component, options = {}) {
        const route = {
            path,
            component,
            name: options.name || path.replace('/', ''),
            title: options.title || 'MotorSport Pro',
            requiresAuth: options.requiresAuth !== false, // Default true
            layout: options.layout || 'default',
            meta: options.meta || {},
            params: {},
            query: {}
        };
        
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
        console.log(`📍 Route registered: ${path}`);
        return this;
    }

    /**
     * Add middleware
     */
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Add before route change hook
     */
    beforeEach(callback) {
        this.beforeRouteChange.push(callback);
        return this;
    }

    /**
     * Add after route change hook
     */
    afterEach(callback) {
        this.afterRouteChange.push(callback);
        return this;
    }

    /**
     * Navigate to a route
     */
    async navigate(path, options = {}) {
        try {
            // Parse path and query
            const [pathname, search] = path.split('?');
            const query = this.parseQuery(search);
            
            // Find matching route
            const route = this.findRoute(pathname);
            if (!route) {
                console.warn(`Route not found: ${pathname}`);
                return this.navigate('/404');
            }

            // Extract params
            const params = this.extractParams(pathname, route.path);
            
            // Create route object
            const newRoute = {
                ...route,
                path: pathname,
                fullPath: path,
                params,
                query
            };

            // Run before hooks
            for (const hook of this.beforeRouteChange) {
                const result = await hook(newRoute, this.currentRoute);
                if (result === false) {
                    console.log('Navigation cancelled by before hook');
                    return;
                }
            }

            // Run middlewares
            for (const middleware of this.middlewares) {
                const result = await middleware(newRoute);
                if (result === false) {
                    console.log('Navigation cancelled by middleware');
                    return;
                }
            }

            // Update browser history
            if (!options.replace) {
                history.pushState({ path }, newRoute.title, path);
            } else {
                history.replaceState({ path }, newRoute.title, path);
            }

            // Update current route
            const previousRoute = this.currentRoute;
            this.currentRoute = newRoute;

            // Update document title
            document.title = newRoute.title;

            // Render component
            await this.renderRoute(newRoute);

            // Run after hooks
            for (const hook of this.afterRouteChange) {
                await hook(newRoute, previousRoute);
            }

            // Emit route change event
            window.dispatchEvent(new CustomEvent('routeChange', {
                detail: { route: newRoute, previousRoute }
            }));

            console.log(`🛣️ Navigated to: ${path}`);

        } catch (error) {
            console.error('Navigation error:', error);
            this.navigate('/error');
        }
    }

    /**
     * Find matching route
     */
    findRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }

        // Dynamic route matching
        for (const [routePath, route] of this.routes) {
            if (this.matchDynamicRoute(path, routePath)) {
                return route;
            }
        }

        return null;
    }

    /**
     * Match dynamic route with params
     */
    matchDynamicRoute(path, routePath) {
        const pathSegments = path.split('/').filter(Boolean);
        const routeSegments = routePath.split('/').filter(Boolean);

        if (pathSegments.length !== routeSegments.length) {
            return false;
        }

        return routeSegments.every((segment, index) => {
            return segment.startsWith(':') || segment === pathSegments[index];
        });
    }

    /**
     * Extract params from dynamic route
     */
    extractParams(path, routePath) {
        const params = {};
        const pathSegments = path.split('/').filter(Boolean);
        const routeSegments = routePath.split('/').filter(Boolean);

        routeSegments.forEach((segment, index) => {
            if (segment.startsWith(':')) {
                const paramName = segment.substring(1);
                params[paramName] = pathSegments[index];
            }
        });

        return params;
    }

    /**
     * Parse query string
     */
    parseQuery(search) {
        if (!search) return {};
        
        const params = new URLSearchParams(search);
        const query = {};
        
        for (const [key, value] of params) {
            query[key] = value;
        }
        
        return query;
    }

    /**
     * Render route component
     */
    async renderRoute(route) {
        const appContainer = document.getElementById('app-container');
        if (!appContainer) {
            throw new Error('App container not found');
        }

        // Show loading
        this.showLoading();

        try {
            // Load component
            const componentInstance = await this.loadComponent(route.component);
            
            // Render component
            const content = await componentInstance.render(route.params, route.query);
            
            // Update DOM
            appContainer.innerHTML = content;
            
            // Initialize component
            if (componentInstance.init) {
                await componentInstance.init(route.params, route.query);
            }

            // Update navigation state
            this.updateNavigation(route);

        } catch (error) {
            console.error('Error rendering route:', error);
            appContainer.innerHTML = `
                <div class="min-h-screen flex items-center justify-center">
                    <div class="text-center">
                        <h1 class="text-2xl font-bold text-red-400 mb-4">Error Loading Page</h1>
                        <p class="text-gray-400 mb-4">${error.message}</p>
                        <button onclick="router.navigate('/')" class="racing-btn">
                            Go Home
                        </button>
                    </div>
                </div>
            `;
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Load component dynamically
     */
    async loadComponent(componentPath) {
        try {
            const module = await import(componentPath);
            const ComponentClass = module.default || module[Object.keys(module)[0]];
            return new ComponentClass();
        } catch (error) {
            console.error(`Failed to load component: ${componentPath}`, error);
            throw error;
        }
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.remove('hidden');
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }

    /**
     * Update navigation state
     */
    updateNavigation(route) {
        // Update active nav item
        document.querySelectorAll('[data-nav-item]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.navItem === route.name) {
                item.classList.add('active');
            }
        });

        // Update breadcrumbs
        this.updateBreadcrumbs(route);
    }

    /**
     * Update breadcrumbs
     */
    updateBreadcrumbs(route) {
        const breadcrumbs = document.getElementById('breadcrumbs');
        if (!breadcrumbs) return;

        const segments = route.path.split('/').filter(Boolean);
        const items = ['Home'];
        
        segments.forEach((segment, index) => {
            if (segment.startsWith(':')) return;
            items.push(segment.charAt(0).toUpperCase() + segment.slice(1));
        });

        breadcrumbs.innerHTML = items.map((item, index) => {
            const isLast = index === items.length - 1;
            return `
                <span class="${isLast ? 'text-orange-400' : 'text-gray-400'}">
                    ${item}
                </span>
                ${!isLast ? '<i data-feather="chevron-right" class="w-4 h-4"></i>' : ''}
            `;
        }).join('');

        // Re-initialize feather icons
        if (window.feather) {
            feather.replace();
        }
    }

    /**
     * Handle browser back/forward
     */
    handlePopState(event) {
        const path = event.state?.path || location.pathname;
        this.navigate(path, { replace: true });
    }

    /**
     * Handle initial route
     */
    handleInitialRoute() {
        const path = location.pathname + location.search || '/';
        this.navigate(path, { replace: true });
    }

    /**
     * Setup link intercepts
     */
    setupLinkIntercepts() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            
            // Skip external links and non-SPA links
            if (!href || 
                href.startsWith('http') || 
                href.startsWith('mailto:') || 
                href.startsWith('tel:') ||
                link.hasAttribute('target') ||
                link.hasAttribute('data-external')) {
                return;
            }

            e.preventDefault();
            this.navigate(href);
        });
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Build URL with params
     */
    buildUrl(routeName, params = {}, query = {}) {
        const route = Array.from(this.routes.values())
            .find(r => r.name === routeName);
            
        if (!route) {
            console.warn(`Route not found: ${routeName}`);
            return '/';
        }

        let path = route.path;
        
        // Replace params
        Object.entries(params).forEach(([key, value]) => {
            path = path.replace(`:${key}`, value);
        });

        // Add query string
        const queryString = new URLSearchParams(query).toString();
        if (queryString) {
            path += `?${queryString}`;
        }

        return path;
    }

    /**
     * Destroy router
     */
    destroy() {
        window.removeEventListener('popstate', this.handlePopState);
        this.routes.clear();
        this.middlewares = [];
        this.beforeRouteChange = [];
        this.afterRouteChange = [];
        console.log('🛣️ Router destroyed');
    }
}

// Export singleton instance
export const router = new Router();

// Make router globally available
window.router = router;