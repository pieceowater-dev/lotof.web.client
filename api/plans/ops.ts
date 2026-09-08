import { plansClient } from '@/api/clients';
import { plansRequestWithRefresh } from '@/api/plans/plansRequestWithRefresh';

// --- shapes (loose; the gateway is authoritative) ---
export interface PlansLocation {
  id: string; name: string; address: string; phone: string; lat: number; lng: number;
  isActive: boolean; isPrimary: boolean; slug: string; timezone: string; description: string;
  categoryTags: string[]; createdAt: string;
}
export interface PlansWorkingHours { id: string; locationId?: string; masterId?: string; dayOfWeek: number; startTime: string; endTime: string; isDayOff: boolean; }
export interface ServiceCategory { id: string; parentId?: string | null; name: string; sortOrder: number; isActive: boolean; }
export interface PlansService {
  id: string; categoryId?: string | null; name: string; description: string; durationMinutes: number;
  bufferAfterMinutes: number; price: number; requiresMaster: boolean; color: string; imageUrl: string;
  isActive: boolean; sortOrder: number; createdAt: string;
}
export interface PlansMaster {
  id: string; locationId: string; name: string; photoUrl: string; bio: string; phone: string;
  staffId?: string | null; atraceMemberId?: string | null; color: string; sortOrder: number; isActive: boolean; createdAt: string;
}
export interface PlansMasterService { id: string; masterId: string; serviceId: string; customDurationMinutes?: number | null; customPrice?: number | null; }
export interface PlansMasterTimeOff { id: string; masterId: string; dateFrom: string; dateTo: string; reason: string; createdAt: string; }
export interface PlansBooking {
  id: string; locationId: string; masterId?: string | null; clientId?: string | null;
  clientName: string; clientPhone: string; startAt: string; endAt: string; status: string; source: string;
  sourceTag: string; comment: string; publicToken: string; totalPrice: number; createdBy: string;
  createdAt: string; confirmedAt?: string | null; cancelledAt?: string | null; cancellationReason: string;
}
export interface PlansBookingLine { id: string; bookingId: string; serviceId: string; masterId?: string | null; serviceName: string; priceAtBooking: number; durationMinutesAtBooking: number; orderIndex: number; }
export interface PlansAvailableSlot { startAt: string; endAt: string; masterIds: string[]; }
export interface PlansSettings {
  id: string; name: string; logoUrl: string; primaryColor: string; secondaryColor: string;
  welcomeMessage: string; socialLinks: string; seoTitle: string; seoDescription: string; currency: string;
  autoConfirmBookings: boolean; minLeadTimeMinutes: number; maxAdvanceDays: number;
  cancellationWindowHours: number; defaultBufferMinutes: number; reminderFirstHoursBefore: number;
  reminderSecondHoursBefore?: number | null;
}
export interface PlansShareLink { id: string; locationId?: string | null; label: string; sourceTag: string; createdAt: string; }
export interface PlansBookingSummary { total: number; completed: number; cancelled: number; noShow: number; revenue: number; }
export interface PlansMasterLoad { masterId: string; bookingCount: number; bookedMinutes: number; availableMinutes: number; }

const LOCATION_FIELDS = `id name address phone lat lng isActive isPrimary slug timezone description categoryTags createdAt`;
const WH_FIELDS = `id locationId masterId dayOfWeek startTime endTime isDayOff`;
const SERVICE_FIELDS = `id categoryId name description durationMinutes bufferAfterMinutes price requiresMaster color imageUrl isActive sortOrder createdAt`;
const MASTER_FIELDS = `id locationId name photoUrl bio phone staffId atraceMemberId color sortOrder isActive createdAt`;
const BOOKING_FIELDS = `id locationId masterId clientId clientName clientPhone startAt endAt status source sourceTag comment publicToken totalPrice createdBy createdAt confirmedAt cancelledAt cancellationReason`;
const SETTINGS_FIELDS = `id name logoUrl primaryColor secondaryColor welcomeMessage socialLinks seoTitle seoDescription currency autoConfirmBookings minLeadTimeMinutes maxAdvanceDays cancellationWindowHours defaultBufferMinutes reminderFirstHoursBefore reminderSecondHoursBefore`;

// ---------- authenticated (admin) ----------

