import { readFileSync } from 'node:fs'
import type { Page, Request, Route } from '@playwright/test'
import { API_BASE_URL, APP_URL } from './env'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface MockReply {
  status?: number
  body?: unknown
}

interface MockContext {
  // Grupos capturados pelo RegExp do caminho (ex.: o id em /teams/(\d+)).
  params: string[]
  url: URL
  request: Request
}

type Resolver = MockReply | ((context: MockContext) => MockReply)

interface Handler {
  method: Method
  path: string | RegExp
  resolve: Resolver
}

const FIXTURES_DIR = new URL('../fixtures/', import.meta.url)
const API_PATH = new URL(API_BASE_URL).pathname
// O index.html carrega as fontes do Google: respondidas vazias para o teste não depender de rede.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const CORS_HEADERS = {
  'access-control-allow-origin': new URL(APP_URL).origin,
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/** Corpo de resposta versionado em e2e/fixtures/<nome>.json (cópia nova a cada chamada). */
export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), 'utf8')) as T
}

/**
 * API do backend simulada via page.route. Chamada sem mock responde 501 e fica registrada em
 * `unmocked`; requisição para outro host vai para `unexpected`. O fixture `api` falha o teste
 * se alguma das duas listas não estiver vazia.
 */
export class MockApi {
  private readonly handlers: Handler[] = []
  readonly unmocked: string[] = []
  readonly unexpected: string[] = []
  // O Chromium loga toda resposta 4xx/5xx como console.error: o teste que simula um erro de
  // propósito libera só aquela mensagem.
  readonly allowedConsoleErrors: RegExp[] = []

  allowConsoleError(pattern: RegExp): this {
    this.allowedConsoleErrors.push(pattern)
    return this
  }

  /** Registra (ou sobrescreve) uma rota: o registro mais recente vence. */
  on(method: Method, path: string | RegExp, resolve: Resolver): this {
    this.handlers.unshift({ method, path, resolve })
    return this
  }

  async install(page: Page) {
    const appOrigin = new URL(APP_URL).origin
    await page.route(
      (url) => url.origin !== appOrigin,
      (route) => this.handle(route),
    )
  }

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())

    if (url.href.startsWith(`${API_BASE_URL}/`)) return this.handleApi(route, url)
    if (FONT_HOSTS.includes(url.hostname)) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    }
    this.unexpected.push(`${request.method()} ${url.href}`)
    return route.abort()
  }

  private async handleApi(route: Route, url: URL) {
    const request = route.request()
    const method = request.method()
    const path = url.pathname.slice(API_PATH.length)

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })

    for (const handler of this.handlers) {
      if (handler.method !== method) continue
      const params = matchPath(handler.path, path)
      if (!params) continue
      try {
        const reply =
          typeof handler.resolve === 'function'
            ? handler.resolve({ params, url, request })
            : handler.resolve
        return route.fulfill({
          status: reply.status ?? 200,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify(reply.body ?? {}),
        })
      } catch (error) {
        // Ex.: não existe fixture para o id pedido.
        this.unmocked.push(`${method} ${path}${url.search} (${String(error)})`)
        return route.fulfill({
          status: 501,
          headers: CORS_HEADERS,
          json: { message: 'Mock com erro.' },
        })
      }
    }

    this.unmocked.push(`${method} ${path}${url.search}`)
    return route.fulfill({
      status: 501,
      headers: CORS_HEADERS,
      json: { message: `Sem mock no E2E: ${method} ${path}` },
    })
  }
}

function matchPath(pattern: string | RegExp, path: string): string[] | null {
  if (typeof pattern === 'string') return pattern === path ? [] : null
  const match = pattern.exec(path)
  return match ? match.slice(1) : null
}
