import { menuDocVariableToken, type MenuDocVariableKey, type MenuDocVariableLocale } from '@/utils/menuDocVariables';
import type { OrderFieldDataType } from '@/api/menu/orderfield/list';

// What the "Service center / repairs" business type adds on top of the starter
// catalog (works + parts, see the backend preset): the extra order fields a
// repair order needs and the three printable documents. Everything is plain
// data the owner can edit afterwards in Settings -> Order fields / Documents.

export type ServiceCenterLocale = MenuDocVariableLocale;

export type PresetOrderField = { label: string; dataType: OrderFieldDataType; isRequired: boolean };
export type PresetDocumentTemplate = { name: string; content: string };

const FIELDS: Record<ServiceCenterLocale, PresetOrderField[]> = {
  ru: [
    { label: 'Устройство, модель', dataType: 'TEXT', isRequired: true },
    { label: 'Серийный номер / IMEI', dataType: 'TEXT', isRequired: false },
    { label: 'Неисправность', dataType: 'TEXT', isRequired: true },
    { label: 'Комплектация', dataType: 'TEXT', isRequired: false },
    { label: 'Внешний вид', dataType: 'TEXT', isRequired: false },
  ],
  en: [
    { label: 'Device, model', dataType: 'TEXT', isRequired: true },
    { label: 'Serial number / IMEI', dataType: 'TEXT', isRequired: false },
    { label: 'Reported problem', dataType: 'TEXT', isRequired: true },
    { label: 'Accessories included', dataType: 'TEXT', isRequired: false },
    { label: 'Condition on arrival', dataType: 'TEXT', isRequired: false },
  ],
  kk: [
    { label: 'Құрылғы, моделі', dataType: 'TEXT', isRequired: true },
    { label: 'Сериялық нөмір / IMEI', dataType: 'TEXT', isRequired: false },
    { label: 'Ақаулық', dataType: 'TEXT', isRequired: true },
    { label: 'Жиынтықтылығы', dataType: 'TEXT', isRequired: false },
    { label: 'Сыртқы түрі', dataType: 'TEXT', isRequired: false },
  ],
};

type Words = {
  avrName: string; avrTitle: string; from: string; contractor: string; customer: string;
  device: string; works: string; worksTotal: string; parts: string; partsTotal: string;
  total: string; discount: string; paid: string; due: string; warranty: string; avrNote: string;
  signContractor: string; signCustomer: string;
  receiptName: string; receiptTitle: string; seller: string; buyer: string; items: string; thanks: string;
  intakeName: string; intakeTitle: string; intakeNote: string; acceptedBy: string; handedBy: string;
};

const WORDS: Record<ServiceCenterLocale, Words> = {
  ru: {
    avrName: 'Акт выполненных работ (АВР)', avrTitle: 'Акт выполненных работ №', from: 'от', contractor: 'Исполнитель', customer: 'Заказчик',
    device: 'Устройство', works: 'Выполненные работы', worksTotal: 'Итого работы', parts: 'Запчасти и материалы', partsTotal: 'Итого запчасти',
    total: 'Итого', discount: 'Скидка', paid: 'Оплачено', due: 'К оплате', warranty: 'Гарантия',
    avrNote: 'Работы выполнены в полном объёме и в срок. Заказчик претензий по объёму, качеству и срокам не имеет.',
    signContractor: 'Исполнитель', signCustomer: 'Заказчик',
    receiptName: 'Товарный чек', receiptTitle: 'Товарный чек №', seller: 'Продавец', buyer: 'Покупатель', items: 'Товары и услуги', thanks: 'Спасибо за обращение!',
    intakeName: 'Акт приёма устройства', intakeTitle: 'Акт приёма устройства в ремонт №',
    intakeNote: 'Устройство принято в указанном состоянии и комплектации. Стоимость и сроки ремонта согласуются после диагностики.',
    acceptedBy: 'Принял', handedBy: 'Сдал',
  },
  en: {
    avrName: 'Certificate of completed work', avrTitle: 'Certificate of completed work #', from: 'dated', contractor: 'Contractor', customer: 'Customer',
    device: 'Device', works: 'Work performed', worksTotal: 'Work total', parts: 'Parts and materials', partsTotal: 'Parts total',
    total: 'Total', discount: 'Discount', paid: 'Paid', due: 'Amount due', warranty: 'Warranty',
    avrNote: 'The work was completed in full and on time. The customer has no claims regarding scope, quality or timing.',
    signContractor: 'Contractor', signCustomer: 'Customer',
    receiptName: 'Sales receipt', receiptTitle: 'Sales receipt #', seller: 'Seller', buyer: 'Buyer', items: 'Goods and services', thanks: 'Thank you!',
    intakeName: 'Device intake form', intakeTitle: 'Device intake form #',
    intakeNote: 'The device was accepted in the condition and with the accessories listed above. Price and timing are agreed after diagnostics.',
    acceptedBy: 'Accepted by', handedBy: 'Handed over by',
  },
  kk: {
    avrName: 'Орындалған жұмыстар актісі', avrTitle: 'Орындалған жұмыстар актісі №', from: 'күні:', contractor: 'Орындаушы', customer: 'Тапсырыс беруші',
    device: 'Құрылғы', works: 'Орындалған жұмыстар', worksTotal: 'Жұмыстар жиыны', parts: 'Бөлшектер мен материалдар', partsTotal: 'Бөлшектер жиыны',
    total: 'Барлығы', discount: 'Жеңілдік', paid: 'Төленді', due: 'Төлеуге', warranty: 'Кепілдік',
    avrNote: 'Жұмыстар толық көлемде және уақытында орындалды. Тапсырыс беруші көлемі, сапасы және мерзімі бойынша шағымы жоқ.',
    signContractor: 'Орындаушы', signCustomer: 'Тапсырыс беруші',
    receiptName: 'Тауар чегі', receiptTitle: 'Тауар чегі №', seller: 'Сатушы', buyer: 'Сатып алушы', items: 'Тауарлар мен қызметтер', thanks: 'Хабарласқаныңызға рахмет!',
    intakeName: 'Құрылғыны қабылдау актісі', intakeTitle: 'Құрылғыны жөндеуге қабылдау актісі №',
    intakeNote: 'Құрылғы жоғарыда көрсетілген күйде және жиынтықтылықпен қабылданды. Баға мен мерзім диагностикадан кейін келісіледі.',
    acceptedBy: 'Қабылдаған', handedBy: 'Тапсырған',
  },
};

