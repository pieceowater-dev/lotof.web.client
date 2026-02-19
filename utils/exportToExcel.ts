/**
 * Utility to export attendance data to Excel with styling, grouping, and localization
 */
import * as XLSX from 'xlsx';

interface UserStats {
  userId: string;
  username?: string;
  email?: string;
  workDays: number;
  attendedDays: number;
  violationDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
}

interface UserDailyRecord {
  userId: string;
  username: string;
  date: string;
  firstCheckIn: number; // unix timestamp in milliseconds
  lastCheckOut: number; // unix timestamp in milliseconds
  workedHours: number;
  attended: boolean;
  legitimate: boolean;
  reason?: string;
}

interface Locale {
  title: string;
  period: string;
  generated: string;
  totalUsers: string;
  totalRecords: string;
  userId: string;
  username: string;
  email: string;
  workDays: string;
  attendedDays: string;
  violationDays: string;
  legitimateAbsences: string;
  totalWorkedHours: string;
  userTotal: string;
  date: string;
  firstCheckIn: string;
  lastCheckOut: string;
  hoursWorked: string;
  attended: string;
  legitimate: string;
  reason: string;
  dailyTitle: string;
  yes: string;
  no: string;
}

const locales: { [key: string]: Locale } = {
  en: {
    title: 'Attendance Report',
    period: 'Period',
    generated: 'Generated',
    totalUsers: 'Total Users',
    totalRecords: 'Total Records',
    userId: 'User ID',
    username: 'Username',
    email: 'Email',
    workDays: 'Work Days',
    attendedDays: 'Attended Days',
    violationDays: 'Violation Days',
    legitimateAbsences: 'Legitimate Absences',
    totalWorkedHours: 'Total Worked Hours',
    userTotal: 'User Total',
    date: 'Date',
    firstCheckIn: 'First Check-In',
    lastCheckOut: 'Last Check-Out',
    hoursWorked: 'Hours Worked',
    attended: 'Attended',
    legitimate: 'Legitimate',
    reason: 'Reason',
    dailyTitle: 'Daily Attendance Report',
    yes: 'Yes',
    no: 'No',
  },
  ru: {
    title: 'Отчет о посещаемости',
    period: 'Период',
    generated: 'Создано',
    totalUsers: 'Всего пользователей',
    totalRecords: 'Всего записей',
    userId: 'ID пользователя',
    username: 'Имя пользователя',
    email: 'Email',
    workDays: 'Рабочие дни',
    attendedDays: 'Дни присутствия',
    violationDays: 'Дни нарушений',
    legitimateAbsences: 'Обоснованные отсутствия',
    totalWorkedHours: 'Итого часов работы',
    userTotal: 'Итог пользователя',
    date: 'Дата',
    firstCheckIn: 'Первый приход',
    lastCheckOut: 'Последний уход',
    hoursWorked: 'Часов работано',
    attended: 'Присутствие',
    legitimate: 'Обоснованно',
    reason: 'Причина',
    dailyTitle: 'Отчет о ежедневной посещаемости',
    yes: 'Да',
    no: 'Нет',
  },
};

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getLocale(lang: string = 'en'): Locale {
  return locales[lang] || locales['en'];
}

function columnNumberToName(col: number): string {
  let name = '';
  while (col >= 0) {
    name = String.fromCharCode((col % 26) + 65) + name;
    col = Math.floor(col / 26) - 1;
  }
  return name;
}

function getCellAddress(row: number, col: number): string {
  const colLetter = columnNumberToName(col);
  return `${colLetter}${row}`;
}

function generateDateRange(startDate: string, endDate: string, locale: string): { dates: string[]; displayDates: string[] } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];
  const displayDates: string[] = [];
  const localeId = locale === 'ru' ? 'ru-RU' : 'en-GB';
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0];
    dates.push(iso);
    const ddmmyyyy = d
      .toLocaleDateString(localeId, { day: '2-digit', month: '2-digit', year: 'numeric' })
      .replace(/[\/]/g, '.');
    displayDates.push(ddmmyyyy);
  }
  
  return { dates, displayDates };
}

function buildPivotTableData(
  data: UserDailyRecord[],
  dates: string[],
  displayDates: string[],
  locale: Locale
): { pivotData: any[]; headers: string[] } {
  const recordsByUserAndDate = new Map<string, Map<string, UserDailyRecord>>();
  
  for (const record of data) {
    if (!recordsByUserAndDate.has(record.username)) {
      recordsByUserAndDate.set(record.username, new Map());
    }
    recordsByUserAndDate.get(record.username)!.set(record.date, record);
  }

  const sortedUsers = Array.from(recordsByUserAndDate.keys()).sort();
  const pivotData: any[] = [];
  const headers: string[] = [locale.username, ...displayDates, locale.userTotal];

  for (const username of sortedUsers) {
    const row: any = { [locale.username]: username };
    let totalHours = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const header = displayDates[i];
      const record = recordsByUserAndDate.get(username)!.get(date);
      
      if (record) {
        const checkInTime = new Date(record.firstCheckIn).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const checkOutTime = new Date(record.lastCheckOut).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        row[header] = `${checkInTime} - ${checkOutTime}`;
        totalHours += record.workedHours;
      } else {
        row[header] = '-';
      }
    }
    
    row[locale.userTotal] = totalHours.toFixed(2);
    pivotData.push(row);
  }

  return { pivotData, headers };
}

function applyPivotTableStyling(worksheet: XLSX.WorkSheet, headers: string[], pivotDataLength: number, dates: string[]): void {
  const headerStyle = {
    font: { bold: true, color: 'FFFFFF', size: 12 },
    fill: { fgColor: { rgb: '4472C4' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };

  // Style headers
  const headerRow = 1;
  const columnsCount = headers.length;
  for (let col = 0; col < columnsCount; col++) {
    const cell = getCellAddress(headerRow, col);
    if (worksheet[cell]) {
      worksheet[cell].s = headerStyle;
    }
  }

  // Apply alternating row colors
  for (let rowIdx = 0; rowIdx < pivotDataLength; rowIdx++) {
    const row = headerRow + 1 + rowIdx;
    const rowStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: rowIdx % 2 === 0 ? { fgColor: { rgb: 'E7E6E6' } } : { fgColor: { rgb: 'FFFFFF' } },
    };
    for (let col = 0; col < columnsCount; col++) {
      const cell = getCellAddress(row, col);
      if (worksheet[cell]) {
        worksheet[cell].s = rowStyle;
      }
    }
  }
}

export async function exportPivotTableToExcel(
    data: UserDailyRecord[],
    startDate: string,
    endDate: string,
    language: string = 'en',
    filename?: string
  ): Promise<void> {
    const locale = getLocale(language);

    // Generate date range
    const { dates, displayDates } = generateDateRange(startDate, endDate, language);

    // Build pivot table data
    const { pivotData, headers } = buildPivotTableData(data, dates, displayDates, locale);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(pivotData, { header: headers });

    // Set column widths
    const columnWidths = [{ wch: 20 }]; // Username
    for (const _ of dates) {
      columnWidths.push({ wch: 18 }); // Each date
    }
    columnWidths.push({ wch: 15 }); // Total column
    worksheet['!cols'] = columnWidths;

    // Apply styling
    applyPivotTableStyling(worksheet, headers, pivotData.length, dates);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pivot');

    const exportFilename =
      filename || `attendance_pivot_${startDate}_to_${endDate}_${new Date().getTime()}.xlsx`;

    XLSX.writeFile(workbook, exportFilename);
  }
