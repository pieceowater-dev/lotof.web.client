import type { ClientRow } from '@/api/contacts/listClients';

const baseClients: ClientRow[] = [
  // Individual - Active
  {
    client: {
      id: '1',
      clientType: 'INDIVIDUAL',
      status: 'ACTIVE',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-02-20T14:22:00Z',
    },
    individual: {
      firstName: 'Алексей',
      lastName: 'Иванов',
      middleName: 'Петрович',
      birthDate: '1985-06-15',
      gender: 'male',
    },
  },
  
  // Individual - Blocked
  {
    client: {
      id: '2',
      clientType: 'INDIVIDUAL',
      status: 'BLOCKED',
      createdAt: '2023-11-22T09:15:00Z',
      updatedAt: '2024-01-10T16:45:00Z',
    },
    individual: {
      firstName: 'Мария',
      lastName: 'Смирнова',
      middleName: 'Александровна',
      birthDate: '1992-03-28',
      gender: 'female',
    },
  },
  
  // Individual - No middle name
  {
    client: {
      id: '3',
      clientType: 'INDIVIDUAL',
      status: 'ACTIVE',
      createdAt: '2024-02-01T11:00:00Z',
      updatedAt: '2024-02-15T13:30:00Z',
    },
    individual: {
      firstName: 'John',
      lastName: 'Smith',
      birthDate: '1988-09-12',
      gender: 'male',
    },
  },
  
  // Legal Entity - With brand name
  {
    client: {
      id: '4',
      clientType: 'LEGAL',
      status: 'ACTIVE',
      createdAt: '2023-05-10T08:20:00Z',
      updatedAt: '2024-02-18T10:15:00Z',
    },
    legalEntity: {
      legalName: 'ТОО "Рога и Копыта"',
      brandName: 'Рога и Копыта',
      binIin: '123456789012',
      registrationCountry: 'Kazakhstan',
      registrationDate: '2020-03-15',
    },
  },
  
  // Legal Entity - Archived
  {
    client: {
      id: '5',
      clientType: 'LEGAL',
      status: 'ARCHIVED',
      createdAt: '2022-08-05T14:30:00Z',
      updatedAt: '2023-12-20T09:00:00Z',
    },
    legalEntity: {
      legalName: 'ИП Сидоров Иван Иванович',
      binIin: '987654321098',
      registrationCountry: 'Russia',
      registrationDate: '2015-06-20',
    },
  },
  
  // Legal Entity - Active with long name
  {
    client: {
      id: '6',
      clientType: 'LEGAL',
      status: 'ACTIVE',
      createdAt: '2024-01-20T12:45:00Z',
      updatedAt: '2024-02-22T15:20:00Z',
    },
    legalEntity: {
      legalName: 'ТОО "Международная IT-компания по разработке программного обеспечения и консалтингу"',
      brandName: 'МеждуIT',
      binIin: '111222333444',
      registrationCountry: 'Kazakhstan',
      registrationDate: '2021-11-10',
    },
  },
  
  // Individual - Archived
  {
    client: {
      id: '7',
      clientType: 'INDIVIDUAL',
      status: 'ARCHIVED',
      createdAt: '2023-03-15T10:10:00Z',
      updatedAt: '2023-09-25T11:30:00Z',
    },
    individual: {
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: 'Владимировна',
      birthDate: '1995-12-05',
      gender: 'female',
    },
  },
  
  // Legal Entity - Blocked
  {
    client: {
      id: '8',
      clientType: 'LEGAL',
      status: 'BLOCKED',
      createdAt: '2023-07-12T09:30:00Z',
      updatedAt: '2024-01-15T16:00:00Z',
    },
    legalEntity: {
      legalName: 'АО "Казахстанская Телекоммуникационная Сеть"',
      brandName: 'КазТелеком',
      binIin: '555666777888',
      registrationCountry: 'Kazakhstan',
      registrationDate: '2018-04-22',
    },
  },
  
  // Individual - Young person
  {
    client: {
      id: '9',
      clientType: 'INDIVIDUAL',
      status: 'ACTIVE',
      createdAt: '2024-02-10T14:25:00Z',
      updatedAt: '2024-02-23T09:15:00Z',
    },
    individual: {
      firstName: 'Дмитрий',
      lastName: 'Новиков',
      middleName: 'Андреевич',
      birthDate: '2002-07-18',
      gender: 'male',
    },
  },
  
  // Legal Entity - Minimal info
  {
    client: {
      id: '10',
      clientType: 'LEGAL',
      status: 'ACTIVE',
      createdAt: '2024-02-15T08:00:00Z',
      updatedAt: '2024-02-15T08:00:00Z',
    },
    legalEntity: {
      legalName: 'ИП Карасев',
      binIin: '999888777666',
      registrationCountry: 'Kazakhstan',
      registrationDate: '2024-01-10',
    },
  },
];

// Generate 40x mock data for infinite scroll testing
export const mockClients: ClientRow[] = Array.from({ length: 40 }, (_, batchIndex) => 
  baseClients.map((client, clientIndex) => ({
    ...client,
    client: {
      ...client.client,
      id: `${batchIndex * baseClients.length + clientIndex + 1}`,
    },
  }))
).flat();