// Inline styles only: the printable document is plain HTML with no
// stylesheet of its own.
const H = 'text-align:center;margin:0 0 4px';
const SUB = 'text-align:center;margin:0 0 16px';
const SIGN = 'margin-top:40px';

export function serviceCenterOrderFields(locale: ServiceCenterLocale): PresetOrderField[] {
  return FIELDS[locale] ?? FIELDS.ru;
}

export function serviceCenterTemplates(locale: ServiceCenterLocale): PresetDocumentTemplate[] {
  const w = WORDS[locale] ?? WORDS.ru;
  const L: ServiceCenterLocale = WORDS[locale] ? locale : 'ru';
  const v = (key: MenuDocVariableKey) => menuDocVariableToken(key, L);
  const parties = (a: string, b: string) =>
    `<p><b>${a}:</b> ${v('BRAND_NAME')}, ${v('BRANCH_ADDRESS')}, ${v('BRANCH_PHONE')}</p>` +
    `<p><b>${b}:</b> ${v('CLIENT_NAME')}, ${v('CLIENT_PHONE')}</p>`;

  const avr =
    `<h2 style="${H}">${w.avrTitle} ${v('ORDER_NUMBER')}</h2>` +
    `<p style="${SUB}">${w.from} ${v('TODAY_DATE')}</p>` +
    parties(w.contractor, w.customer) +
    `<h3>${w.device}</h3>${v('CUSTOM_FIELDS')}` +
    `<h3>${w.works}</h3>${v('ORDER_WORKS')}<p style="text-align:right">${w.worksTotal}: ${v('ORDER_WORKS_TOTAL')}</p>` +
    `<h3>${w.parts}</h3>${v('ORDER_MATERIALS')}<p style="text-align:right">${w.partsTotal}: ${v('ORDER_MATERIALS_TOTAL')}</p>` +
    `<p style="text-align:right"><b>${w.total}: ${v('ORDER_TOTAL_AMOUNT')}</b><br>${w.discount}: ${v('DISCOUNT_AMOUNT')}<br>${w.paid}: ${v('PAID_AMOUNT')}<br><b>${w.due}: ${v('AMOUNT_DUE')}</b></p>` +
    `<h3>${w.warranty}</h3>${v('ORDER_WARRANTY')}` +
    `<p>${w.avrNote}</p>` +
    `<p style="${SIGN}">${w.signContractor}: ______________________ &nbsp;&nbsp;&nbsp; ${w.signCustomer}: ______________________</p>`;

  const receipt =
    `<h2 style="${H}">${w.receiptTitle} ${v('ORDER_NUMBER')}</h2>` +
    `<p style="${SUB}">${w.from} ${v('TODAY_DATE')}</p>` +
    parties(w.seller, w.buyer) +
    `<h3>${w.items}</h3>${v('ORDER_ITEMS')}` +
    `<p style="text-align:right"><b>${w.total}: ${v('ORDER_TOTAL_AMOUNT')}</b><br>${w.discount}: ${v('DISCOUNT_AMOUNT')}<br>${w.paid}: ${v('PAID_AMOUNT')}</p>` +
    `<h3>${w.warranty}</h3>${v('ORDER_WARRANTY')}` +
    `<p style="${SIGN}">${w.thanks}</p>`;

  const intake =
    `<h2 style="${H}">${w.intakeTitle} ${v('ORDER_NUMBER')}</h2>` +
    `<p style="${SUB}">${w.from} ${v('TODAY_DATE')}</p>` +
    parties(w.contractor, w.customer) +
    `<h3>${w.device}</h3>${v('CUSTOM_FIELDS')}` +
    `<p>${w.intakeNote}</p>` +
    `<p style="${SIGN}">${w.acceptedBy}: ______________________ &nbsp;&nbsp;&nbsp; ${w.handedBy}: ______________________</p>`;

  return [
    { name: w.avrName, content: avr },
    { name: w.receiptName, content: receipt },
    { name: w.intakeName, content: intake },
  ];
}
