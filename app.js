/* MTSS Tracker - data lives in this browser (localStorage)
   until you swap the Store adapter.
*/

const KEY = 'mtss_v1';

const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];

const MODS = {
  behavior: {
    tab: 'Behavior / SEL',
    title: 'Behavior & Social-Emotional',
    f: [
      ['date', 'Date', 'date'],
      ['student', 'Student', 'student'],
      ['grade', 'Grade', 'text'],
      [
        'type',
        'Category',
        [
          'Disruption',
          'Defiance',
          'Aggression',
          'Peer conflict',
          'Anxiety / emotional',
          'Positive behavior'
        ]
      ],
      ['tier', 'Tier', TIERS],
      ['notes', 'Notes / intervention', 'textarea']
    ]
  },

  academic: {
    tab: 'Academics',
    title: 'Academic Progress',
    f: [
      ['date', 'Date', 'date'],
      ['student', 'Student', 'student'],
      ['grade', 'Grade', 'text'],
      [
        'subject',
        'Subject',
        ['Reading', 'Math', 'Writing', 'Science', 'Other']
      ],
      ['assessment', 'Assessment', 'text'],
      ['score', 'Score (%)', 'number'],
      ['tier', 'Tier', TIERS],
      ['notes', 'Notes / intervention', 'textarea']
    ]
  },

  attendance: {
    tab: 'Attendance',
    title: 'Attendance & Tardies',
    f: [
      ['date', 'Date', 'date'],
      ['student', 'Student', 'student'],
      ['grade', 'Grade', 'text'],
      [
        'status',
        'Status',
        ['Absent (unexcused)', 'Absent (excused)', 'Tardy']
      ],
      ['notes', 'Reason / notes', 'textarea']
    ]
  },

  comm: {
    tab: 'Communication Log',
    title: 'Communication Log',
    f: [
      ['date', 'Date', 'date'],
      ['author', 'Teacher / staff', 'text'],
      ['student', 'Student (optional)', 'student'],
      [
        'type',
        'Type',
        [
          'Daily update',
          'Weekly update',
          'Parent contact',
          'Team meeting',
          'Admin note'
        ]
      ],
      ['notes', 'Details', 'textarea']
    ]
  }
};

const PAL = [
  '#7a1f2b',
  '#6b6b6b',
  '#c96a76',
  '#b9b9b9',
  '#3e0f16',
  '#e3b5bb'
];

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]
  );

