import { PackageItem, ShelfLetter, ShelfLevel, StorageLocation, Carrier } from '../types';
import { SHELF_CONFIG } from '../data/mockData';

export interface ShelfSlotInfo {
  shelf: ShelfLetter;
  level: ShelfLevel;
  shelfName: string;
  currentCount: number;
  maxCapacity: number;
  occupancyPercentage: number;
  isAvailable: boolean;
}

export interface ShelfOccupancyReport {
  recommendedSlot: StorageLocation;
  totalStoredPackages: number;
  totalCapacity: number;
  overallOccupancyPercentage: number;
  shelfBreakdown: {
    shelf: ShelfLetter;
    name: string;
    total: number;
    max: number;
    levels: ShelfSlotInfo[];
  }[];
}

class ShelfAllocatorService {
  private readonly shelves: ShelfLetter[] = ['A', 'B', 'C'];
  private readonly levels: ShelfLevel[] = [1, 2, 3, 4];

  /**
   * Calculates the best storage slot based on current inventory,
   * balancing occupancy across shelves and levels while considering package characteristics.
   */
  public allocateBestSlot(
    currentPackages: PackageItem[],
    carrierHint?: Carrier,
    isLargeOrFragile?: boolean
  ): StorageLocation {
    const storedPackages = currentPackages.filter((p) => p.status === 'ARMAZENADA');

    // Categorize preference if carrier/size hint exists
    let preferredShelf: ShelfLetter | null = null;
    if (isLargeOrFragile) {
      preferredShelf = 'C'; // Shelf C is optimized for large/fragile items
    } else if (carrierHint === 'Mercado Livre' || carrierHint === 'Shopee') {
      preferredShelf = 'A'; // Shelf A handles high turnover small/medium packages
    } else if (carrierHint === 'Amazon' || carrierHint === 'Correios') {
      preferredShelf = 'B'; // Shelf B handles standard to heavy packages
    }

    let lowestCount = Infinity;
    let selectedSlot: StorageLocation = { shelf: 'A', level: 1 };

    // Search through shelves, prioritizing preferred shelf if not overly congested
    const shelvesToEvaluate: ShelfLetter[] = preferredShelf
      ? [preferredShelf, ...this.shelves.filter((s) => s !== preferredShelf)]
      : this.shelves;

    for (const shelf of shelvesToEvaluate) {
      const config = SHELF_CONFIG.find((c) => c.shelf === shelf);
      const maxPerLevel = config?.maxPerLevel || 12;

      for (const level of this.levels) {
        const count = storedPackages.filter(
          (p) => p.shelf.shelf === shelf && p.shelf.level === level
        ).length;

        // Skip slot if at or exceeding capacity
        if (count >= maxPerLevel) continue;

        // Prefer lower count; slight bias for preferred shelf
        const weightedScore = shelf === preferredShelf ? count * 0.85 : count;

        if (weightedScore < lowestCount) {
          lowestCount = weightedScore;
          selectedSlot = { shelf, level };
        }
      }
    }

    return selectedSlot;
  }

  /**
   * Generates a complete occupancy report for monitoring
   */
  public getOccupancyReport(currentPackages: PackageItem[]): ShelfOccupancyReport {
    const storedPackages = currentPackages.filter((p) => p.status === 'ARMAZENADA');
    let totalStored = 0;
    let totalCap = 0;

    const breakdown = this.shelves.map((shelf) => {
      const config = SHELF_CONFIG.find((c) => c.shelf === shelf);
      const maxPerLevel = config?.maxPerLevel || 12;
      const shelfName = config?.name || `Estante ${shelf}`;

      let shelfTotal = 0;
      const shelfMax = maxPerLevel * 4;

      const levels: ShelfSlotInfo[] = this.levels.map((level) => {
        const count = storedPackages.filter(
          (p) => p.shelf.shelf === shelf && p.shelf.level === level
        ).length;

        shelfTotal += count;
        totalStored += count;
        totalCap += maxPerLevel;

        return {
          shelf,
          level,
          shelfName: `${shelfName} - Nível ${level}`,
          currentCount: count,
          maxCapacity: maxPerLevel,
          occupancyPercentage: Math.round((count / maxPerLevel) * 100),
          isAvailable: count < maxPerLevel
        };
      });

      return {
        shelf,
        name: shelfName,
        total: shelfTotal,
        max: shelfMax,
        levels
      };
    });

    const recommendedSlot = this.allocateBestSlot(currentPackages);

    return {
      recommendedSlot,
      totalStoredPackages: totalStored,
      totalCapacity: totalCap,
      overallOccupancyPercentage: totalCap > 0 ? Math.round((totalStored / totalCap) * 100) : 0,
      shelfBreakdown: breakdown
    };
  }
}

export const shelfAllocatorService = new ShelfAllocatorService();
