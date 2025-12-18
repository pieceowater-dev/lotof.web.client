/**
 * Utility function to export attendance stats to Excel with styling, grouping, and localization
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

export async function exportAttendanceToExcel(
  data: UserStats[],
  startDate: string,
  endDate: string,
  language: string = 'en',
  filename?: string
): Promise<void> {
  const locale = getLocale(language);
  const workbook = XLSX.utils.book_new();

  // Create summary data
  const summaryData = [
    [locale.title],
    [`${locale.period}: ${startDate} to ${endDate}`],
    [`${locale.generated}: ${new Date().toLocaleString()}`],
    [`${locale.totalUsers}: ${data.length}`],
    [],
  ];

  // Convert stats to sheet format
  const statsData = data.map((user) => ({
    [locale.userId]: user.userId,
    [locale.username]: user.username || '-',
    [locale.email]: user.email || '-',
    [locale.workDays]: user.workDays,
    [locale.attendedDays]: user.attendedDays,
    [locale.violationDays]: user.violationDays,
    [locale.legitimateAbsences]: user.legitimateAbsences,
    [locale.totalWorkedHours]: user.totalWorkedHours.toFixed(2),
  }));

  // Create sheet and add data
  const worksheet = XLSX.utils.json_to_sheet(statsData);

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // User ID
    { wch: 20 }, // Username
    { wch: 25 }, // Email
    { wch: 12 }, // Work Days
    { wch: 14 }, // Attended Days
    { wch: 14 }, // Violation Days
    { wch: 18 }, // Legitimate Absences
    { wch: 18 }, // Total Worked Hours
  ];
  worksheet['!cols'] = columnWidths;

  // Add header styling
  const headerStyle = {
    font: { bold: true, color: 'FFFFFF' },
    fill: { fgColor: { rgb: '4472C4' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const headerRow = summaryData.length + 1;
  for (let col = 0; col < 8; col++) {
    const cell = getCellAddress(headerRow, col);
    if (!worksheet[cell]) worksheet[cell] = '';
    worksheet[cell].s = headerStyle;
  }

  // Add alternating row colors
  const dataStartRow = headerRow + 1;
  for (let rowIdx = 0; rowIdx < statsData.length; rowIdx++) {
    const row = dataStartRow + rowIdx;
    const rowStyle = {
      fill:
        rowIdx % 2 === 0
          ? { fgColor: { rgb: 'E7E6E6' } }
          : { fgColor: { rgb: 'FFFFFF' } },
    };
    for (let col = 0; col < 8; col++) {
      const cell = getCellAddress(row, col);
      if (worksheet[cell]) {
        worksheet[cell].s = rowStyle;
      }
    }
  }

  // Add summary to top
  XLSX.utils.sheet_add_aoa(worksheet, summaryData, { origin: 'A1' });

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

  const exportFilename =
    filename || `attendance_${startDate}_to_${endDate}_${new Date().getTime()}.xlsx`;

  XLSX.writeFile(workbook, exportFilename);
}

  export async function exportPivotTableToExcel(
    data: UserDailyRecord[],
    startDate: string,
    endDate: string,
    language: string = 'en',
    filename?: string
  ): Promise<void> {
    const locale = getLocale(language);
  
    // Generate list of all dates in range (ISO and display headers)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];
    const displayDates: string[] = [];
    const localeId = language === 'ru' ? 'ru-RU' : 'en-GB';
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split('T')[0];
      dates.push(iso);
      const ddmmyyyy = d.toLocaleDateString(localeId, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/[\/]/g, '.');
      displayDates.push(ddmmyyyy);
    }

    // Group records by user and date
    const recordsByUserAndDate = new Map<string, Map<string, UserDailyRecord>>();
    for (const record of data) {
      if (!recordsByUserAndDate.has(record.username)) {
        recordsByUserAndDate.set(record.username, new Map());
      }
      recordsByUserAndDate.get(record.username)!.set(record.date, record);
    }

    // Sort users alphabetically
    const sortedUsers = Array.from(recordsByUserAndDate.keys()).sort();

    // Build pivot table
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

    // Apply header styling
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
    for (let rowIdx = 0; rowIdx < pivotData.length; rowIdx++) {
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

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pivot');

    const exportFilename =
      filename || `attendance_pivot_${startDate}_to_${endDate}_${new Date().getTime()}.xlsx`;

    XLSX.writeFile(workbook, exportFilename);
  }
export async function exportDailyAttendanceToExcel(
  data: UserDailyRecord[],
  startDate: string,
  endDate: string,
  language: string = 'en',
  filename?: string
): Promise<void> {
  const locale = getLocale(language);
  const workbook = XLSX.utils.book_new();

  // Group records by user
  const recordsByUser = new Map<string, UserDailyRecord[]>();
  for (const record of data) {
    if (!recordsByUser.has(record.userId)) {
      recordsByUser.set(record.userId, []);
    }
    recordsByUser.get(record.userId)!.push(record);
  }

  // Sort by username
  const sortedUsers = Array.from(recordsByUser.entries())
    .sort((a, b) => a[1][0].username.localeCompare(b[1][0].username))
    .map(([_, records]) => records.sort((a, b) => a.date.localeCompare(b.date)));

  // Create main worksheet with all data
  let currentRow = 1;
  const mainSheet = XLSX.utils.aoa_to_sheet([]);
  mainSheet['!cols'] = [
    { wch: 15 }, // User ID
    { wch: 20 }, // Username
    { wch: 12 }, // Date
    { wch: 15 }, // First Check-In
    { wch: 15 }, // Last Check-Out
    { wch: 12 }, // Hours Worked
    { wch: 10 }, // Attended
    { wch: 12 }, // Legitimate
    { wch: 25 }, // Reason
  ];

  const headerStyle = {
    font: { bold: true, color: 'FFFFFF' },
    fill: { fgColor: { rgb: '70AD47' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };

  const titleStyle = {
    font: { bold: true, size: 14, color: 'FFFFFF' },
    fill: { fgColor: { rgb: '203864' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const userHeaderStyle = {
    font: { bold: true, color: 'FFFFFF' },
    fill: { fgColor: { rgb: '5B9BD5' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const userTotalStyle = {
    font: { bold: true, size: 11 },
    fill: { fgColor: { rgb: 'D9E1F2' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: '000000' },
      bottom: { style: 'thin', color: '000000' },
    },
  };

  // Add main title
  mainSheet[getCellAddress(currentRow, 0)] = {
    v: locale.dailyTitle,
    s: titleStyle,
  };
  currentRow++;

  // Add metadata
  mainSheet[getCellAddress(currentRow, 0)] = `${locale.period}: ${startDate} - ${endDate}`;
  currentRow++;
  mainSheet[getCellAddress(currentRow, 0)] = `${locale.generated}: ${new Date().toLocaleString()}`;
  currentRow++;
  mainSheet[getCellAddress(currentRow, 0)] = `${locale.totalRecords}: ${data.length}`;
  currentRow += 2;

  // Add data grouped by user
  for (const userRecords of sortedUsers) {
    const username = userRecords[0].username;

    // User header
    mainSheet[getCellAddress(currentRow, 0)] = {
      v: `${locale.username}: ${username} (${userRecords.length} ${locale.date.toLowerCase()})`,
      s: userHeaderStyle,
    };
    currentRow++;

    // Column headers
    const headers = [
      locale.date,
      locale.firstCheckIn,
      locale.lastCheckOut,
      locale.hoursWorked,
      locale.attended,
      locale.legitimate,
      locale.reason,
    ];
    for (let col = 0; col < headers.length; col++) {
      const cell = getCellAddress(currentRow, col);
      mainSheet[cell] = {
        v: headers[col],
        s: headerStyle,
      };
    }
    currentRow++;

    // User records
    let userTotalHours = 0;
    let userAttendedDays = 0;
    let userLegitimateAbsences = 0;

    for (const record of userRecords) {
      userTotalHours += record.workedHours;
      if (record.attended) userAttendedDays++;
      if (record.legitimate) userLegitimateAbsences++;

      const rowStyle = {
        fill: { fgColor: { rgb: 'F2F2F2' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };

      mainSheet[getCellAddress(currentRow, 0)] = {
        v: record.date,
        s: rowStyle,
      };
      mainSheet[getCellAddress(currentRow, 1)] = {
        v: formatTimestamp(record.firstCheckIn),
        s: rowStyle,
      };
      mainSheet[getCellAddress(currentRow, 2)] = {
        v: formatTimestamp(record.lastCheckOut),
        s: rowStyle,
      };
      mainSheet[getCellAddress(currentRow, 3)] = {
        v: record.workedHours,
        s: { ...rowStyle, numFmt: '0.00' },
      };
      mainSheet[getCellAddress(currentRow, 4)] = {
        v: record.attended ? locale.yes : locale.no,
        s: rowStyle,
      };
      mainSheet[getCellAddress(currentRow, 5)] = {
        v: record.legitimate ? locale.yes : locale.no,
        s: rowStyle,
      };
      mainSheet[getCellAddress(currentRow, 6)] = {
        v: record.reason || '-',
        s: rowStyle,
      };

      currentRow++;
    }

    // User totals row
    mainSheet[getCellAddress(currentRow, 0)] = {
      v: locale.userTotal,
      s: userTotalStyle,
    };
    mainSheet[getCellAddress(currentRow, 1)] = {
      v: '',
      s: userTotalStyle,
    };
    mainSheet[getCellAddress(currentRow, 2)] = {
      v: '',
      s: userTotalStyle,
    };
    mainSheet[getCellAddress(currentRow, 3)] = {
      v: userTotalHours,
      s: { ...userTotalStyle, numFmt: '0.00' },
    };
    mainSheet[getCellAddress(currentRow, 4)] = {
      v: `${userAttendedDays}/${userRecords.length}`,
      s: userTotalStyle,
    };
    mainSheet[getCellAddress(currentRow, 5)] = {
      v: userLegitimateAbsences,
      s: userTotalStyle,
    };
    mainSheet[getCellAddress(currentRow, 6)] = {
      v: '',
      s: userTotalStyle,
    };

    currentRow += 2;
  }

  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Daily Records');

  const exportFilename =
    filename || `daily_attendance_${startDate}_to_${endDate}_${new Date().getTime()}.xlsx`;

  XLSX.writeFile(workbook, exportFilename);
}