const today = () => {
  const date = new Date();

  return new Date(
    date - date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
};

/* -------------------------------------------------------
   Storage adapter
   Replace load/save with Firebase/Supabase calls
   for shared data.
------------------------------------------------------- */

const blank = () => ({
  behavior: [],
  academic: [],
  attendance: [],
  comm: []
});

function load() {
  try {
    return Object.assign(
      blank(),
      JSON.parse(localStorage.getItem(KEY))
    );
  } catch {
    return blank();
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

let data = load();
let charts = {};

/* -------------------------------------------------------
   Build UI
------------------------------------------------------- */

function build() {
  const tabs = [
    ['dashboard', 'Dashboard'],
    ...Object.entries(MODS).map(([key, module]) => [
      key,
      module.tab
    ])
  ];

  $('#tabs').innerHTML = tabs
    .map(
      ([key, title]) =>
        `<button data-t="${key}">${title}</button>`
    )
    .join('');

  let html = `
    <section id="dashboard">
      <h2>Administrator Dashboard</h2>

      <div class="filter">
        <label>
          Date range
          <select id="range">
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="9999">All time</option>
          </select>
        </label>
      </div>

      <div class="kpis" id="kpis"></div>

      <div class="grid">
        <div class="card">
          <h3>Behavior incidents per week</h3>
          <canvas id="c1"></canvas>
        </div>

        <div class="card">
          <h3>Behavior by category</h3>
          <canvas id="c2"></canvas>
        </div>

        <div class="card">
          <h3>Average score by subject</h3>
          <canvas id="c3"></canvas>
        </div>

        <div class="card">
          <h3>Absences &amp; tardies per week</h3>
          <canvas id="c4"></canvas>
        </div>

        <div class="card">
          <h3>Entries by tier (behavior + academic)</h3>
          <canvas id="c5"></canvas>
        </div>

        <div class="card">
          <h3>Communication entries per week</h3>
          <canvas id="c6"></canvas>
        </div>
      </div>

      <div class="card">
        <h3>
          Students needing attention
          (behavior ≥ 3, absences + tardies ≥ 5,
          or average score &lt; 70)
        </h3>

        <div class="scroll" id="flags"></div>
      </div>
    </section>
  `;

  for (const [key, module] of Object.entries(MODS)) {
    html += `
      <section id="${key}">
        <h2>${module.title}</h2>

        <div class="card">
          <form data-k="${key}">
            ${module.f
              .map(([name, label, type]) => {
                const wide =
                  type === 'textarea' ? ' class="wide"' : '';

                if (Array.isArray(type)) {
                  return `
                    <label>
                      ${label}
                      <select name="${name}">
                        ${type
                          .map(
                            (option) =>
                              `<option>${option}</option>`
                          )
                          .join('')}
                      </select>
                    </label>
                  `;
                }

                if (type === 'textarea') {
                  return `
                    <label${wide}>
                      ${label}
                      <textarea name="${name}"></textarea>
                    </label>
                  `;
                }

                if (type === 'student') {
                  return `
                    <label>
                      ${label}
                      <input
                        name="${name}"
                        list="students"
                        ${
                          name === 'student' && key !== 'comm'
                            ? 'required'
                            : ''
                        }
                      >
                    </label>
                  `;
                }

                return `
                  <label>
                    ${label}
                    <input
                      name="${name}"
                      type="${type}"
                      ${
                        type === 'date'
                          ? `value="${today()}"`
                          : ''
                      }
                      ${
                        type === 'number'
                          ? 'min="0" max="100" required'
                          : ''
                      }
                      ${type === 'date' ? 'required' : ''}
                    >
                  </label>
                `;
              })
              .join('')}

            <button class="primary">Add entry</button>
          </form>
        </div>

        <div class="card">
          <input
            class="search"
            placeholder="Search records..."
            data-s="${key}"
          >

          <div class="scroll" id="t-${key}"></div>
        </div>
      </section>
    `;
  }

  $('#main').innerHTML = html;
}

/* -------------------------------------------------------
   Navigation
------------------------------------------------------- */

function show(key) {
  document
    .querySelectorAll('section')
    .forEach((section) =>
      section.classList.toggle('on', section.id === key)
    );

  document
    .querySelectorAll('#tabs button')
    .forEach((button) =>
      button.classList.toggle('on', button.dataset.t === key)
    );

  if (key === 'dashboard') {
    dash();
  }

  location.hash = key;
}

/* -------------------------------------------------------
   Tables
------------------------------------------------------- */

function table(key) {
  const module = MODS[key];
  const search =
    ($(`[data-s="${key}"]`).value || '').toLowerCase();

  const rows = data[key]
    .filter((row) =>
      JSON.stringify(row).toLowerCase().includes(search)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  $('#t-' + key).innerHTML = rows.length
    ? `
      <table>
        <tr>
          ${module.f
            .map(([name, label]) => `<th>${label}</th>`)
            .join('')}
          <th></th>
        </tr>

        ${rows
          .map(
            (row) => `
              <tr>
                ${module.f
                  .map(
                    ([name]) =>
                      `<td>${esc(row[name])}</td>`
                  )
                  .join('')}

                <td>
                  <button
                    class="del"
                    data-k="${key}"
                    data-id="${row.id}"
                    title="Delete"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            `
          )
          .join('')}
      </table>
    `
    : '<p class="empty">No records yet.</p>';
}

function students() {
  const studentNames = new Set();

  Object.values(data).forEach((records) => {
    records.forEach((row) => {
      if (row.student) {
        studentNames.add(row.student.trim());
      }
    });
  });

  $('#students').innerHTML = [...studentNames]
    .sort()
    .map(
      (name) =>
        `<option value="${esc(name)}">`
    )
    .join('');
}

const refresh = () => {
  Object.keys(MODS).forEach(table);

  students();

  if ($('#dashboard').classList.contains('on')) {
    dash();
  }
};

/* -------------------------------------------------------
   Dashboard
------------------------------------------------------- */

const wk = (date) => {
  const value = new Date(`${date}T00:00:00Z`);

  value.setUTCDate(
    value.getUTCDate() -
      ((value.getUTCDay() + 6) % 7)
  );

  return value.toISOString().slice(0, 10);
};

function chart(id, type, labels, sets) {
  charts[id]?.destroy();

  const isCircular = type === 'doughnut';

  charts[id] = new Chart($('#' + id), {
    type,

    data: {
      labels,

      datasets: sets.map((set, index) => ({
        ...set,

        backgroundColor: isCircular
          ? PAL
          : set.color || PAL[index],

        borderColor:
          set.color || PAL[index]
      }))
    },

    options: {
      responsive: true,

      plugins: {
        legend: {
          display:
            isCircular || sets.length > 1
        }
      },

      scales: isCircular
        ? {}
        : {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          }
    }
  });
}

function weekly(id, type, series) {
  const weeks = [
    ...new Set(
      series.flatMap(([, rows]) =>
        rows.map((row) => wk(row.date))
      )
    )
  ].sort();

  chart(
    id,
    type,
    weeks,
    series.map(([label, rows], index) => ({
      label,

      data: weeks.map(
        (week) =>
          rows.filter(
            (row) => wk(row.date) === week
          ).length
      ),

      color: PAL[index === 0 ? 0 : 1],
      tension: 0.3
    }))
  );
}

function count(rows, key) {
  const result = {};

  rows.forEach((row) => {
    result[row[key]] =
      (result[row[key]] || 0) + 1;
  });

  return result;
}

function dash() {
  const days = +$('#range').value;

  const cut = new Date(
    Date.now() - days * 864e5
  )
    .toISOString()
    .slice(0, 10);

  const dashboardData = {};

  for (const key in data) {
    dashboardData[key] = data[key].filter(
      (row) => row.date >= cut
    );
  }

  const absences = dashboardData.attendance.filter(
    (row) => row.status.startsWith('Absent')
  );

  const tardies = dashboardData.attendance.filter(
    (row) => row.status === 'Tardy'
  );

  const negativeBehavior =
    dashboardData.behavior.filter(
      (row) => row.type !== 'Positive behavior'
    );

  const averageScore = dashboardData.academic.length
    ? Math.round(
        dashboardData.academic.reduce(
          (total, row) => total + +row.score,
          0
        ) / dashboardData.academic.length
      )
    : '–';

  const tierTwoThree = [
    ...dashboardData.behavior,
    ...dashboardData.academic
  ].filter((row) => row.tier !== 'Tier 1');

  $('#kpis').innerHTML = [
    [negativeBehavior.length, 'Behavior incidents'],
    [
      averageScore === '–'
        ? averageScore
        : averageScore + '%',
      'Average academic score'
    ],
    [absences.length, 'Absences'],
    [tardies.length, 'Tardies'],
    [tierTwoThree.length, 'Tier 2/3 entries'],
    [
      dashboardData.comm.length,
      'Communication entries'
    ]
  ]
    .map(
      ([number, label]) => `
        <div class="kpi">
          <b>${number}</b>
          <span>${label}</span>
        </div>
      `
    )
    .join('');

  weekly(
    'c1',
    'bar',
    [['Incidents', negativeBehavior]]
  );

  const behaviorCategories = count(
    dashboardData.behavior,
    'type'
  );

  chart(
    'c2',
    'doughnut',
    Object.keys(behaviorCategories),
    [
      {
        data: Object.values(behaviorCategories)
      }
    ]
  );

  const subjects = {};

  dashboardData.academic.forEach((row) => {
    (
      subjects[row.subject] ||
      (subjects[row.subject] = [])
    ).push(+row.score);
  });

  chart(
    'c3',
    'bar',
    Object.keys(subjects),
    [
      {
        label: 'Avg %',

        data: Object.values(subjects).map(
          (scores) =>
            Math.round(
              scores.reduce(
                (total, score) => total + score,
                0
              ) / scores.length
            )
        )
      }
    ]
  );

  weekly(
    'c4',
    'line',
    [
      ['Absences', absences],
      ['Tardies', tardies]
    ]
  );

  const tierCounts = count(
    [
      ...dashboardData.behavior,
      ...dashboardData.academic
    ],
    'tier'
  );

  chart(
    'c5',
    'doughnut',
    Object.keys(tierCounts),
    [
      {
        data: Object.values(tierCounts)
      }
    ]
  );

  weekly(
    'c6',
    'bar',
    [['Entries', dashboardData.comm]]
  );

  /* Flagged students */

  const studentsByName = {};

  const getStudent = (name) => {
    return (
      studentsByName[name] ||
      (studentsByName[name] = {
        behavior: 0,
        attendance: 0,
        scores: []
      })
    );
  };

  negativeBehavior.forEach((row) => {
    getStudent(row.student).behavior++;
  });

  dashboardData.attendance.forEach((row) => {
    getStudent(row.student).attendance++;
  });

  dashboardData.academic.forEach((row) => {
    getStudent(row.student).scores.push(
      +row.score
    );
  });

  const flaggedStudents = Object.entries(
    studentsByName
  )
    .map(([name, student]) => {
      const average = student.scores.length
        ? Math.round(
            student.scores.reduce(
              (total, score) => total + score,
              0
            ) / student.scores.length
          )
        : null;

      const reasons = [];

      if (student.behavior >= 3) {
        reasons.push(
          `${student.behavior} behavior incidents`
        );
      }

      if (student.attendance >= 5) {
        reasons.push(
          `${student.attendance} absences/tardies`
        );
      }

      if (
        average !== null &&
        average < 70
      ) {
        reasons.push(
          `avg score ${average}%`
        );
      }

      return {
        name,
        reasons
      };
    })
    .filter((student) => student.reasons.length);

  $('#flags').innerHTML = flaggedStudents.length
    ? `
      <table>
        <tr>
          <th>Student</th>
          <th>Reasons</th>
        </tr>

        ${flaggedStudents
          .map(
            (student) => `
              <tr>
                <td>${esc(student.name)}</td>

                <td>
                  ${student.reasons
                    .map(
                      (reason) =>
                        `<span class="tag">${reason}</span>`
                    )
                    .join('')}
                </td>
              </tr>
            `
          )
          .join('')}
      </table>
    `
    : `
      <p class="empty">
        No students meet the flag criteria in this range.
      </p>
    `;
}

/* -------------------------------------------------------
   Events
------------------------------------------------------- */

build();

$('#tabs').onclick = (event) => {
  if (event.target.dataset.t) {
    show(event.target.dataset.t);
  }
};

$('#main').addEventListener(
  'submit',
  (event) => {
    event.preventDefault();

    const form = event.target;
    const key = form.dataset.k;

    const record = {
      id: Date.now()
    };

    new FormData(form).forEach((value, name) => {
      record[name] = value.trim();
    });

    data[key].push(record);

    save();

    form.reset();

    form.querySelector('[type=date]').value =
      today();

    refresh();
  }
);

$('#main').addEventListener(
  'click',
  (event) => {
    if (
      event.target.classList.contains('del') &&
      confirm('Delete this record?')
    ) {
      const { k, id } = event.target.dataset;

      data[k] = data[k].filter(
        (record) => record.id != id
      );

      save();
      refresh();
    }
  }
);

$('#main').addEventListener(
  'input',
  (event) => {
    if (event.target.dataset.s) {
      table(event.target.dataset.s);
    }
  }
);

$('#range').onchange = dash;

$('#exportBtn').onclick = () => {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type: 'application/json'
    }
  );

  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = `mtss-backup-${today()}.json`;

  link.click();
};

$('#importBtn').onclick = () => {
  $('#importFile').click();
};

$('#importFile').onchange = (event) => {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      data = Object.assign(
        blank(),
        JSON.parse(reader.result)
      );

      save();
      refresh();

      alert('Import complete.');
    } catch {
      alert('Invalid file.');
    }
  };

  reader.readAsText(event.target.files[0]);
};

/* -------------------------------------------------------
   Initialize
------------------------------------------------------- */

refresh();

show(
  MODS[location.hash.slice(1)] ||
    location.hash === '#dashboard'
    ? location.hash.slice(1)
    : 'dashboard'
);
