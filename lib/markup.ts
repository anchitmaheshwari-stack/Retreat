// Static dashboard markup; lib/dashboard.js fills it in.
export const MARKUP = `<div class="wrap">
<header>
  <div>
    <div class="lbl">Skydo · Content Retreat pages · Google Search Console</div>
    <h1>Content Retreat SEO</h1>
    <p class="sub" id="subline"></p><p class="updated" id="updated"></p>
  </div>
  <div class="note" id="partial" hidden></div>
</header>

<div id="warnings"></div>
<div class="controls" role="toolbar" aria-label="Filters">
  <label class="period"><span class="lbl">Period</span><select id="period" aria-label="Period"></select></label>
  <div class="chips" id="chips"></div>
  <div class="seg" role="group" aria-label="Basis">
    <button id="b-total" aria-pressed="true">Totals</button>
    <button id="b-day" aria-pressed="false">Per day</button>
  </div>
</div>

<p class="dim" id="rangeNote" style="margin:-12px 0 0;font-size:12.5px"></p>
<section class="kpis" id="kpis" aria-label="Headline metrics"></section>

<div class="grid2">
  <section class="card">
    <div class="tblbar">
      <div><h2>By page type</h2></div>
      <div class="seg" role="group" aria-label="Metric" id="metricSeg" style="margin-left:0"></div>
    </div>
    <div class="legend" id="barLegend"></div>
    <div id="barChart"></div>
  </section>
  <section class="card">
    <h2 id="dbTitle"></h2>
    <p class="desc" id="dbDesc"></p>
    <div class="legend" id="dbLegend"></div>
    <div id="dumbbell"></div>
  </section>
</div>

<section class="card">
  <h2>Page type scorecard</h2>
  <div class="tbl-wrap"><table id="typeTbl"></table></div>
</section>

<section class="card">
  <h2>Primary keyword positions</h2>
  <p class="desc">Only URLs where Google recorded searches for the exact primary keyword on that page. Most long-tail keywords have no exact-match data.</p>
  <div class="tbl-wrap scroll" style="max-height:420px"><table id="kwTbl"></table></div>
</section>

<section class="card">
  <div class="tblbar">
    <h2>All URLs</h2>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <label class="dim" style="font-size:12.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="onlyData" checked> Only URLs with data</label>
      <input type="search" id="q" placeholder="Search URL or keyword" aria-label="Search URLs">
    </div>
  </div>
  <div class="tbl-wrap scroll"><table id="urlTbl"></table></div>
  <div class="dim" id="urlCount" style="font-size:12px"></div>
</section>

<p class="foot">Pages, page types and primary keywords from Sheet1 of Content Retreat Performance. Clicks, impressions and positions from Google Search Console, web search, refreshed daily. Leads and onboardings from Metabase. Avg position for a group is impression-weighted. Primary KW position is the exact keyword on that URL.</p>
</div>
<div class="tip" id="tip" hidden></div>
`;
