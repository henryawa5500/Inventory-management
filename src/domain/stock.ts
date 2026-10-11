import type { SaleLine, StockMovement } from './types'

export function convertCratesToUnits(packSize: number, crates: number, looseUnits = 0): number {
  return crates * packSize + looseUnits
}

export function getStockFromMovements(movements: StockMovement[]): number {
  return movements.reduce((total, movement) => total + movement.quantityChange, 0)
}

export function isLowStock(quantity: number, reorderLevel: number): boolean {
  return quantity <= reorderLevel
}

export function isNegativeStock(quantity: number): boolean {
  return quantity < 0
}

export function calculateCartTotals(lines: Array<{ quantity: number; unitPriceKobo: number }>) {
  const itemsCount = lines.reduce((count, line) => count + line.quantity, 0)
  const subtotalKobo = lines.reduce(
    (total, line) => total + line.quantity * line.unitPriceKobo,
    0,
  )

  return {
    itemsCount,
    subtotalKobo,
  }
}

export function calculateCartLineTotal(line: SaleLine): number {
  return line.quantity * line.unitPriceKobo
}