function q<T>(ns: string, doc: string, vars?: Record<string, any>): Promise<T> {
  return plansRequestWithRefresh(() => plansClient.request<T>(doc, vars || {}), ns);
}

export const plansApi = {
  // locations
  locations: (ns: string, includeInactive = true) =>
    q<{ plansLocations: { rows: PlansLocation[] } }>(ns, `query($i:Boolean){ plansLocations(includeInactive:$i){ rows { ${LOCATION_FIELDS} } } }`, { i: includeInactive }).then(r => r.plansLocations.rows),
  createLocation: (ns: string, input: any) =>
    q<{ createPlansLocation: PlansLocation }>(ns, `mutation($input:CreatePlansLocationInput!){ createPlansLocation(input:$input){ ${LOCATION_FIELDS} } }`, { input }).then(r => r.createPlansLocation),
  updateLocation: (ns: string, input: any) =>
    q<{ updatePlansLocation: PlansLocation }>(ns, `mutation($input:UpdatePlansLocationInput!){ updatePlansLocation(input:$input){ ${LOCATION_FIELDS} } }`, { input }).then(r => r.updatePlansLocation),
  deleteLocation: (ns: string, id: string) =>
    q<{ deletePlansLocation: { success: boolean } }>(ns, `mutation($id:ID!){ deletePlansLocation(id:$id){ success } }`, { id }).then(r => r.deletePlansLocation.success),
  locationWorkingHours: (ns: string, locationId: string) =>
    q<{ plansLocationWorkingHours: PlansWorkingHours[] }>(ns, `query($l:ID!){ plansLocationWorkingHours(locationId:$l){ ${WH_FIELDS} } }`, { l: locationId }).then(r => r.plansLocationWorkingHours),
  setLocationWorkingHours: (ns: string, locationId: string, hours: any[]) =>
    q<{ setPlansLocationWorkingHours: PlansWorkingHours[] }>(ns, `mutation($l:ID!,$h:[WorkingHoursDayInput!]!){ setPlansLocationWorkingHours(locationId:$l,hours:$h){ ${WH_FIELDS} } }`, { l: locationId, h: hours }).then(r => r.setPlansLocationWorkingHours),

  // categories + services
  categories: (ns: string) =>
    q<{ serviceCategories: { rows: ServiceCategory[] } }>(ns, `query{ serviceCategories { rows { id parentId name sortOrder isActive } } }`).then(r => r.serviceCategories.rows),
  createCategory: (ns: string, input: any) =>
    q<{ createServiceCategory: ServiceCategory }>(ns, `mutation($input:CreateServiceCategoryInput!){ createServiceCategory(input:$input){ id parentId name sortOrder isActive } }`, { input }).then(r => r.createServiceCategory),
  deleteCategory: (ns: string, id: string) =>
    q<{ deleteServiceCategory: { success: boolean } }>(ns, `mutation($id:ID!){ deleteServiceCategory(id:$id){ success } }`, { id }).then(r => r.deleteServiceCategory.success),
  services: (ns: string, includeInactive = true) =>
    q<{ plansServices: { rows: PlansService[] } }>(ns, `query($i:Boolean){ plansServices(includeInactive:$i){ rows { ${SERVICE_FIELDS} } } }`, { i: includeInactive }).then(r => r.plansServices.rows),
  createService: (ns: string, input: any) =>
    q<{ createPlansService: PlansService }>(ns, `mutation($input:CreatePlansServiceInput!){ createPlansService(input:$input){ ${SERVICE_FIELDS} } }`, { input }).then(r => r.createPlansService),
  updateService: (ns: string, input: any) =>
    q<{ updatePlansService: PlansService }>(ns, `mutation($input:UpdatePlansServiceInput!){ updatePlansService(input:$input){ ${SERVICE_FIELDS} } }`, { input }).then(r => r.updatePlansService),
  deleteService: (ns: string, id: string) =>
    q<{ deletePlansService: { success: boolean } }>(ns, `mutation($id:ID!){ deletePlansService(id:$id){ success } }`, { id }).then(r => r.deletePlansService.success),

  // masters
  masters: (ns: string, includeInactive = true) =>
    q<{ plansMasters: { rows: PlansMaster[] } }>(ns, `query($i:Boolean){ plansMasters(includeInactive:$i){ rows { ${MASTER_FIELDS} } } }`, { i: includeInactive }).then(r => r.plansMasters.rows),
  createMaster: (ns: string, input: any) =>
    q<{ createPlansMaster: PlansMaster }>(ns, `mutation($input:CreatePlansMasterInput!){ createPlansMaster(input:$input){ ${MASTER_FIELDS} } }`, { input }).then(r => r.createPlansMaster),
  updateMaster: (ns: string, input: any) =>
    q<{ updatePlansMaster: PlansMaster }>(ns, `mutation($input:UpdatePlansMasterInput!){ updatePlansMaster(input:$input){ ${MASTER_FIELDS} } }`, { input }).then(r => r.updatePlansMaster),
  deleteMaster: (ns: string, id: string) =>
    q<{ deletePlansMaster: { success: boolean } }>(ns, `mutation($id:ID!){ deletePlansMaster(id:$id){ success } }`, { id }).then(r => r.deletePlansMaster.success),
  masterWorkingHours: (ns: string, masterId: string) =>
    q<{ plansMasterWorkingHours: PlansWorkingHours[] }>(ns, `query($m:ID!){ plansMasterWorkingHours(masterId:$m){ ${WH_FIELDS} } }`, { m: masterId }).then(r => r.plansMasterWorkingHours),
  setMasterWorkingHours: (ns: string, masterId: string, hours: any[]) =>
    q<{ setPlansMasterWorkingHours: PlansWorkingHours[] }>(ns, `mutation($m:ID!,$h:[WorkingHoursDayInput!]!){ setPlansMasterWorkingHours(masterId:$m,hours:$h){ ${WH_FIELDS} } }`, { m: masterId, h: hours }).then(r => r.setPlansMasterWorkingHours),
  masterServices: (ns: string, masterId: string) =>
    q<{ masterServices: PlansMasterService[] }>(ns, `query($m:ID!){ masterServices(masterId:$m){ id masterId serviceId customDurationMinutes customPrice } }`, { m: masterId }).then(r => r.masterServices),
  setMasterServices: (ns: string, masterId: string, items: any[]) =>
    q<{ setMasterServices: PlansMasterService[] }>(ns, `mutation($m:ID!,$i:[MasterServiceLinkInput!]!){ setMasterServices(masterId:$m,items:$i){ id masterId serviceId } }`, { m: masterId, i: items }).then(r => r.setMasterServices),
  masterTimeOff: (ns: string, masterId: string) =>
    q<{ plansMasterTimeOff: PlansMasterTimeOff[] }>(ns, `query($m:ID!){ plansMasterTimeOff(masterId:$m){ id masterId dateFrom dateTo reason createdAt } }`, { m: masterId }).then(r => r.plansMasterTimeOff),
  createMasterTimeOff: (ns: string, masterId: string, dateFrom: string, dateTo: string, reason: string) =>
    q<{ createPlansMasterTimeOff: PlansMasterTimeOff }>(ns, `mutation($m:ID!,$f:String!,$t:String!,$r:String){ createPlansMasterTimeOff(masterId:$m,dateFrom:$f,dateTo:$t,reason:$r){ id } }`, { m: masterId, f: dateFrom, t: dateTo, r: reason }).then(r => r.createPlansMasterTimeOff),
  deleteMasterTimeOff: (ns: string, id: string) =>
    q<{ deletePlansMasterTimeOff: { success: boolean } }>(ns, `mutation($id:ID!){ deletePlansMasterTimeOff(id:$id){ success } }`, { id }).then(r => r.deletePlansMasterTimeOff.success),

  // bookings
  bookings: (ns: string, filter: any) =>
    q<{ bookings: { rows: PlansBooking[]; info: { count: number } } }>(ns, `query($f:BookingFilterInput){ bookings(filter:$f){ rows { ${BOOKING_FIELDS} } info { count } } }`, { f: filter }).then(r => r.bookings),
  bookingServices: (ns: string, bookingId: string) =>
    q<{ bookingServices: PlansBookingLine[] }>(ns, `query($b:ID!){ bookingServices(bookingId:$b){ id bookingId serviceId masterId serviceName priceAtBooking durationMinutesAtBooking orderIndex } }`, { b: bookingId }).then(r => r.bookingServices),
  bookingServicesByBookings: (ns: string, ids: string[]) =>
    q<{ bookingServicesByBookings: PlansBookingLine[] }>(ns, `query($ids:[ID!]!){ bookingServicesByBookings(bookingIds:$ids){ id bookingId serviceName } }`, { ids }).then(r => r.bookingServicesByBookings),
  createBooking: (ns: string, input: any) =>
    q<{ createBooking: PlansBooking }>(ns, `mutation($input:CreatePlansBookingInput!){ createBooking(input:$input){ ${BOOKING_FIELDS} } }`, { input }).then(r => r.createBooking),
  updateBookingStatus: (ns: string, id: string, status: string, comment?: string) =>
    q<{ updateBookingStatus: PlansBooking }>(ns, `mutation($id:ID!,$s:String!,$c:String){ updateBookingStatus(id:$id,status:$s,comment:$c){ ${BOOKING_FIELDS} } }`, { id, s: status, c: comment }).then(r => r.updateBookingStatus),
  rescheduleBooking: (ns: string, id: string, startAt: string, masterId?: string) =>
    q<{ rescheduleBooking: PlansBooking }>(ns, `mutation($id:ID!,$s:String!,$m:ID){ rescheduleBooking(id:$id,startAt:$s,masterId:$m){ ${BOOKING_FIELDS} } }`, { id, s: startAt, m: masterId }).then(r => r.rescheduleBooking),
  availableSlots: (ns: string, locationId: string, serviceId: string, date: string, masterId?: string) =>
    q<{ availableSlots: PlansAvailableSlot[] }>(ns, `query($l:ID!,$s:ID!,$d:String!,$m:ID){ availableSlots(locationId:$l,serviceId:$s,date:$d,masterId:$m){ startAt endAt masterIds } }`, { l: locationId, s: serviceId, d: date, m: masterId }).then(r => r.availableSlots),

  // settings + sharelinks
  settings: (ns: string) =>
    q<{ plansSettings: PlansSettings }>(ns, `query{ plansSettings { ${SETTINGS_FIELDS} } }`).then(r => r.plansSettings),
  upsertSettings: (ns: string, input: any) =>
    q<{ upsertPlansSettings: PlansSettings }>(ns, `mutation($input:UpsertPlansSettingsInput!){ upsertPlansSettings(input:$input){ ${SETTINGS_FIELDS} } }`, { input }).then(r => r.upsertPlansSettings),
  shareLinks: (ns: string) =>
    q<{ plansShareLinks: PlansShareLink[] }>(ns, `query{ plansShareLinks { id locationId label sourceTag createdAt } }`).then(r => r.plansShareLinks),
  createShareLink: (ns: string, input: any) =>
    q<{ createPlansShareLink: PlansShareLink }>(ns, `mutation($input:CreatePlansShareLinkInput!){ createPlansShareLink(input:$input){ id label sourceTag createdAt } }`, { input }).then(r => r.createPlansShareLink),
  deleteShareLink: (ns: string, id: string) =>
    q<{ deletePlansShareLink: { success: boolean } }>(ns, `mutation($id:ID!){ deletePlansShareLink(id:$id){ success } }`, { id }).then(r => r.deletePlansShareLink.success),

  // reports
  summarize: (ns: string, from?: string, to?: string) =>
    q<{ summarizeBookings: PlansBookingSummary }>(ns, `query($f:String,$t:String){ summarizeBookings(from:$f,to:$t){ total completed cancelled noShow revenue } }`, { f: from, t: to }).then(r => r.summarizeBookings),
  masterLoad: (ns: string, from?: string, to?: string) =>
    q<{ masterLoad: PlansMasterLoad[] }>(ns, `query($f:String,$t:String){ masterLoad(from:$f,to:$t){ masterId bookingCount bookedMinutes availableMinutes } }`, { f: from, t: to }).then(r => r.masterLoad),
};

