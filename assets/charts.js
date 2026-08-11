// Minimal, dependency-free SVG chart helpers.
// Palette/marks follow the dataviz skill: 2px lines, rounded bar ends,
// hairline gridlines, a shared hover tooltip, direct end-labels.
(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      for (const k in attrs) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
      getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  // ---- shared tooltip -------------------------------------------------
  let tooltipEl = null;
  function tooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "viz-tooltip";
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function showTooltip(x, y, titleText, rows) {
    const tt = tooltip();
    tt.textContent = "";
    const title = document.createElement("div");
    title.className = "tt-title";
    title.textContent = titleText;
    tt.appendChild(title);
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "tt-row";
      const key = document.createElement("span");
      key.className = "tt-key";
      if (r.color) {
        const sw = document.createElement("span");
        sw.className = "tt-swatch";
        sw.style.background = r.color;
        key.appendChild(sw);
      }
      const label = document.createElement("span");
      label.textContent = r.label;
      key.appendChild(label);
      row.appendChild(key);
      const val = document.createElement("span");
      val.className = "tt-value";
      val.textContent = r.value;
      row.appendChild(val);
      tt.appendChild(row);
    });
    tt.classList.add("is-visible");
    const pad = 14;
    let left = x + pad;
    let top = y + pad;
    const rect = tt.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
    tt.style.left = left + "px";
    tt.style.top = top + "px";
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove("is-visible");
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    let step;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 2.5) step = 2.5;
    else if (norm <= 5) step = 5;
    else step = 10;
    return step * mag;
  }

  function fmtCommas(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  // ---- multi-series line chart -----------------------------------------
  // opts: { series:[{name,color,values:[num|null]}], xLabels:[str], yFormat(v), height, yMaxOverride }
  function lineChart(container, opts) {
    container.textContent = "";
    const width = container.clientWidth || 640;
    const height = opts.height || 260;
    const marginL = 44, marginR = 16, marginT = 16, marginB = 28;
    const innerW = width - marginL - marginR;
    const innerH = height - marginT - marginB;
    const yFormat = opts.yFormat || ((v) => v);

    const allVals = opts.series.flatMap((s) => s.values.filter((v) => v != null));
    const dataMax = allVals.length ? Math.max(...allVals) : 1;
    const yMax = opts.yMaxOverride || niceMax(dataMax * 1.15);
    const n = opts.xLabels.length;
    const xStep = n > 1 ? innerW / (n - 1) : 0;

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height: height });

    const gridlineColor = cssVar("--gridline");
    const mutedColor = cssVar("--text-muted");
    const baselineColor = cssVar("--baseline");
    const surfaceColor = cssVar("--surface-1");

    // y gridlines + labels (4 steps)
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (yMax / steps) * i;
      const y = marginT + innerH - (v / yMax) * innerH;
      svg.appendChild(el("line", {
        x1: marginL, x2: marginL + innerW, y1: y, y2: y,
        stroke: i === 0 ? baselineColor : gridlineColor, "stroke-width": 1,
      }));
      const label = el("text", {
        x: marginL - 8, y: y + 4, "text-anchor": "end",
        fill: mutedColor, "font-size": 11,
      });
      label.textContent = yFormat(v);
      svg.appendChild(label);
    }

    // x labels
    opts.xLabels.forEach((lbl, i) => {
      const x = marginL + xStep * i;
      const label = el("text", {
        x, y: height - 6, "text-anchor": i === 0 ? "start" : (i === n - 1 ? "end" : "middle"),
        fill: mutedColor, "font-size": 11,
      });
      label.textContent = lbl;
      svg.appendChild(label);
    });

    const hoverGroup = el("g");
    const crosshair = el("line", {
      x1: 0, x2: 0, y1: marginT, y2: marginT + innerH,
      stroke: mutedColor, "stroke-width": 1, "stroke-dasharray": "3,3", opacity: 0,
    });
    hoverGroup.appendChild(crosshair);

    const seriesPoints = opts.series.map((s) => {
      const pts = s.values.map((v, i) => {
        if (v == null) return null;
        return { x: marginL + xStep * i, y: marginT + innerH - (v / yMax) * innerH, v };
      });
      return { ...s, pts };
    });

    // lines + area
    seriesPoints.forEach((s) => {
      const validPts = s.pts.filter(Boolean);
      if (validPts.length === 0) return;
      const pathD = s.pts
        .map((p, i) => (p ? `${i === 0 || !s.pts[i - 1] ? "M" : "L"}${p.x},${p.y}` : null))
        .filter(Boolean)
        .join(" ");
      svg.appendChild(el("path", {
        d: pathD, fill: "none", stroke: s.color, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
      }));
      validPts.forEach((p, idx) => {
        const isLast = idx === validPts.length - 1;
        svg.appendChild(el("circle", {
          cx: p.x, cy: p.y, r: isLast ? 5 : 4,
          fill: s.color, stroke: surfaceColor, "stroke-width": 2,
        }));
      });
      if (opts.directLabelLast && validPts.length) {
        const last = validPts[validPts.length - 1];
        const t = el("text", {
          x: last.x + 8, y: last.y + 4, fill: cssVar("--text-primary"),
          "font-size": 11, "font-weight": 600,
        });
        t.textContent = yFormat(last.v);
        svg.appendChild(t);
      }
    });

    svg.appendChild(hoverGroup);

    // hover hit rect
    const hit = el("rect", {
      x: marginL, y: marginT, width: innerW, height: innerH, fill: "transparent",
    });
    hit.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * width;
      let idx = Math.round((relX - marginL) / (xStep || 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      const cx = marginL + xStep * idx;
      crosshair.setAttribute("x1", cx);
      crosshair.setAttribute("x2", cx);
      crosshair.setAttribute("opacity", 1);
      const rows = seriesPoints
        .filter((s) => s.pts[idx])
        .map((s) => ({ color: s.color, label: s.name, value: yFormat(s.pts[idx].v) }));
      if (rows.length) showTooltip(e.clientX, e.clientY, opts.xLabels[idx], rows);
    });
    hit.addEventListener("pointerleave", () => {
      crosshair.setAttribute("opacity", 0);
      hideTooltip();
    });
    svg.appendChild(hit);

    container.appendChild(svg);
  }

  // ---- combo chart: one indexed bar series + N line series on a shared 0-100 axis
  // opts: {
  //   categories:[str],
  //   bar: { name, color, values:[0-100 indexed], rawValues:[num], rawFormat(v) },
  //   lines: [{ name, color, values:[0-100 real pct] }],
  //   yFormat(v), height, barMax
  // }
  function comboBarLineChart(container, opts) {
    container.textContent = "";
    const width = container.clientWidth || 640;
    const height = opts.height || 280;
    const marginL = 44, marginR = 16, marginT = 28, marginB = 28;
    const innerW = width - marginL - marginR;
    const innerH = height - marginT - marginB;
    const yFormat = opts.yFormat || ((v) => v + "%");
    const n = opts.categories.length;
    const groupW = innerW / n;
    const barW = Math.min(opts.barMax || 56, groupW * 0.42);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
    const gridlineColor = cssVar("--gridline");
    const mutedColor = cssVar("--text-muted");
    const baselineColor = cssVar("--baseline");
    const surfaceColor = cssVar("--surface-1");
    const primaryColor = cssVar("--text-primary");

    const yMax = 100;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (yMax / steps) * i;
      const y = marginT + innerH - (v / yMax) * innerH;
      svg.appendChild(el("line", {
        x1: marginL, x2: marginL + innerW, y1: y, y2: y,
        stroke: i === 0 ? baselineColor : gridlineColor, "stroke-width": 1,
      }));
      const label = el("text", { x: marginL - 8, y: y + 4, "text-anchor": "end", fill: mutedColor, "font-size": 11 });
      label.textContent = yFormat(v);
      svg.appendChild(label);
    }

    const centers = opts.categories.map((_, i) => marginL + groupW * i + groupW / 2);

    // bars
    opts.categories.forEach((cat, i) => {
      const v = opts.bar.values[i];
      if (v == null) return;
      const barH = (v / yMax) * innerH;
      const x = centers[i] - barW / 2;
      const y = marginT + innerH - barH;
      const rect = el("rect", { x, y, width: barW, height: Math.max(barH, 1), fill: opts.bar.color, rx: 4, ry: 4 });
      const rawLabel = opts.bar.rawFormat ? opts.bar.rawFormat(opts.bar.rawValues[i]) : opts.bar.rawValues[i];
      rect.addEventListener("pointerenter", (e) => { rect.setAttribute("opacity", 0.82); emitTooltip(e); });
      rect.addEventListener("pointermove", emitTooltip);
      rect.addEventListener("pointerleave", () => { rect.setAttribute("opacity", 1); hideTooltip(); });
      svg.appendChild(rect);

      const cap = el("text", {
        x: centers[i], y: y - 8, "text-anchor": "middle", fill: primaryColor, "font-size": 11, "font-weight": 600,
      });
      cap.textContent = rawLabel;
      svg.appendChild(cap);

      function emitTooltip(e) {
        const rows = [{ color: opts.bar.color, label: opts.bar.name, value: rawLabel }];
        opts.lines.forEach((s) => {
          if (s.values[i] != null) rows.push({ color: s.color, label: s.name, value: yFormat(s.values[i]) });
        });
        showTooltip(e.clientX, e.clientY, cat, rows);
      }
    });

    // lines
    opts.lines.forEach((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : { x: centers[i], y: marginT + innerH - (v / yMax) * innerH, v }));
      const validPts = pts.filter(Boolean);
      if (!validPts.length) return;
      const d = pts.map((p, i) => (p ? `${i === 0 || !pts[i - 1] ? "M" : "L"}${p.x},${p.y}` : null)).filter(Boolean).join(" ");
      svg.appendChild(el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      validPts.forEach((p, idx) => {
        const isLast = idx === validPts.length - 1;
        const dot = el("circle", { cx: p.x, cy: p.y, r: isLast ? 5 : 4, fill: s.color, stroke: surfaceColor, "stroke-width": 2 });
        dot.style.pointerEvents = "none";
        svg.appendChild(dot);
      });
    });

    // x labels
    opts.categories.forEach((cat, i) => {
      const label = el("text", { x: centers[i], y: height - 8, "text-anchor": "middle", fill: mutedColor, "font-size": 11 });
      label.textContent = cat;
      svg.appendChild(label);
    });

    container.appendChild(svg);
  }

  // ---- grouped bar chart -------------------------------------------------
  // opts: { categories:[str], series:[{name,color,values}], yFormat(v), height, barMax }
  function groupedBarChart(container, opts) {
    container.textContent = "";
    const width = container.clientWidth || 640;
    const rotateLabels = opts.categories.length > 6;
    const height = opts.height || 260;
    const marginL = 44, marginR = 16, marginT = 16, marginB = rotateLabels ? 78 : 46;
    const innerW = width - marginL - marginR;
    const innerH = height - marginT - marginB;
    const yFormat = opts.yFormat || ((v) => v);

    const allVals = opts.series.flatMap((s) => s.values.filter((v) => v != null));
    const dataMax = allVals.length ? Math.max(...allVals) : 1;
    const yMax = opts.yMaxOverride || niceMax(dataMax * 1.15);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
    const gridlineColor = cssVar("--gridline");
    const mutedColor = cssVar("--text-muted");
    const baselineColor = cssVar("--baseline");
    const surfaceColor = cssVar("--surface-1");

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (yMax / steps) * i;
      const y = marginT + innerH - (v / yMax) * innerH;
      svg.appendChild(el("line", {
        x1: marginL, x2: marginL + innerW, y1: y, y2: y,
        stroke: i === 0 ? baselineColor : gridlineColor, "stroke-width": 1,
      }));
      const label = el("text", { x: marginL - 8, y: y + 4, "text-anchor": "end", fill: mutedColor, "font-size": 11 });
      label.textContent = yFormat(v);
      svg.appendChild(label);
    }

    const groupW = innerW / opts.categories.length;
    const barGap = 2;
    const maxBarW = opts.barMax || 22;
    const nSeries = opts.series.length;
    const barW = Math.min(maxBarW, (groupW - barGap * (nSeries + 1)) / nSeries);
    const groupContentW = barW * nSeries + barGap * (nSeries - 1);

    opts.categories.forEach((cat, ci) => {
      const groupX = marginL + groupW * ci + (groupW - groupContentW) / 2;
      opts.series.forEach((s, si) => {
        const v = s.values[ci];
        if (v == null) return;
        const barH = (v / yMax) * innerH;
        const x = groupX + si * (barW + barGap);
        const y = marginT + innerH - barH;
        const rect = el("rect", {
          x, y, width: barW, height: Math.max(barH, 1),
          fill: s.color, rx: 4, ry: 4,
        });
        rect.addEventListener("pointerenter", (e) => {
          rect.setAttribute("opacity", 0.82);
          showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: yFormat(v) }]);
        });
        rect.addEventListener("pointermove", (e) => showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: yFormat(v) }]));
        rect.addEventListener("pointerleave", () => { rect.setAttribute("opacity", 1); hideTooltip(); });
        svg.appendChild(rect);
      });
      const words = String(cat);
      const short = words.length > 18 ? words.slice(0, 17) + "…" : words;
      const label = el("text", {
        x: marginL + groupW * ci + groupW / 2,
        y: rotateLabels ? height - marginB + 14 : height - marginB + 18,
        "text-anchor": rotateLabels ? "end" : "middle",
        fill: mutedColor, "font-size": 11,
      });
      if (rotateLabels) {
        label.setAttribute("transform", `rotate(-40 ${marginL + groupW * ci + groupW / 2} ${height - marginB + 14})`);
      }
      label.textContent = short;
      const titleTag = el("title");
      titleTag.textContent = words;
      label.appendChild(titleTag);
      svg.appendChild(label);
    });

    container.appendChild(svg);
  }

  // ---- 100%-stacked bar chart (share of total) --------------------------
  // opts: { categories:[str], series:[{name,color,values}] } values are shares 0..100 already
  // opts: { categories:[str], series:[{name,color,values}], height, mode:'percent'|'absolute', yFormat(v), tooltipFormat(v) }
  // 'percent' (default): values are shares 0..100, axis is a fixed 0-100% scale.
  // 'absolute': values are raw counts, axis is a niceMax'd scale over the tallest stacked total.
  function stackedBarChart(container, opts) {
    container.textContent = "";
    const width = container.clientWidth || 640;
    const height = opts.height || 260;
    const marginL = 52, marginR = 16, marginT = 16, marginB = 30;
    const innerW = width - marginL - marginR;
    const innerH = height - marginT - marginB;
    const surfaceColor = cssVar("--surface-1");
    const mutedColor = cssVar("--text-muted");
    const gridlineColor = cssVar("--gridline");
    const baselineColor = cssVar("--baseline");
    const isAbsolute = opts.mode === "absolute";

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });

    let yMax = 100;
    if (isAbsolute) {
      const totals = opts.categories.map((_, ci) => opts.series.reduce((a, s) => a + (s.values[ci] || 0), 0));
      yMax = niceMax(Math.max(...totals) * 1.1);
    }
    const yFormat = opts.yFormat || ((v) => (isAbsolute ? fmtCommas(v) : v + "%"));
    const tooltipFormat = opts.tooltipFormat || ((v) => (isAbsolute ? fmtCommas(v) : v.toFixed(1) + "%"));

    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = (yMax / tickCount) * i;
      const y = marginT + innerH - (v / yMax) * innerH;
      svg.appendChild(el("line", {
        x1: marginL, x2: marginL + innerW, y1: y, y2: y,
        stroke: i === 0 ? baselineColor : gridlineColor, "stroke-width": 1,
      }));
      const label = el("text", { x: marginL - 8, y: y + 4, "text-anchor": "end", fill: mutedColor, "font-size": 11 });
      label.textContent = yFormat(v);
      svg.appendChild(label);
    }

    const groupW = innerW / opts.categories.length;
    const barW = Math.min(90, groupW * 0.5);
    const gap = 2;

    opts.categories.forEach((cat, ci) => {
      let acc = 0;
      const x = marginL + groupW * ci + (groupW - barW) / 2;
      opts.series.forEach((s) => {
        const v = s.values[ci] || 0;
        if (v <= 0) return;
        const segH = Math.max((v / yMax) * innerH - gap, 0);
        const yTop = marginT + innerH - ((acc + v) / yMax) * innerH;
        const rect = el("rect", {
          x, y: yTop, width: barW, height: segH, fill: s.color, rx: 3, ry: 3,
        });
        rect.addEventListener("pointerenter", (e) => {
          rect.setAttribute("opacity", 0.82);
          showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: tooltipFormat(v) }]);
        });
        rect.addEventListener("pointermove", (e) => showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: tooltipFormat(v) }]));
        rect.addEventListener("pointerleave", () => { rect.setAttribute("opacity", 1); hideTooltip(); });
        svg.appendChild(rect);
        acc += v;
      });
      const label = el("text", {
        x: marginL + groupW * ci + groupW / 2, y: height - 8,
        "text-anchor": "middle", fill: mutedColor, "font-size": 11,
      });
      label.textContent = cat;
      svg.appendChild(label);
    });

    container.appendChild(svg);
  }

  // ---- horizontal grouped bar chart --------------------------------------
  // For categorical lists too long to color-code (identity carried by the
  // row label, not hue) — e.g. every product model, ranked. Height grows
  // with the number of categories rather than squeezing them into a fixed box.
  // opts: { categories:[str], series:[{name,color,values}], yFormat(v), rowHeight, barMax }
  function horizontalGroupedBarChart(container, opts) {
    container.textContent = "";
    const width = container.clientWidth || 640;
    const rowHeight = opts.rowHeight || 34;
    const marginL = 132, marginR = 56, marginT = 12, marginB = 28;
    const innerW = width - marginL - marginR;
    const n = opts.categories.length;
    const innerH = rowHeight * n;
    const height = innerH + marginT + marginB;
    const yFormat = opts.yFormat || ((v) => fmtCommas(v));

    const allVals = opts.series.flatMap((s) => s.values.filter((v) => v != null));
    const dataMax = allVals.length ? Math.max(...allVals) : 1;
    const xMax = niceMax(dataMax * 1.15);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
    const gridlineColor = cssVar("--gridline");
    const mutedColor = cssVar("--text-muted");
    const primaryColor = cssVar("--text-primary");
    const baselineColor = cssVar("--baseline");

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (xMax / steps) * i;
      const x = marginL + (v / xMax) * innerW;
      svg.appendChild(el("line", {
        x1: x, x2: x, y1: marginT, y2: marginT + innerH,
        stroke: i === 0 ? baselineColor : gridlineColor, "stroke-width": 1,
      }));
      const label = el("text", { x, y: marginT + innerH + 18, "text-anchor": "middle", fill: mutedColor, "font-size": 11 });
      label.textContent = yFormat(v);
      svg.appendChild(label);
    }

    const nSeries = opts.series.length;
    const barGap = 3;
    const groupPad = 6;
    const barH = Math.min(opts.barMax || 12, (rowHeight - groupPad * 2 - barGap * (nSeries - 1)) / nSeries);
    const groupContentH = barH * nSeries + barGap * (nSeries - 1);

    opts.categories.forEach((cat, ci) => {
      const rowY = marginT + rowHeight * ci;
      const groupY = rowY + (rowHeight - groupContentH) / 2;

      const label = el("text", {
        x: marginL - 10, y: rowY + rowHeight / 2 + 4, "text-anchor": "end", fill: primaryColor, "font-size": 12,
      });
      const text = String(cat);
      label.textContent = text.length > 20 ? text.slice(0, 19) + "…" : text;
      if (text.length > 20) {
        const t = el("title");
        t.textContent = text;
        label.appendChild(t);
      }
      svg.appendChild(label);

      opts.series.forEach((s, si) => {
        const v = s.values[ci];
        if (v == null) return;
        const y = groupY + si * (barH + barGap);
        const barW = Math.max((v / xMax) * innerW, 1);
        const rect = el("rect", { x: marginL, y, width: barW, height: barH, fill: s.color, rx: 3, ry: 3 });
        rect.addEventListener("pointerenter", (e) => { rect.setAttribute("opacity", 0.82); showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: yFormat(v) }]); });
        rect.addEventListener("pointermove", (e) => showTooltip(e.clientX, e.clientY, cat, [{ color: s.color, label: s.name, value: yFormat(v) }]));
        rect.addEventListener("pointerleave", () => { rect.setAttribute("opacity", 1); hideTooltip(); });
        svg.appendChild(rect);

        const valueLabel = el("text", {
          x: marginL + barW + 6, y: y + barH / 2 + 4, "text-anchor": "start", fill: mutedColor, "font-size": 11,
        });
        valueLabel.textContent = yFormat(v);
        svg.appendChild(valueLabel);
      });
    });

    container.appendChild(svg);
  }

  // ---- sparkline ---------------------------------------------------------
  // opts: { values:[num|null], color, accentColor, width, height }
  function sparkline(container, opts) {
    container.textContent = "";
    const width = opts.width || 64;
    const height = opts.height || 22;
    const pad = 4;
    const pts = [];
    opts.values.forEach((v, i) => { if (v != null) pts.push({ i, v }); });
    if (pts.length < 2) {
      const span = document.createElement("span");
      span.className = "period-chip";
      span.textContent = pts.length === 1 ? `${pts[0].v.toFixed(0)}%` : "—";
      container.appendChild(span);
      return;
    }
    const vals = pts.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const n = opts.values.length;
    const xStep = n > 1 ? (width - pad * 2) / (n - 1) : 0;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width, height });
    const mapped = pts.map((p) => ({
      x: pad + p.i * xStep,
      y: pad + (height - pad * 2) - ((p.v - min) / range) * (height - pad * 2),
      v: p.v,
    }));
    const d = mapped.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    svg.appendChild(el("path", {
      d, fill: "none", stroke: opts.color, "stroke-width": 2,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    mapped.forEach((p, i) => {
      const isLast = i === mapped.length - 1;
      svg.appendChild(el("circle", {
        cx: p.x, cy: p.y, r: isLast ? 3 : 2,
        fill: isLast ? (opts.accentColor || opts.color) : opts.color,
      }));
    });
    container.appendChild(svg);
  }

  global.Viz = { lineChart, comboBarLineChart, groupedBarChart, stackedBarChart, horizontalGroupedBarChart, sparkline, fmtCommas, showTooltip, hideTooltip };
})(window);
