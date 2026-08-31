import { StaffAccount, StaffRole } from '../types';
import { hashPassword } from '../services/auth.service';

// Contas de demonstração (reaproveitam os nomes de operadores já usados em mockData.ts).
// Senha de demo única para facilitar o teste: "village123".
const STAFF_SEED: { id: string; name: string; email: string; role: StaffRole; demoPassword: string }[] = [
  { id: 'staff-1', name: 'Marcos Vinicius', email: 'marcos.portaria@villageazaleia.com.br', role: 'portaria', demoPassword: 'village123' },
  { id: 'staff-2', name: 'Antônio Jorge', email: 'antonio.portaria@villageazaleia.com.br', role: 'portaria', demoPassword: 'village123' },
  { id: 'staff-3', name: 'Roberto Nunes', email: 'sindico@villageazaleia.com.br', role: 'sindico', demoPassword: 'village123' }
];

export async function generateSeedStaffAccounts(): Promise<StaffAccount[]> {
  return Promise.all(
    STAFF_SEED.map(async (s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      passwordHash: await hashPassword(s.demoPassword),
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
    }))
  );
}
