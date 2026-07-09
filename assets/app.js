(function () {
  const D = window.NEWMAR_DATA;
  const PERIODS = D.period_order; // OLD, NEW-May, NEW-June
  const SHORT_PERIOD = {
    "OLD (Apr 11-May 7)": "OLD (Apr–May 7)",
    "NEW (May 8-Jun 3)": "May 8–Jun 3",
    "NEW (June 4-30)": "Jun 4–30",
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function seriesColor(i) {
    return cssVar(`--series-${(i % 8) + 1}`);
  }
  const OTHER_COLOR = () => cssVar("--text-muted");

  const fmtPct = (v, d = 1) => (v == null ? "—" : `${Number(v).toFixed(d)}%`);
  const fmtInt = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));

  const SHORT_NAME_MAP = {
    "2027 Brochure Downloads (per-model)": "Brochure Downloads",
    "Leads - Exploring": "Leads - Exploring",
    "2027 - Score Based MQL Considering Nurture": "MQL Considering",
    "2027 - Score Based SQL Nurture": "SQL Nurture",
    "2027 - Resorts Guide Nurture": "Resorts Guide",
    "2027 Self-Guided Factory Tour Request Nurture": "Factory Tour",
    "2027 - Inventory Request A Quote Nurture": "Inventory Quote",
    "2027 - Customer Engagement Nurture": "Customer Engagement",
    "2027 - High Intent BAC (Finished) Nurture": "BAC Finished",
    "2027 - Trade In Guide Submission Nurture": "Trade-In Guide",
    "2027 - Find A Dealer Contact Dealer Nurture": "Find-a-Dealer",
    "2027 - Inventory Page Reserve Now Nurture": "Inventory Reserve",
    "Old System (pre-relaunch)": "Old System (pre-relaunch)",
  };
  function shortName(wf) {
    return SHORT_NAME_MAP[wf] || wf.replace(/^2027\s*-?\s*/, "").replace(/\s*Nurture$/, "");
  }

  // -----------------------------------------------------------------
  // Theme + tabs
  // -----------------------------------------------------------------
  const rootEl = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  function applyTheme(t) {
    if (t) { rootEl.dataset.theme = t; localStorage.setItem("newmar-theme", t); }
    else { delete rootEl.dataset.theme; localStorage.removeItem("newmar-theme"); }
  }
  applyTheme(localStorage.getItem("newmar-theme") || "");
  themeToggle.addEventListener("click", () => {
    const current = rootEl.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(current === "dark" ? "light" : "dark");
    rerenderAllCharts();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("is-active");
      rerenderAllCharts();
    });
  });

  let rerenderAllCharts = () => {};

  // -----------------------------------------------------------------
  // OVERVIEW
  // -----------------------------------------------------------------
  const programByPeriod = {};
  D.program_level_metrics.forEach((r) => { programByPeriod[r.period_label] = r; });

  const kpiByMetric = {};
  D.june_2026_report_kpis.forEach((r) => { kpiByMetric[r.metric] = r; });

  function deltaClass(str, goodWhenUp) {
    if (!str) return "flat";
    const isDown = str.trim().startsWith("-");
    const isUp = str.trim().startsWith("+");
    if (!isUp && !isDown) return "flat";
    const up = isUp;
    return (up === goodWhenUp) ? "up" : "down";
  }
  function deltaArrow(str) {
    if (!str) return "";
    if (str.trim().startsWith("-")) return "↓ ";
    if (str.trim().startsWith("+")) return "↑ ";
    return "";
  }

  function renderKpis() {
    const tiles = [
      { label: "Email open rate (June)", metric: "Email Ecosystem Open Rate", goodUp: true },
      { label: "Click rate, clicks/delivered (June)", metric: "Email Ecosystem Click Rate (clicks/delivered)", goodUp: true },
      { label: "CTR, clicks/opens (June)", metric: "Email Ecosystem CTR (clicks/opens)", goodUp: true },
      { label: "Total sends (June)", metric: "Email Ecosystem Total Sends", goodUp: true },
    ];
    const row = document.getElementById("overview-kpis");
    row.textContent = "";
    tiles.forEach((t) => {
      const k = kpiByMetric[t.metric];
      if (!k) return;
      const div = document.createElement("div");
      div.className = "kpi-tile";
      const dClass = deltaClass(k.mom_change, t.goodUp);
      div.innerHTML = `
        <div class="kpi-label">${t.label}</div>
        <div class="kpi-value">${k.june_2026_value}</div>
        <div class="kpi-delta ${dClass}">${deltaArrow(k.mom_change)}${k.mom_change || ""}</div>
      `;
      row.appendChild(div);
    });
  }

  function renderProgramCombo() {
    const container = document.getElementById("chart-program-combo");
    const categories = PERIODS.map((p) => SHORT_PERIOD[p] || p);
    const sends = PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].total_sends : null));
    const sendsMax = Math.max(...sends.filter((v) => v != null));
    const barIndexed = sends.map((v) => (v == null ? null : (v / sendsMax) * 100));

    const bar = { name: "Sent (indexed to peak)", color: seriesColor(0), values: barIndexed, rawValues: sends, rawFormat: (v) => Viz.fmtCommas(v) };
    const lines = [
      { name: "Open rate", color: seriesColor(1), values: PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].open_rate_pct : null)) },
      { name: "CTR", color: seriesColor(2), values: PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].ctr_clicks_over_opens_pct : null)) },
    ];

    Viz.comboBarLineChart(container, { categories, bar, lines, yFormat: (v) => v.toFixed(0) + "%", height: 300, barMax: 64 });

    const legend = document.getElementById("legend-program-combo");
    legend.textContent = "";
    const barItem = document.createElement("span");
    barItem.className = "legend-item";
    barItem.innerHTML = `<span class="legend-swatch dot" style="background:${bar.color}"></span>Sent (bar, indexed to peak period)`;
    legend.appendChild(barItem);
    lines.forEach((s) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${s.color}"></span>${s.name} (line, actual %)`;
      legend.appendChild(item);
    });
  }

  function renderInsights() {
    const wfByKey = {};
    D.workflow_performance_by_period.forEach((r) => {
      wfByKey[r.workflow_name] = wfByKey[r.workflow_name] || {};
      wfByKey[r.workflow_name][r.period_label] = r;
    });
    const MAY = "NEW (May 8-Jun 3)", JUN = "NEW (June 4-30)";
    const juneRows = D.workflow_performance_by_period.filter((r) => r.period_label === JUN);
    const juneTotal = juneRows.reduce((a, r) => a + (r.sent || 0), 0);
    const topOfFunnelJune = ["2027 Brochure Downloads (per-model)", "Leads - Exploring"]
      .reduce((a, name) => a + ((wfByKey[name] && wfByKey[name][JUN] && wfByKey[name][JUN].sent) || 0), 0);
    const topOfFunnelShare = juneTotal ? (topOfFunnelJune / juneTotal) * 100 : 0;

    const sql = wfByKey["2027 - Score Based SQL Nurture"];
    const sqlSentDelta = sql && sql[MAY] && sql[JUN]
      ? ((sql[JUN].sent - sql[MAY].sent) / sql[MAY].sent) * 100 : null;

    const enroll = {};
    D.workflow_enrollment_snapshot.forEach((r) => { enroll[r.workflow_name] = r.enrolled_count; });
    const aimbaseSqlMom = kpiByMetric["SQLs Delivered to Aimbase"];

    const factoryTour = wfByKey["2027 Self-Guided Factory Tour Request Nurture"];
    const invQuote = wfByKey["2027 - Inventory Request A Quote Nurture"];

    const items = [];
    items.push(`<strong>Month-2 open-rate decline is mostly a mix shift.</strong> Brochure Downloads + Leads-Exploring made up ${topOfFunnelShare.toFixed(0)}% of all June sends — these are naturally lower-engagement, top-of-funnel workflows, so blended open rate falls even without any single email getting worse.`);
    if (factoryTour && factoryTour[MAY] && factoryTour[JUN] && invQuote && invQuote[MAY] && invQuote[JUN]) {
      items.push(`<strong>Niche behavior-triggered workflows are small but improving.</strong> Factory Tour open rate moved ${factoryTour[MAY].open_rate_pct.toFixed(1)}% → ${factoryTour[JUN].open_rate_pct.toFixed(1)}%; Inventory Quote moved ${invQuote[MAY].open_rate_pct.toFixed(1)}% → ${invQuote[JUN].open_rate_pct.toFixed(1)}%.`);
    }
    if (sqlSentDelta != null) {
      items.push(`<strong>SQL volume genuinely dropped</strong> — confirmed three independent ways: SQL nurture email sends ${sqlSentDelta >= 0 ? "+" : ""}${sqlSentDelta.toFixed(0)}% May→June, Aimbase SQL delivery ${aimbaseSqlMom ? aimbaseSqlMom.mom_change : "↓"} MoM, and HubSpot enrollment snapshot showing ${Viz.fmtCommas(enroll["2027 - Score Based SQL Nurture"] || 0)} SQL vs ${Viz.fmtCommas(enroll["Leads - Exploring"] || 0)} Lead / ${Viz.fmtCommas(enroll["2027 - Score Based MQL Considering Nurture"] || 0)} MQL enrolled. Points to a lead-scoring/handoff question upstream of email.`);
    }
    const ul = document.getElementById("insights-list");
    ul.innerHTML = items.map((i) => `<li>${i}</li>`).join("");
  }

  // -----------------------------------------------------------------
  // EMAILS TAB
  // -----------------------------------------------------------------
  const emailMap = new Map();
  D.email_performance_by_period.forEach((r) => {
    if (!emailMap.has(r.email_name)) emailMap.set(r.email_name, { name: r.email_name, workflow_name: r.workflow_name, byPeriod: {} });
    const rec = emailMap.get(r.email_name);
    rec.byPeriod[r.period_label] = r;
    rec.workflow_name = r.workflow_name; // last write wins == latest period's classification
  });
  const allEmails = Array.from(emailMap.values());

  const workflowFilterSel = document.getElementById("email-workflow-filter");
  const periodFilterSel = document.getElementById("email-period-filter");
  const sortMetricSel = document.getElementById("email-sort-metric");
  const sortDirBtn = document.getElementById("email-sort-dir");
  const searchInput = document.getElementById("email-search");
  const countEl = document.getElementById("email-count");
  const tbody = document.getElementById("email-table-body");

  const workflowNames = Array.from(new Set(allEmails.map((e) => e.workflow_name))).sort();
  workflowFilterSel.innerHTML = `<option value="">All workflows</option>` +
    workflowNames.map((w) => `<option value="${w.replace(/"/g, "&quot;")}">${shortName(w)}</option>`).join("");
  PERIODS.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = SHORT_PERIOD[p] || p;
    periodFilterSel.appendChild(opt);
  });

  let sortDir = -1; // desc
  sortDirBtn.addEventListener("click", () => {
    sortDir *= -1;
    sortDirBtn.textContent = sortDir === -1 ? "↓ Desc" : "↑ Asc";
    renderEmailTable();
  });
  [workflowFilterSel, periodFilterSel, sortMetricSel].forEach((elm) => elm.addEventListener("change", renderEmailTable));
  searchInput.addEventListener("input", renderEmailTable);

  function latestPeriodFor(rec) {
    for (let i = PERIODS.length - 1; i >= 0; i--) {
      if (rec.byPeriod[PERIODS[i]]) return PERIODS[i];
    }
    return null;
  }

  let openDetailRow = null;

  function renderEmailTable() {
    const wf = workflowFilterSel.value;
    const periodMode = periodFilterSel.value;
    const metric = sortMetricSel.value;
    const q = searchInput.value.trim().toLowerCase();

    let rows = allEmails
      .filter((e) => !wf || e.workflow_name === wf)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .map((e) => {
        const period = periodMode === "latest" ? latestPeriodFor(e) : periodMode;
        const row = period ? e.byPeriod[period] : null;
        return { e, period, row };
      })
      .filter((x) => x.row);

    rows.sort((a, b) => {
      const av = a.row[metric] == null ? -Infinity : a.row[metric];
      const bv = b.row[metric] == null ? -Infinity : b.row[metric];
      return (av - bv) * sortDir;
    });

    countEl.textContent = `${rows.length} email${rows.length === 1 ? "" : "s"}`;
    tbody.textContent = "";
    openDetailRow = null;

    rows.forEach(({ e, period, row }) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.className = "email-name";
      nameTd.textContent = e.name;
      tr.appendChild(nameTd);

      const wfTd = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = "workflow-chip";
      chip.textContent = shortName(e.workflow_name);
      wfTd.appendChild(chip);
      tr.appendChild(wfTd);

      const periodTd = document.createElement("td");
      periodTd.innerHTML = `<span class="period-chip">${SHORT_PERIOD[period] || period}</span>`;
      tr.appendChild(periodTd);

      const sentTd = document.createElement("td"); sentTd.className = "num"; sentTd.textContent = fmtInt(row.sent);
      const openTd = document.createElement("td"); openTd.className = "num"; openTd.textContent = fmtPct(row.open_rate_pct);
      const clickTd = document.createElement("td"); clickTd.className = "num"; clickTd.textContent = fmtPct(row.click_rate_clicks_over_delivered_pct);
      const ctrTd = document.createElement("td"); ctrTd.className = "num"; ctrTd.textContent = fmtPct(row.ctr_clicks_over_opens_pct);
      tr.appendChild(sentTd); tr.appendChild(openTd); tr.appendChild(clickTd); tr.appendChild(ctrTd);

      const trendTd = document.createElement("td");
      trendTd.className = "col-trend";
      tr.appendChild(trendTd);

      tbody.appendChild(tr);
      requestAnimationFrame(() => {
        Viz.sparkline(trendTd, {
          values: PERIODS.map((p) => (e.byPeriod[p] ? e.byPeriod[p].open_rate_pct : null)),
          color: cssVar("--text-muted"),
          accentColor: seriesColor(0),
        });
      });

      tr.addEventListener("click", () => toggleDetail(tr, e));
    });
  }

  function toggleDetail(tr, e) {
    const existing = tr.nextElementSibling;
    if (existing && existing.classList.contains("detail-row")) {
      existing.remove();
      return;
    }
    document.querySelectorAll(".detail-row").forEach((d) => d.remove());

    const detailTr = document.createElement("tr");
    detailTr.className = "detail-row";
    const td = document.createElement("td");
    td.colSpan = 8;
    const grid = document.createElement("div");
    grid.className = "detail-grid";

    const chartWrap = document.createElement("div");
    chartWrap.className = "detail-chart";
    const chartTitle = document.createElement("div");
    chartTitle.className = "card-sub";
    chartTitle.style.marginBottom = "8px";
    chartTitle.textContent = "Open rate & CTR across periods";
    chartWrap.appendChild(chartTitle);
    const chartSlot = document.createElement("div");
    chartWrap.appendChild(chartSlot);
    grid.appendChild(chartWrap);

    const tableWrap = document.createElement("div");
    tableWrap.className = "detail-mini-table";
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>Period</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Open %</th><th>Clicked</th><th>CTR</th><th>Bounce %</th></tr></thead>`;
    const tb = document.createElement("tbody");
    PERIODS.forEach((p) => {
      const r = e.byPeriod[p];
      const tr2 = document.createElement("tr");
      if (!r) {
        tr2.innerHTML = `<td>${SHORT_PERIOD[p] || p}</td><td colspan="6" style="text-align:left;color:var(--text-muted)">not sent this period</td>`;
      } else {
        tr2.innerHTML = `<td>${SHORT_PERIOD[p] || p}</td><td>${fmtInt(r.sent)}</td><td>${fmtInt(r.est_delivered)}</td><td>${fmtInt(r.opened)}</td><td>${fmtPct(r.open_rate_pct)}</td><td>${fmtInt(r.clicked)}</td><td>${fmtPct(r.ctr_clicks_over_opens_pct)}</td><td>${fmtPct(r.bounce_rate_pct)}</td>`;
      }
      tb.appendChild(tr2);
    });
    table.appendChild(tb);
    tableWrap.appendChild(table);
    grid.appendChild(tableWrap);

    td.appendChild(grid);
    detailTr.appendChild(td);
    tr.after(detailTr);

    requestAnimationFrame(() => {
      Viz.lineChart(chartSlot, {
        series: [
          { name: "Open rate", color: seriesColor(0), values: PERIODS.map((p) => (e.byPeriod[p] ? e.byPeriod[p].open_rate_pct : null)) },
          { name: "CTR (clicks/opens)", color: seriesColor(1), values: PERIODS.map((p) => (e.byPeriod[p] ? e.byPeriod[p].ctr_clicks_over_opens_pct : null)) },
        ],
        xLabels: PERIODS.map((p) => SHORT_PERIOD[p] || p),
        yFormat: (v) => v.toFixed(0) + "%",
        height: 200,
        yMaxOverride: 100,
      });
    });
  }

  // -----------------------------------------------------------------
  // WORKFLOWS TAB
  // -----------------------------------------------------------------
  const MAY = "NEW (May 8-Jun 3)", JUN = "NEW (June 4-30)";
  const wfPerf = {};
  D.workflow_performance_by_period.forEach((r) => {
    wfPerf[r.workflow_name] = wfPerf[r.workflow_name] || {};
    wfPerf[r.workflow_name][r.period_label] = r;
  });
  const wfNamesByVolume = Object.keys(wfPerf).sort((a, b) => {
    const av = (wfPerf[a][JUN] && wfPerf[a][JUN].sent) || 0;
    const bv = (wfPerf[b][JUN] && wfPerf[b][JUN].sent) || 0;
    return bv - av;
  });

  function renderWorkflowOpenRate() {
    const container = document.getElementById("chart-workflow-openrate");
    const categories = wfNamesByVolume.map(shortName);
    const series = [
      { name: "May 8–Jun 3", color: seriesColor(0), values: wfNamesByVolume.map((w) => (wfPerf[w][MAY] ? wfPerf[w][MAY].open_rate_pct : null)) },
      { name: "Jun 4–30", color: seriesColor(1), values: wfNamesByVolume.map((w) => (wfPerf[w][JUN] ? wfPerf[w][JUN].open_rate_pct : null)) },
    ];
    Viz.groupedBarChart(container, { categories, series, yFormat: (v) => v.toFixed(0) + "%", height: 300, barMax: 16, yMaxOverride: 100 });
    const legend = document.getElementById("legend-workflow-openrate");
    legend.textContent = "";
    series.forEach((s) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${s.color}"></span>${s.name}`;
      legend.appendChild(item);
    });
  }

  function renderWorkflowMix() {
    const container = document.getElementById("chart-workflow-mix");
    const periods = [MAY, JUN];
    const categories = periods.map((p) => SHORT_PERIOD[p] || p);
    const TOP_N = 7;
    const top = wfNamesByVolume.slice(0, TOP_N);
    const rest = wfNamesByVolume.slice(TOP_N);

    const totals = periods.map((p) => wfNamesByVolume.reduce((a, w) => a + ((wfPerf[w][p] && wfPerf[w][p].sent) || 0), 0));

    const series = top.map((w, i) => ({
      name: shortName(w),
      color: seriesColor(i),
      values: periods.map((p, pi) => {
        const sent = (wfPerf[w][p] && wfPerf[w][p].sent) || 0;
        return totals[pi] ? (sent / totals[pi]) * 100 : 0;
      }),
    }));
    if (rest.length) {
      series.push({
        name: "Other",
        color: OTHER_COLOR(),
        values: periods.map((p, pi) => {
          const sent = rest.reduce((a, w) => a + ((wfPerf[w][p] && wfPerf[w][p].sent) || 0), 0);
          return totals[pi] ? (sent / totals[pi]) * 100 : 0;
        }),
      });
    }
    Viz.stackedBarChart(container, { categories, series, height: 300 });
    const legend = document.getElementById("legend-workflow-mix");
    legend.textContent = "";
    series.forEach((s) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch dot" style="background:${s.color}"></span>${s.name}`;
      legend.appendChild(item);
    });
  }

  function renderEnrollmentSnapshot() {
    const strip = document.getElementById("enrollment-snapshot");
    strip.textContent = "";
    D.workflow_enrollment_snapshot.forEach((r) => {
      const chip = document.createElement("div");
      chip.className = "stat-chip";
      chip.innerHTML = `
        <div class="stat-label">${shortName(r.workflow_name)}</div>
        <div class="stat-value">${fmtInt(r.enrolled_count)} enrolled</div>
        <div class="stat-note">${r.snapshot_note}</div>
      `;
      strip.appendChild(chip);
    });
  }

  function renderWorkflowCards() {
    const wrap = document.getElementById("workflow-cards");
    wrap.textContent = "";
    D.workflows.forEach((w) => {
      const perf = wfPerf[w.workflow_name] || {};
      const mayOpen = perf[MAY] ? perf[MAY].open_rate_pct : null;
      const junOpen = perf[JUN] ? perf[JUN].open_rate_pct : null;
      const junSent = perf[JUN] ? perf[JUN].sent : null;

      const card = document.createElement("div");
      card.className = "workflow-card";
      card.innerHTML = `
        <div class="workflow-card-head">
          <div class="workflow-card-title">
            <span class="chevron">▸</span>
            <div>
              <h3>${w.workflow_name}</h3>
              <div class="workflow-card-meta">${w.workflow_type || ""}</div>
            </div>
          </div>
          <div class="workflow-card-stats">
            <span>Jun sent <b>${junSent != null ? fmtInt(junSent) : "—"}</b></span>
            <span>May open <b>${fmtPct(mayOpen)}</b></span>
            <span>Jun open <b>${fmtPct(junOpen)}</b></span>
          </div>
        </div>
        <div class="workflow-card-body">
          <dl>
            <dt>Trigger</dt><dd>${w.trigger_description || "—"}</dd>
            <dt>Lifecycle filter</dt><dd>${w.lifecycle_filter || "—"}</dd>
            <dt>Re-enroll</dt><dd>${w.re_enroll || "—"}</dd>
            <dt>Delay before first send</dt><dd>${w.delay_before_first_send || "—"}</dd>
            <dt>First email sent</dt><dd>${w.first_email_sent || "—"}</dd>
          </dl>
          <p>${w.notes || ""}</p>
        </div>
      `;
      card.querySelector(".workflow-card-head").addEventListener("click", () => {
        card.classList.toggle("is-open");
      });
      wrap.appendChild(card);
    });
  }

  // -----------------------------------------------------------------
  // Init + resize
  // -----------------------------------------------------------------
  function renderAll() {
    renderKpis();
    renderProgramCombo();
    renderInsights();
    renderEmailTable();
    renderWorkflowOpenRate();
    renderWorkflowMix();
    renderEnrollmentSnapshot();
    renderWorkflowCards();
  }

  rerenderAllCharts = function () {
    renderProgramCombo();
    renderWorkflowOpenRate();
    renderWorkflowMix();
  };

  renderAll();

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rerenderAllCharts, 150);
  });
})();
