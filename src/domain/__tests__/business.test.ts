import { describe, expect, it } from 'vitest'
import { businessDate } from '../business'
import { formatNaira } from '../money'
import { convertCratesToUnits, getStockFromMovements, isLowStock, isNegativeStock, calculateCartTotals } from '../stock'

describe('money', () => {
  it('formats naira with kilo conversion', () => {
    expect(formatNaira(150000)).toBe('₦1,500')
  })
})

describe('stock conversion', () => {
  it('converts crates to total units including loose items', () => {
    expect(convertCratesToUnits(20, 2, 10)).toBe(50)
    expect(convertCratesToUnits(20, 2.5, 0)).toBe(50)
  })
})

describe('cart totals', () => {
  it('adds up quantities and subtotal', () => {
    expect(calculateCartTotals([
      { quantity: 2, unitPriceKobo: 2500 },
      { quantity: 1, unitPriceKobo: 1800 },
    ])).toEqual({ itemsCount: 3, subtotalKobo: 6800 })
  })
})

describe('stock ledger', () => {
  it('sums quantity changes for stock', () => {
    expect(getStockFromMovements([
      { id: 'a', itemId: 'x', itemName: 'X', type: 'purchase', quantityChange: 20, description: 'restock', createdAt: '2024-01-01' },
      { id: 'b', itemId: 'x', itemName: 'X', type: 'sale', quantityChange: -8, description: 'sale', createdAt: '2024-01-01' },
    ])).toBe(12)
  })
})

describe('stock thresholds', () => {
  it('flags low stock and negatives', () => {
    expect(isLowStock(4, 5)).toBe(true)
    expect(isNegativeStock(-1)).toBe(true)
    expect(isLowStock(10, 5)).toBe(false)
  })
})

describe('business date', () => {
  it('rolls over after the cutoff', () => {
    expect(businessDate('2024-01-02T22:30:00+01:00', '23:00')).toBe('2024-01-02')
    expect(businessDate('2024-01-02T23:30:00+01:00', '23:00')).toBe('2024-01-03')
  })
})
