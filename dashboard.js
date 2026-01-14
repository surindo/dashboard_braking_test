import { createClient } from "https://esm.sh/@supabase/supabase-js";

/* ================= SUPABASE ================= */
const supabase = createClient(
  "https://eysofbxczoaesihxpelb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5c29mYnhjem9hZXNpaHhwZWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjM4MjIsImV4cCI6MjA3ODYzOTgyMn0.X4Nec16yXjcrQtpUzAlkwJDgQKHKz8lqU4WF7kjp2KU"
);

/* ================= DEFAULT FILTER ================= */
document.getElementById("dateFilter").value =
  new Date().toISOString().slice(0, 10);

let currentParams = getParams();

/* ================= LOAD BUTTON ================= */
document.getElementById("btnLoad").onclick = () => {
  currentParams = getParams();
  loadData();
};

/* ================= REALTIME ================= */
supabase
  .channel("braking-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "braking" },
    () => loadData()
  )
  .subscribe();

/* ================= HELPERS ================= */
function avg(values) {
  const valid = values.filter(v => typeof v === "number" && !isNaN(v));
  return valid.length
    ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)
    : null;
}

function getParams() {
  return {
    date: document.getElementById("dateFilter").value,
    sesi: document.getElementById("sesiFilter").value
  };
}

/* ================= LOAD DATA ================= */
async function loadData() {
  const { date, sesi } = currentParams;

  const { data, error } = await supabase
    .from("braking")
    .select("*")
    .eq("sesi", sesi)
    .gte("created_at", `${date} 00:00:00`)
    .lte("created_at", `${date} 23:59:59`);

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  renderTables(data);
  renderCharts(data);
}

/* ================= TABLES ================= */
function renderTables(rows) {
  const tb = document.getElementById("table-body");
  tb.innerHTML = "";

  const cell = v => (v == null ? "" : `${v} m`);

  const conditions = [
    { type: 1, label: "Dry" },
    { type: 2, label: "Wet" }
  ];

  conditions.forEach(cond => {
    const byType = rows.filter(r => r.type === cond.type);

    const dunlop = byType.find(r => r.brand === "Dunlop") || {};
    const komp = byType.find(r => r.brand === "Kompetitor") || {};

    /* ===== ROW 1 : DUNLOP ===== */
    tb.innerHTML += `
      <tr>
        <td rowspan="2"><strong>${cond.label}</strong></td>
        <td class="dunlop">Dunlop</td>
        <td>${cell(dunlop.t1)}</td>
        <td>${cell(dunlop.t2)}</td>
        <td>${cell(dunlop.t3)}</td>
        <td>${cell(dunlop.t4)}</td>
        <td>${cell(dunlop.t5)}</td>
      </tr>
    `;

    /* ===== ROW 2 : KOMPETITOR ===== */
    tb.innerHTML += `
      <tr>
        <td class="komp">Kompetitor</td>
        <td>${cell(komp.t1)}</td>
        <td>${cell(komp.t2)}</td>
        <td>${cell(komp.t3)}</td>
        <td>${cell(komp.t4)}</td>
        <td>${cell(komp.t5)}</td>
      </tr>
    `;
  });
}

/* ================= CHARTS ================= */
function renderCharts(rows) {
  const keys = ["t1", "t2", "t3", "t4", "t5"];

  const dry = rows.filter(r => r.type === 1);
  const wet = rows.filter(r => r.type === 2);

  const calcAvg = (data, brand) =>
    keys.map(k => avg(data.filter(r => r.brand === brand).map(r => r[k])));

  /* ===== BAR CHART ===== */
  function renderBar(container, data) {
    Highcharts.chart(container, {
      chart: { type: "bar" },
      title: { text: "" },
      credits: { enabled: false },

      xAxis: { categories: ["T1", "T2", "T3", "T4", "T5"] },

      yAxis: {
        title: { text: "Meter" },
        labels: { format: "{value} m" }
      },

      tooltip: { valueSuffix: " m" },

      plotOptions: {
        bar: {
          dataLabels: {
            enabled: true,
            formatter() {
              return this.y == null ? "" : `${this.y} m`;
            }
          }
        }
      },

      series: [
        {
          name: "Dunlop",
          data: calcAvg(data, "Dunlop"),
          color: "#e6b800",
          connectNulls: true
        },
        {
          name: "Kompetitor",
          data: calcAvg(data, "Kompetitor"),
          color: "#d40000",
          connectNulls: true
        }
      ]
    });
  }

  /* ===== AVG COMPARISON ===== */
  function renderAvg(container, data) {
    const dAvg = avg(calcAvg(data, "Dunlop"));
    const kAvg = avg(calcAvg(data, "Kompetitor"));

    Highcharts.chart(container, {
      chart: { type: "bar" },
      title: { text: "" },
      credits: { enabled: false },

      xAxis: { categories: ["Dunlop", "Kompetitor"] },

      yAxis: {
        title: { text: "Meter" },
        labels: { format: "{value} m" }
      },

      tooltip: { valueSuffix: " m" },

      series: [
        {
          name: "Average",
          data: [
            { y: dAvg, color: "#e6b800" },
            { y: kAvg, color: "#d40000" }
          ],
          dataLabels: {
            enabled: true,
            formatter() {
              return this.y == null ? "" : `${this.y} m`;
            }
          }
        }
      ]
    });
  }

  /* ===== RENDER ALL ===== */
  renderBar("chart-bar-dry", dry);
  renderBar("chart-bar-wet", wet);

  renderAvg("chart-avg-dry", dry);
  renderAvg("chart-avg-wet", wet);
}

/* ================= INIT ================= */
loadData();

/* ================= ZOOM ================= */
let zoomLevel = 1;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.3;

const wrap = document.querySelector(".wrap");

function applyZoom() {
  wrap.style.transform = `scale(${zoomLevel})`;
  wrap.style.transformOrigin = "top center";

  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 150);
}

document.getElementById("zoom-in").onclick = () => {
  if (zoomLevel < MAX_ZOOM) {
    zoomLevel += ZOOM_STEP;
    applyZoom();
  }
};

document.getElementById("zoom-out").onclick = () => {
  if (zoomLevel > MIN_ZOOM) {
    zoomLevel -= ZOOM_STEP;
    applyZoom();
  }
};

document.getElementById("fullscreen").onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
