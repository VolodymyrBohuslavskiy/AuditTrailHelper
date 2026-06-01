let csvFileResponseOriginal;
let csvFileResponseResult;

let users = new Set();
let selectedUser;
let sections = new Set();
let selectedSection;
let groupByDay = false;

document.addEventListener('DOMContentLoaded', () => {
  const csvFile = document.getElementById('csvFile');

  csvFile.addEventListener('change', () => {
    const file = csvFile.files[0];
    const reader = new FileReader();

    reader.onload = (e) => csvFileResponseOriginal = parseCSV(e.target.result);
    reader.readAsText(file);
    reader.onloadend = () => populateValues();
  });

  document.getElementById('daySeparatorToggle').addEventListener('change', (event) => {
    groupByDay = event.target.checked;
    applyFilters();
  });

  document.getElementById('user-select').addEventListener('change', (event) => {
    selectedUser = event.target.value;
    applyFilters();
  });

  document.getElementById('section-select').addEventListener('change', (event) => {
    selectedSection = event.target.value;
    applyFilters();
  });

  function showResults() {
    const filters = document.getElementById('filtersSection');
    filters.classList.remove('d-none');
    filters.classList.add('d-flex');
    document.getElementById('resultsSection').classList.remove('d-none');
  }

  function populateValues() {
    csvFileResponseOriginal.forEach((log, index) => {
      log.Id = ++index;
      log.DateFormated = moment(log.Date).format('DD.MM.YYYY [ ] HH:mm');
      log.DateValue = moment(log.Date).format('DD.MM.YYYY');

      if (log?.User.includes('@')) {
        users.add(log?.User);
      }

      sections.add(log?.Section);
    });

    showResults();
    publishContent();
  }
});

function applyFilters() {
  const filtered = csvFileResponseOriginal.filter(log => {
    const matchesUser = !selectedUser || selectedUser === 'All' || log.User === selectedUser;
    const matchesSection = !selectedSection || selectedSection === 'All' || log.Section === selectedSection;
    return matchesUser && matchesSection;
  });
  renderTableBody(filtered);
}

function renderTableBody(listOfLogs) {
  listOfLogs = listOfLogs || csvFileResponseOriginal;

  let tableBody = '';
  let currentDay = null;

  listOfLogs.forEach((log) => {
    if (groupByDay && log.DateValue !== currentDay) {
      currentDay = log.DateValue;
      tableBody += `<tr><td colspan="6" class="text-center fw-semibold day-separator">${currentDay}</td></tr>`;
    }
    tableBody += `<tr><td><input class="form-check-input" type="checkbox" id="check${log.Id}"></td><td>${log.Id}</td><td>${log?.DateFormated}</td><td>${log?.User}</td><td class="overflow-auto w-25">${log?.Section}</td><td class="overflow-auto w-25">${log?.Action}</td></tr>`;
  });

  document.getElementById('tableBody').innerHTML = tableBody;
}

function publishContent() {
  renderTableBody();

  [...users].sort((a, b) => a.localeCompare(b)).forEach((user) => {
    document.getElementById('user-select').innerHTML += `<option value="${user}">${user}</option>`;
  });

  [...sections].filter(s => s.length > 2).sort((a, b) => a.localeCompare(b)).forEach((section) => {
    document.getElementById('section-select').innerHTML += `<option value="${section}">${section.length > 30 ? section.substring(0, 26) + '...' : section}</option>`;
  });
}

function parseCSV(csvString) {
  const rows = parseCSVRows(csvString);
  if (rows.length === 0) return [];

  const headers = rows[0];
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(v => v === '')) continue;
    const obj = {};
    headers.forEach((header, j) => { obj[header] = row[j] ?? ''; });
    result.push(obj);
  }

  return result;
}

function parseCSVRows(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && csv[i + 1] === '\n' && !inQuotes) {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some(v => v !== '')) rows.push(row);

  return rows;
}