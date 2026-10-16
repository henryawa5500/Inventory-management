import { createContext, useContext, useMemo } from 'react'
import { mockRepository } from './mockRepository'
import { offlineRepository } from './offlineRepository'
import type { InventoryRepository } from './repository'

const RepositoryContext = createContext<InventoryRepository | null>(null)

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => {
    const configuredMode = import.meta.env.VITE_DATA_MODE
    return configuredMode === 'api' || (import.meta.env.PROD && configuredMode !== 'mock')
      ? offlineRepository
      : mockRepository
  }, [])

  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
}

export function useInventoryRepository() {
  const repository = useContext(RepositoryContext)

  if (!repository) {
    throw new Error('Inventory repository is not available')
  }

  return repository
}
