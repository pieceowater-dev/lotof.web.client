import { describe, it, expect } from 'vitest';
import { formatStorageMb, planFeatureLabel } from '@/utils/planFeatures';

describe('plan storage quota', () => {
  it('formats megabytes and gigabytes', () => {
    expect(formatStorageMb(512)).toBe('512 MB');
    expect(formatStorageMb(5120, { mb: 'МБ', gb: 'ГБ' })).toBe('5 ГБ');
    expect(formatStorageMb(1536)).toBe('1.5 GB');
    expect(formatStorageMb(0)).toBe('');
  });

  it('labels the storage feature with a readable size', () => {
    const t = (k: string, p?: Record<string, string | number>) => (k === 'app.planFeature.storage_mb' ? `Storage: ${p?.value}` : '');
    expect(planFeatureLabel({ key: 'storage_mb', value: 2048 }, t)).toBe('Storage: 2 GB');
  });
});
