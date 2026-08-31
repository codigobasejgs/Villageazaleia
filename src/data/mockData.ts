import { Unit, PackageItem, ActivityLog, Carrier, ShelfLetter, ShelfLevel } from '../types';

// Sample resident names for 360 units
const firstNames = [
  'Carlos', 'Ana', 'Bruno', 'Mariana', 'Fernando', 'Juliana', 'Rodrigo', 'Camila',
  'Lucas', 'Beatriz', 'Guilherme', 'Larissa', 'Marcelo', 'Patrícia', 'Felipe', 'Fernanda',
  'Gabriel', 'Aline', 'Thiago', 'Renata', 'Diego', 'Vanessa', 'Matheus', 'Amanda',
  'Eduardo', 'Carla', 'Rafael', 'Priscila', 'Leonardo', 'Luciana', 'Gustavo', 'Letícia'
];

const lastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade'
];

// Generate 360 units: 12 Blocks, each with 30 apartments (Floors 1-8, e.g. 101-104, 201-204, 301-304, 401-404, 501-504, 601-604, 701-704, 801-802)
export function generateAllUnits(): Unit[] {
  const units: Unit[] = [];
  let nameIndex = 0;

  for (let block = 1; block <= 12; block++) {
    // 30 apartments per block
    const aptNumbers: number[] = [];
    for (let floor = 1; floor <= 7; floor++) {
      for (let apt = 1; apt <= 4; apt++) {
        aptNumbers.push(floor * 100 + apt); // 101, 102, 103, 104 ... 701, 702, 703, 704 (28 apts)
      }
    }
    aptNumbers.push(801, 802); // 2 more to make exactly 30 apartments per block

    aptNumbers.forEach((apt) => {
      const fName = firstNames[nameIndex % firstNames.length];
      const lName = lastNames[(nameIndex + block) % lastNames.length];
      nameIndex++;

      const unitId = `B${String(block).padStart(2, '0')}-A${apt}`;
      const primaryPhone = `(11) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Default contacts (1 to 3 initial contacts per unit)
      const residentPhones = [
        {
          id: `ph-1-${unitId}`,
          label: 'Titular',
          number: primaryPhone,
          isWhatsapp: true
        }
      ];

      // Give some units family members
      if (apt % 2 === 0) {
        residentPhones.push({
          id: `ph-2-${unitId}`,
          label: 'Cônjuge',
          number: `(11) 9${Math.floor(2000 + Math.random() * 7000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          isWhatsapp: true
        });
      }
      if (apt % 3 === 0) {
        residentPhones.push({
          id: `ph-3-${unitId}`,
          label: 'Filho(a)',
          number: `(11) 9${Math.floor(3000 + Math.random() * 6000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          isWhatsapp: true
        });
      }

      units.push({
        id: unitId,
        block: String(block),
        apartment: apt,
        residentName: `${fName} ${lName}`,
        residentPhone: primaryPhone,
        residentPhones,
        residentEmail: `${fName.toLowerCase()}.${lName.toLowerCase()}@email.com`,
        pwaInstalled: true,
        pushEnabled: true,
        registeredAt: new Date(Date.now() - 30 * 86400000).toISOString()
      });
    });
  }

  return units;
}

export const ALL_UNITS: Unit[] = generateAllUnits();

export const CARRIER_CONFIG: Record<Carrier, { color: string; badgeBg: string; textCol: string; borderCol: string; icon: string }> = {
  'Mercado Livre': {
    color: '#FFE600',
    badgeBg: 'bg-amber-500/20',
    textCol: 'text-amber-400',
    borderCol: 'border-amber-500/30',
    icon: '⚡'
  },
  'Amazon': {
    color: '#FF9900',
    badgeBg: 'bg-orange-500/20',
    textCol: 'text-orange-400',
    borderCol: 'border-orange-500/30',
    icon: '📦'
  },
  'Correios': {
    color: '#00416B',
    badgeBg: 'bg-blue-500/20',
    textCol: 'text-blue-400',
    borderCol: 'border-blue-500/30',
    icon: '📫'
  },
  'Shopee': {
    color: '#EE4D2D',
    badgeBg: 'bg-rose-500/20',
    textCol: 'text-rose-400',
    borderCol: 'border-rose-500/30',
    icon: '🛍️'
  },
  'Loggi': {
    color: '#00B4D8',
    badgeBg: 'bg-cyan-500/20',
    textCol: 'text-cyan-400',
    borderCol: 'border-cyan-500/30',
    icon: '🚀'
  },
  'Outra': {
    color: '#94A3B8',
    badgeBg: 'bg-slate-500/20',
    textCol: 'text-slate-300',
    borderCol: 'border-slate-500/30',
    icon: '📦'
  }
};

export const INITIAL_PACKAGES: PackageItem[] = [
  {
    id: 'pkg-001',
    trackingCode: 'ML-894720194BR',
    unitId: 'B03-A102',
    block: '3',
    apartment: 102,
    residentName: 'Beatriz Lima',
    carrier: 'Mercado Livre',
    shelf: { shelf: 'A', level: 1 },
    photoUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
    notes: 'Caixa média amarela selada com fita do Mercado Livre',
    status: 'ARMAZENADA',
    receivedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
    qrToken: 'QR-B03A102-PKG001',
    registeredVia: 'PORTARIA',
    operatorName: 'Marcos Vinicius (Porteiro)'
  },
  {
    id: 'pkg-002',
    trackingCode: 'AMZ-BR-58392109',
    unitId: 'B03-A102',
    block: '3',
    apartment: 102,
    residentName: 'Beatriz Lima',
    carrier: 'Amazon',
    shelf: { shelf: 'B', level: 2 },
    photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
    notes: 'Envelope Prime acolchoado contendo livro/eletrônico',
    status: 'ARMAZENADA',
    receivedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 4.9 * 3600 * 1000).toISOString(),
    qrToken: 'QR-B03A102-PKG002',
    registeredVia: 'PORTARIA',
    operatorName: 'Marcos Vinicius (Porteiro)'
  },
  {
    id: 'pkg-003',
    trackingCode: 'NL-928374102BR',
    unitId: 'B01-A201',
    block: '1',
    apartment: 201,
    residentName: 'Carlos Silva',
    carrier: 'Correios',
    shelf: { shelf: 'A', level: 3 },
    photoUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80',
    notes: 'Sedex urgente com declaração de conteúdo',
    status: 'ARMAZENADA',
    receivedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
    qrToken: 'QR-B01A201-PKG003',
    registeredVia: 'PORTARIA',
    operatorName: 'Antônio Jorge'
  },
  {
    id: 'pkg-004',
    trackingCode: 'SHP-9920184712',
    unitId: 'B05-A304',
    block: '5',
    apartment: 304,
    residentName: 'Mariana Souza',
    carrier: 'Shopee',
    shelf: { shelf: 'C', level: 1 },
    photoUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
    notes: 'Pacote plástico cinza Shopee Xpress',
    status: 'ARMAZENADA',
    receivedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 9.8 * 3600 * 1000).toISOString(),
    qrToken: 'QR-B05A304-PKG004',
    registeredVia: 'TOTEM_ENTREGADOR',
    deliveryGuyName: 'Lucas Entregador (Shopee)',
    operatorName: 'Recepção Automática'
  },
  {
    id: 'pkg-005',
    trackingCode: 'LOG-772910482',
    unitId: 'B07-A502',
    block: '7',
    apartment: 502,
    residentName: 'Rodrigo Alves',
    carrier: 'Loggi',
    shelf: { shelf: 'B', level: 4 },
    photoUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&auto=format&fit=crop&q=80',
    notes: 'Caixa de calçado esportivo',
    status: 'ARMAZENADA',
    receivedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 13.9 * 3600 * 1000).toISOString(),
    qrToken: 'QR-B07A502-PKG005',
    registeredVia: 'PORTARIA',
    operatorName: 'Antônio Jorge'
  },
  {
    id: 'pkg-006',
    trackingCode: 'ML-559102948BR',
    unitId: 'B03-A102',
    block: '3',
    apartment: 102,
    residentName: 'Beatriz Lima',
    carrier: 'Mercado Livre',
    shelf: { shelf: 'A', level: 1 },
    photoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80',
    notes: 'Pacote entregue com sucesso e retirado pelo morador',
    status: 'RETIRADA',
    receivedAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 27.5 * 3600 * 1000).toISOString(),
    pickedUpAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    pickedUpBy: 'Beatriz Lima (Titular)',
    operatorName: 'Marcos Vinicius (Porteiro)',
    qrToken: 'QR-B03A102-PKG006-OK',
    registeredVia: 'PORTARIA'
  },
  {
    id: 'pkg-007',
    trackingCode: 'AMZ-BR-10294820',
    unitId: 'B02-A104',
    block: '2',
    apartment: 104,
    residentName: 'Juliana Costa',
    carrier: 'Amazon',
    shelf: { shelf: 'C', level: 3 },
    photoUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
    notes: 'Smart speaker entregue',
    status: 'RETIRADA',
    receivedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    storedAt: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    pickedUpAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    pickedUpBy: 'Juliana Costa',
    operatorName: 'Antônio Jorge',
    qrToken: 'QR-B02A104-PKG007',
    registeredVia: 'PORTARIA'
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-001',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    packageId: 'pkg-001',
    trackingCode: 'ML-894720194BR',
    unitString: 'Bloco 03 - Apt 102',
    action: 'ENTRADA',
    description: 'Encomenda recebida do Mercado Livre e alocada na Estante A (Prateleira 1)',
    operator: 'Marcos Vinicius (Porteiro)'
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    packageId: 'pkg-002',
    trackingCode: 'AMZ-BR-58392109',
    unitString: 'Bloco 03 - Apt 102',
    action: 'ENTRADA',
    description: 'Pacote Amazon recebido e guardado na Estante B (Prateleira 2)',
    operator: 'Marcos Vinicius (Porteiro)'
  },
  {
    id: 'log-003',
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    packageId: 'pkg-006',
    trackingCode: 'ML-559102948BR',
    unitString: 'Bloco 03 - Apt 102',
    action: 'RETIRADA',
    description: 'Baixa realizada via QR Code por Beatriz Lima',
    operator: 'Marcos Vinicius (Porteiro)'
  },
  {
    id: 'log-004',
    timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    packageId: 'pkg-004',
    trackingCode: 'SHP-9920184712',
    unitString: 'Bloco 05 - Apt 304',
    action: 'TOTEM_REGISTRO',
    description: 'Autoatendimento no Totem de Entrada pelo entregador da Shopee',
    operator: 'Totem Central'
  }
];

export const SHELF_CONFIG = [
  { shelf: 'A' as ShelfLetter, maxPerLevel: 15, name: 'Estante A (Volume Pequeno/Médio)' },
  { shelf: 'B' as ShelfLetter, maxPerLevel: 12, name: 'Estante B (Volume Médio/Pesado)' },
  { shelf: 'C' as ShelfLetter, maxPerLevel: 10, name: 'Estante C (Grandes Caixas/Frágeis)' }
];

export const SAMPLE_PACKAGE_PHOTOS = [
  'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80'
];

/**
 * Intelligent shelf suggestion: finds the shelf and level with the lowest current occupancy
 */
export function getSmartShelfSuggestion(currentPackages: PackageItem[]): { shelf: ShelfLetter; level: ShelfLevel } {
  const activePackages = currentPackages.filter(p => p.status === 'ARMAZENADA');
  
  const shelves: ShelfLetter[] = ['A', 'B', 'C'];
  const levels: ShelfLevel[] = [1, 2, 3, 4];
  
  let bestSlot: { shelf: ShelfLetter; level: ShelfLevel; count: number } = {
    shelf: 'A',
    level: 1,
    count: Infinity
  };

  for (const s of shelves) {
    for (const l of levels) {
      const count = activePackages.filter(p => p.shelf.shelf === s && p.shelf.level === l).length;
      if (count < bestSlot.count) {
        bestSlot = { shelf: s, level: l, count };
      }
    }
  }

  return { shelf: bestSlot.shelf, level: bestSlot.level };
}
