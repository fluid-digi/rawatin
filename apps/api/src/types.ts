import type { Tenant, User } from '@rawatin/db'
import type { SessionPayload } from './lib/session'

declare module 'hono' {
  interface ContextVariableMap {
    tenant: Tenant
    dbUser: User
    session: SessionPayload
  }
}
