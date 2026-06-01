const promptText ='I have the following list of unique actions from a Salesforce Setup Audit Trail log. Please analyze them and provide a structured list of Salesforce components that were changed, grouped by component type (e.g. Profiles, Flows, Custom Objects, etc.). Without any explanation we need this information to know what needs to be added to the pull request:'

let csvFileResponseOriginal;
let csvFileResponseResult;

let users = new Set();
let selectedUser;
let sections = new Set();
let selectedSection;
let groupByDay = false;
let lastCheckedCheckbox = null;

document.addEventListener('DOMContentLoaded', () => {
  const csvFile = document.getElementById('csvFile');

  csvFile.addEventListener('change', () => {
    const file = csvFile.files[0];
    const reader = new FileReader();

    document.getElementById('loadingOverlay').classList.remove('d-none');

    reader.onload = (e) => csvFileResponseOriginal = parseCSV(e.target.result);
    reader.readAsText(file);
    reader.onloadend = () => populateValues();
  });

  document.getElementById('tableBody').addEventListener('click', (event) => {
    const checkbox = event.target;
    if (checkbox.type !== 'checkbox') return;

    if (event.shiftKey && lastCheckedCheckbox) {
      const checkboxes = [...document.querySelectorAll('#tableBody input[type="checkbox"]')];
      const currentIndex = checkboxes.indexOf(checkbox);
      const lastIndex = checkboxes.indexOf(lastCheckedCheckbox);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const [start, end] = [Math.min(currentIndex, lastIndex), Math.max(currentIndex, lastIndex)];
        checkboxes.slice(start, end + 1).forEach(cb => { cb.checked = checkbox.checked; });
      }
    }

    lastCheckedCheckbox = checkbox;

    const anyChecked = document.querySelectorAll('#tableBody input[type="checkbox"]:checked').length > 0;
    document.getElementById('buildPromptBtn').disabled = !anyChecked;
  });

  document.getElementById('buildPromptBtn').addEventListener('click', () => {
    if (!csvFileResponseOriginal) return;

    const checkedIds = new Set(
      [...document.querySelectorAll('#tableBody input[type="checkbox"]:checked')]
        .map(cb => parseInt(cb.id.replace('check', '')))
    );

    if (checkedIds.size === 0) return;

    const selectedLogs = csvFileResponseOriginal.filter(log => checkedIds.has(log.Id));
    const uniqueActions = [...new Set(selectedLogs.map(log => log.Action).filter(Boolean))];

    const prompt = `${promptText}\n\n${uniqueActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;

    navigator.clipboard.writeText(prompt);
  });

  document.getElementById('selectAll').addEventListener('change', (event) => {
    document.querySelectorAll('#tableBody input[type="checkbox"]')
      .forEach(cb => { cb.checked = event.target.checked; });
    document.getElementById('buildPromptBtn').disabled = !event.target.checked;
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
    document.getElementById('loadingOverlay').classList.add('d-none');
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

  lastCheckedCheckbox = null;
  document.getElementById('selectAll').checked = false;
  document.getElementById('buildPromptBtn').disabled = true;
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