// ---------- public (unauthenticated; namespace via header) ----------

function pub<T>(ns: string, doc: string, vars?: Record<string, any>): Promise<T> {
  return plansClient.request<T>(doc, vars || {}, { headers: { Namespace: ns } });
}

export const plansPublicApi = {
  settings: (ns: string) => pub<{ publicPlansSettings: PlansSettings }>(ns, `query{ publicPlansSettings { ${SETTINGS_FIELDS} } }`).then(r => r.publicPlansSettings),
  location: (ns: string, slug: string) => pub<{ publicLocation: PlansLocation | null }>(ns, `query($s:String!){ publicLocation(slug:$s){ ${LOCATION_FIELDS} } }`, { s: slug }).then(r => r.publicLocation),
  locations: (ns: string) => pub<{ publicLocations: { rows: PlansLocation[] } }>(ns, `query{ publicLocations { rows { ${LOCATION_FIELDS} } } }`).then(r => r.publicLocations.rows),
  locationWorkingHours: (ns: string, locationId: string) => pub<{ publicLocationWorkingHours: PlansWorkingHours[] }>(ns, `query($l:ID!){ publicLocationWorkingHours(locationId:$l){ ${WH_FIELDS} } }`, { l: locationId }).then(r => r.publicLocationWorkingHours),
  categories: (ns: string) => pub<{ publicServiceCategories: { rows: ServiceCategory[] } }>(ns, `query{ publicServiceCategories { rows { id parentId name sortOrder isActive } } }`).then(r => r.publicServiceCategories.rows),
  services: (ns: string) => pub<{ publicServices: { rows: PlansService[] } }>(ns, `query{ publicServices { rows { ${SERVICE_FIELDS} } } }`).then(r => r.publicServices.rows),
  masters: (ns: string, serviceId?: string, locationId?: string) => pub<{ publicMasters: { rows: PlansMaster[] } }>(ns, `query($s:ID,$l:ID){ publicMasters(serviceId:$s,locationId:$l){ rows { ${MASTER_FIELDS} } } }`, { s: serviceId, l: locationId }).then(r => r.publicMasters.rows),
  availableSlots: (ns: string, locationId: string, serviceId: string, date: string, masterId?: string) =>
    pub<{ publicAvailableSlots: PlansAvailableSlot[] }>(ns, `query($l:ID!,$s:ID!,$d:String!,$m:ID){ publicAvailableSlots(locationId:$l,serviceId:$s,date:$d,masterId:$m){ startAt endAt masterIds } }`, { l: locationId, s: serviceId, d: date, m: masterId }).then(r => r.publicAvailableSlots),
  availableDays: (ns: string, locationId: string, serviceId: string, month: string, masterId?: string) =>
    pub<{ publicAvailableDays: string[] }>(ns, `query($l:ID!,$s:ID!,$mo:String!,$m:ID){ publicAvailableDays(locationId:$l,serviceId:$s,month:$mo,masterId:$m) }`, { l: locationId, s: serviceId, mo: month, m: masterId }).then(r => r.publicAvailableDays),
  createBooking: (ns: string, input: any, clientGeneratedId: string) =>
    pub<{ publicCreateBooking: PlansBooking }>(ns, `mutation($input:CreatePlansBookingInput!,$c:String!){ publicCreateBooking(input:$input,clientGeneratedId:$c){ ${BOOKING_FIELDS} } }`, { input, c: clientGeneratedId }).then(r => r.publicCreateBooking),
  booking: (ns: string, token: string) =>
    pub<{ publicBooking: PlansBooking | null }>(ns, `query($t:String!){ publicBooking(publicToken:$t){ ${BOOKING_FIELDS} } }`, { t: token }).then(r => r.publicBooking),
  cancelBooking: (ns: string, token: string, reason?: string) =>
    pub<{ publicCancelBooking: PlansBooking }>(ns, `mutation($t:String!,$r:String){ publicCancelBooking(publicToken:$t,reason:$r){ ${BOOKING_FIELDS} } }`, { t: token, r: reason }).then(r => r.publicCancelBooking),
  rescheduleBooking: (ns: string, token: string, startAt: string, masterId?: string) =>
    pub<{ publicRescheduleBooking: PlansBooking }>(ns, `mutation($t:String!,$s:String!,$m:ID){ publicRescheduleBooking(publicToken:$t,startAt:$s,masterId:$m){ ${BOOKING_FIELDS} } }`, { t: token, s: startAt, m: masterId }).then(r => r.publicRescheduleBooking),
};
