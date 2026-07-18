import { PaginationLength } from '@/utils/constants';

export type ApiPaginationLength = 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'ONE_HUNDRED';

// A-Trace's post/route list APIs only support a coarser set of page lengths
// than the app-wide PaginationLength enum, so UI selections are bucketed
// down to the closest supported value.
const LENGTH_MAP: Record<PaginationLength, ApiPaginationLength> = {
  [PaginationLength.TEN]: 'TEN',
  [PaginationLength.FIFTEEN]: 'TEN',
  [PaginationLength.TWENTY]: 'TWENTY_FIVE',
  [PaginationLength.TWENTY_FIVE]: 'TWENTY_FIVE',
  [PaginationLength.THIRTY]: 'FIFTY',
  [PaginationLength.THIRTY_FIVE]: 'FIFTY',
  [PaginationLength.FORTY]: 'FIFTY',
  [PaginationLength.FORTY_FIVE]: 'FIFTY',
  [PaginationLength.FIFTY]: 'FIFTY',
  [PaginationLength.FIFTY_FIVE]: 'ONE_HUNDRED',
  [PaginationLength.SIXTY]: 'ONE_HUNDRED',
  [PaginationLength.SIXTY_FIVE]: 'ONE_HUNDRED',
  [PaginationLength.SEVENTY]: 'ONE_HUNDRED',
  [PaginationLength.SEVENTY_FIVE]: 'ONE_HUNDRED',
  [PaginationLength.EIGHTY]: 'ONE_HUNDRED',
  [PaginationLength.EIGHTY_FIVE]: 'ONE_HUNDRED',
  [PaginationLength.NINETY]: 'ONE_HUNDRED',
  [PaginationLength.NINETY_FIVE]: 'ONE_HUNDRED',
  [PaginationLength.ONE_HUNDRED]: 'ONE_HUNDRED',
};

export function mapPaginationLength(length: PaginationLength): ApiPaginationLength {
  return LENGTH_MAP[length];
}
