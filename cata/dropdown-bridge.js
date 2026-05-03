(() => {
  const LABEL = 'Drop Down / OEI';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function ensureOption() {
    const select = document.getElementById('visualSelect');
    if (!select || select.querySelector('option[value="dropdown"]')) return;
    const option = document.createElement('option');
    option.value = 'dropdown';
    option.textContent = LABEL;
    select.appendChild(option);
  }

  function ensureTab() {
    const tabs = document.querySelector('.viewer-tabs');
    if (!tabs || tabs.querySelector('[data-viz="dropdown"]')) return;
    const btn = document.createElement('button');
    btn.className = 'viewer-tab';
    btn.dataset.viz = 'dropdown';
    btn.type = 'button';
    btn.textContent = 'DROP';
    tabs.appendChild(btn);
  }

  function ensureActionButton() {
    const row = document.querySelector('.action-row');
    if (!row || document.getElementById('openDropdownBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'openDropdownBtn';
    btn.className = 'ghost-btn';
    btn.type = 'button';
    btn.textContent = 'Abrir Drop Down';
    row.appendChild(btn);
    btn.addEventListener('click', showDropdown);
  }

  function ensureFrame() {
    const wrap = document.getElementById('vizWrap');
    if (!wrap) return null;
    let frame = document.getElementById('dropdownFrame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'dropdownFrame';
      frame.className = 'viz-frame';
      frame.src = '../dropdown/?embed=1';
      frame.allowFullscreen = true;
      wrap.appendChild(frame);
    }
    return frame;
  }

  function setTitle(text) {
    const title = document.getElementById('vizSubtitle');
    if (title) title.textContent = text;
  }

  function markTab() {
    document.querySelectorAll('.viewer-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viz === 'dropdown');
    });
  }

  function hideNativeFrames() {
    ['adcFrame', 'watFrame', 'rtoFrame'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
  }

  function showDropdown() {
    ensureOption();
    ensureTab();
    const frame = ensureFrame();
    if (!frame) return;

    hideNativeFrames();
    frame.classList.add('active');

    const placeholder = document.getElementById('vizPlaceholder');
    if (placeholder) placeholder.hidden = true;

    const pane = document.getElementById('viewerPane');
    pane?.classList.remove('is-empty');

    const select = document.getElementById('visualSelect');
    if (select) select.value = 'dropdown';

    setTitle('Carta Drop Down / OEI Height Loss');
    markTab();

    const meta = document.getElementById('viewerMeta');
    const legend = document.getElementById('vizLegend');
    const facts = document.getElementById('vizFacts');
    if (meta && legend && facts) {
      meta.hidden = false;
      legend.innerHTML = '<span class="viz-legend-item"><span class="viz-swatch" style="background:#4aa3ff"></span>Drop Down / Height Loss</span><span class="viz-legend-item"><span class="viz-swatch" style="background:#f3b447"></span>Avisos de envelope</span>';
      facts.innerHTML = '<div class="viz-fact"><span class="viz-fact-label">Gráfico</span><span class="viz-fact-value">OEI Drop Down</span></div><div class="viz-fact"><span class="viz-fact-label">Perfis</span><span class="viz-fact-value">Offshore Level / Descending / CTO / Enhanced</span></div>';
    }
  }

  function bindEvents() {
    const select = document.getElementById('visualSelect');
    if (select && select.dataset.dropdownBridgeBound !== '1') {
      select.dataset.dropdownBridgeBound = '1';
      select.addEventListener('change', (event) => {
        if (select.value !== 'dropdown') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showDropdown();
      }, true);
    }

    document.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-viz="dropdown"]');
      if (!btn) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showDropdown();
    }, true);
  }

  ready(() => {
    ensureOption();
    ensureTab();
    ensureActionButton();
    ensureFrame();
    bindEvents();
  });
})();
