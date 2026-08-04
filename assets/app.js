(function () {
  const D = window.NEWMAR_DATA;
  const PERIODS = D.period_order; // OLD, NEW-May, NEW-June
  // Hand-tuned short labels for the periods currently in the source data.
  // periodLabel() below falls back to an auto-prettified label for anything
  // not listed here, so a newly-imported period still reads reasonably
  // without needing this map updated by hand every time.
  const SHORT_PERIOD = {
    "OLD (Apr 11-May 7)": "OLD (Apr–May 7)",
    "NEW (May 8-Jun 3)": "May 8–Jun 3",
    "NEW (June 4-30)": "Jun 4–30",
  };
  function periodLabel(p) {
    if (!p) return p;
    if (SHORT_PERIOD[p]) return SHORT_PERIOD[p];
    const m = p.match(/^(OLD|NEW)\s*\((.+)\)$/);
    if (!m) return p;
    return m[2].replace(/-/g, "–");
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // The Workflows tab compares "the latest period" against "the one before it."
  // workflow_performance_by_period never has an OLD-period row (those workflows
  // didn't exist pre-relaunch), so this recomputes from whatever's actually
  // there each time a new period is imported, instead of naming two months.
  function latestTwoWorkflowPeriods() {
    const present = new Set(D.workflow_performance_by_period.map((r) => r.period_label));
    const inOrder = PERIODS.filter((p) => present.has(p));
    return [inOrder[inOrder.length - 2] || null, inOrder[inOrder.length - 1] || null];
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

  // Computed directly from program_level_metrics (latest vs. prior period) rather
  // than the one-off june_2026_report_kpis table, so these tiles keep tracking
  // the actual latest period as new CSVs get imported instead of saying "(June)"
  // forever. june_2026_report_kpis stays around for KPIs a plain email CSV can't
  // supply (site traffic, HVTs, Aimbase delivery, etc.).
  function renderKpis() {
    const idx = PERIODS.length - 1;
    const currP = PERIODS[idx];
    const prevP = idx > 0 ? PERIODS[idx - 1] : null;
    const curr = programByPeriod[currP];
    const row = document.getElementById("overview-kpis");
    row.textContent = "";
    if (!curr) return;
    const prev = prevP ? programByPeriod[prevP] : null;
    const currLabel = periodLabel(currP);
    const prevLabel = prevP ? periodLabel(prevP) : null;

    const tiles = [
      { label: `Email open rate (${currLabel})`, value: fmtPct(curr.open_rate_pct), curKey: "open_rate_pct", kind: "pts", goodUp: true },
      { label: `Click rate, clicks/delivered (${currLabel})`, value: fmtPct(curr.click_rate_clicks_over_delivered_pct), curKey: "click_rate_clicks_over_delivered_pct", kind: "pts", goodUp: true },
      { label: `CTR, clicks/opens (${currLabel})`, value: fmtPct(curr.ctr_clicks_over_opens_pct), curKey: "ctr_clicks_over_opens_pct", kind: "pts", goodUp: true },
      { label: `Total sends (${currLabel})`, value: fmtInt(curr.total_sends), curKey: "total_sends", kind: "pct", goodUp: true },
    ];

    tiles.forEach((t) => {
      const div = document.createElement("div");
      div.className = "kpi-tile";
      let deltaHtml = "";
      if (prev && curr[t.curKey] != null && prev[t.curKey] != null) {
        const delta = t.kind === "pts"
          ? curr[t.curKey] - prev[t.curKey]
          : (prev[t.curKey] ? ((curr[t.curKey] - prev[t.curKey]) / prev[t.curKey]) * 100 : null);
        if (delta != null) {
          const sign = delta >= 0 ? "+" : "";
          const dClass = (delta >= 0) === t.goodUp ? "up" : "down";
          const arrow = delta >= 0 ? "↑ " : "↓ ";
          const amount = t.kind === "pts" ? `${sign}${delta.toFixed(1)} pts` : `${sign}${Math.round(delta)}%`;
          deltaHtml = `<div class="kpi-delta ${dClass}">${arrow}${amount} vs ${prevLabel}</div>`;
        }
      }
      div.innerHTML = `
        <div class="kpi-label">${t.label}</div>
        <div class="kpi-value">${t.value}</div>
        ${deltaHtml}
      `;
      row.appendChild(div);
    });
  }

  function renderProgramCombo() {
    const container = document.getElementById("chart-program-combo");
    const categories = PERIODS.map((p) => periodLabel(p));
    const sends = PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].total_sends : null));
    const sendsMax = Math.max(...sends.filter((v) => v != null));
    const barIndexed = sends.map((v) => (v == null ? null : (v / sendsMax) * 100));

    const bar = { name: "Sent", color: seriesColor(0), values: barIndexed, rawValues: sends, rawFormat: (v) => Viz.fmtCommas(v) };
    const lines = [
      { name: "Open rate", color: seriesColor(1), values: PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].open_rate_pct : null)) },
      { name: "CTR", color: seriesColor(2), values: PERIODS.map((p) => (programByPeriod[p] ? programByPeriod[p].ctr_clicks_over_opens_pct : null)) },
    ];

    Viz.comboBarLineChart(container, { categories, bar, lines, yFormat: (v) => v.toFixed(0) + "%", height: 300, barMax: 64 });

    const legend = document.getElementById("legend-program-combo");
    legend.textContent = "";
    const barItem = document.createElement("span");
    barItem.className = "legend-item";
    barItem.innerHTML = `<span class="legend-swatch dot" style="background:${bar.color}"></span>${bar.name}`;
    legend.appendChild(barItem);
    lines.forEach((s) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${s.color}"></span>${s.name}`;
      legend.appendChild(item);
    });
  }

  function renderInsights() {
    const wfByKey = {};
    D.workflow_performance_by_period.forEach((r) => {
      wfByKey[r.workflow_name] = wfByKey[r.workflow_name] || {};
      wfByKey[r.workflow_name][r.period_label] = r;
    });
    const [PREV, CURR] = latestTwoWorkflowPeriods();
    if (!CURR) {
      document.getElementById("insights-list").innerHTML = "";
      return;
    }
    const currShort = periodLabel(CURR);
    const prevShort = PREV ? (periodLabel(PREV)) : null;

    const currRows = D.workflow_performance_by_period.filter((r) => r.period_label === CURR);
    const currTotal = currRows.reduce((a, r) => a + (r.sent || 0), 0);
    const topOfFunnelCurr = ["2027 Brochure Downloads (per-model)", "Leads - Exploring"]
      .reduce((a, name) => a + ((wfByKey[name] && wfByKey[name][CURR] && wfByKey[name][CURR].sent) || 0), 0);
    const topOfFunnelShare = currTotal ? (topOfFunnelCurr / currTotal) * 100 : 0;

    const sql = wfByKey["2027 - Score Based SQL Nurture"];
    const sqlSentDelta = PREV && sql && sql[PREV] && sql[CURR]
      ? ((sql[CURR].sent - sql[PREV].sent) / sql[PREV].sent) * 100 : null;

    const factoryTour = wfByKey["2027 Self-Guided Factory Tour Request Nurture"];
    const invQuote = wfByKey["2027 - Inventory Request A Quote Nurture"];

    const items = [];
    items.push(`<strong>Top-of-funnel mix shapes the blended open rate.</strong> Brochure Downloads + Leads-Exploring made up ${topOfFunnelShare.toFixed(0)}% of all ${currShort} sends — these are naturally lower-engagement, top-of-funnel workflows, so blended open rate falls even without any single email getting worse.`);
    if (PREV && factoryTour && factoryTour[PREV] && factoryTour[CURR] && invQuote && invQuote[PREV] && invQuote[CURR]) {
      const ftDelta = factoryTour[CURR].open_rate_pct - factoryTour[PREV].open_rate_pct;
      const iqDelta = invQuote[CURR].open_rate_pct - invQuote[PREV].open_rate_pct;
      const bothUp = ftDelta >= 0 && iqDelta >= 0;
      const bothDown = ftDelta < 0 && iqDelta < 0;
      const headline = bothUp ? "Niche behavior-triggered workflows are small but improving."
        : bothDown ? "Niche behavior-triggered workflows cooled off this period."
        : "Niche behavior-triggered workflows: mixed signals.";
      items.push(`<strong>${headline}</strong> Factory Tour open rate moved ${factoryTour[PREV].open_rate_pct.toFixed(1)}% → ${factoryTour[CURR].open_rate_pct.toFixed(1)}%; Inventory Quote moved ${invQuote[PREV].open_rate_pct.toFixed(1)}% → ${invQuote[CURR].open_rate_pct.toFixed(1)}% (both still low-volume, so a few sends can swing the rate a lot).`);
    }
    if (sqlSentDelta != null) {
      const rebound = sqlSentDelta >= 0
        ? "a rebound worth understanding the driver of (did the lead-scoring/handoff pipeline change, or did volume genuinely pick up?)"
        : "worth confirming this isn't a lead-scoring/handoff issue upstream of email";
      items.push(`<strong>Watch SQL volume.</strong> SQL nurture email sends ${sqlSentDelta >= 0 ? "+" : ""}${sqlSentDelta.toFixed(0)}% ${prevShort}→${currShort} — ${rebound}.`);
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
    opt.textContent = periodLabel(p);
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
      periodTd.innerHTML = `<span class="period-chip">${periodLabel(period)}</span>`;
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
        tr2.innerHTML = `<td>${periodLabel(p)}</td><td colspan="6" style="text-align:left;color:var(--text-muted)">not sent this period</td>`;
      } else {
        tr2.innerHTML = `<td>${periodLabel(p)}</td><td>${fmtInt(r.sent)}</td><td>${fmtInt(r.est_delivered)}</td><td>${fmtInt(r.opened)}</td><td>${fmtPct(r.open_rate_pct)}</td><td>${fmtInt(r.clicked)}</td><td>${fmtPct(r.ctr_clicks_over_opens_pct)}</td><td>${fmtPct(r.bounce_rate_pct)}</td>`;
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
        xLabels: PERIODS.map((p) => periodLabel(p)),
        yFormat: (v) => v.toFixed(0) + "%",
        height: 200,
        yMaxOverride: 100,
      });
    });
  }

  // -----------------------------------------------------------------
  // WORKFLOWS TAB
  // -----------------------------------------------------------------
  const [PREV_WF, CURR_WF] = latestTwoWorkflowPeriods();
  const wfPerf = {};
  D.workflow_performance_by_period.forEach((r) => {
    wfPerf[r.workflow_name] = wfPerf[r.workflow_name] || {};
    wfPerf[r.workflow_name][r.period_label] = r;
  });
  const wfNamesByVolume = Object.keys(wfPerf).sort((a, b) => {
    const av = (CURR_WF && wfPerf[a][CURR_WF] && wfPerf[a][CURR_WF].sent) || 0;
    const bv = (CURR_WF && wfPerf[b][CURR_WF] && wfPerf[b][CURR_WF].sent) || 0;
    return bv - av;
  });

  function renderWorkflowOpenRate() {
    const container = document.getElementById("chart-workflow-openrate");
    const categories = wfNamesByVolume.map(shortName);
    const series = [
      { name: periodLabel(PREV_WF), color: seriesColor(0), values: wfNamesByVolume.map((w) => (PREV_WF && wfPerf[w][PREV_WF] ? wfPerf[w][PREV_WF].open_rate_pct : null)) },
      { name: periodLabel(CURR_WF), color: seriesColor(1), values: wfNamesByVolume.map((w) => (CURR_WF && wfPerf[w][CURR_WF] ? wfPerf[w][CURR_WF].open_rate_pct : null)) },
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
    const periods = [PREV_WF, CURR_WF].filter(Boolean);
    const categories = periods.map((p) => periodLabel(p));
    const TOP_N = 7;
    const top = wfNamesByVolume.slice(0, TOP_N);
    const rest = wfNamesByVolume.slice(TOP_N);

    const series = top.map((w, i) => ({
      name: shortName(w),
      color: seriesColor(i),
      values: periods.map((p) => (wfPerf[w][p] && wfPerf[w][p].sent) || 0),
    }));
    if (rest.length) {
      series.push({
        name: "Other",
        color: OTHER_COLOR(),
        values: periods.map((p) => rest.reduce((a, w) => a + ((wfPerf[w][p] && wfPerf[w][p].sent) || 0), 0)),
      });
    }
    Viz.stackedBarChart(container, { categories, series, height: 300, mode: "absolute" });
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
      const prevOpen = PREV_WF && perf[PREV_WF] ? perf[PREV_WF].open_rate_pct : null;
      const currOpen = CURR_WF && perf[CURR_WF] ? perf[CURR_WF].open_rate_pct : null;
      const currSent = CURR_WF && perf[CURR_WF] ? perf[CURR_WF].sent : null;
      const prevLabel = PREV_WF ? (periodLabel(PREV_WF)) : "prev";
      const currLabel = CURR_WF ? (periodLabel(CURR_WF)) : "latest";

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
            <span>${currLabel} sent <b>${currSent != null ? fmtInt(currSent) : "—"}</b></span>
            <span>${prevLabel} open <b>${fmtPct(prevOpen)}</b></span>
            <span>${currLabel} open <b>${fmtPct(currOpen)}</b></span>
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
