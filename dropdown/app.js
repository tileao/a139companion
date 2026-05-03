const SHARED_KEY = 'aw139_companion_shared_context_v1';

const PROFILES = {
  landing: [
    {
      id: 'cat_a_offshore_level',
      label: 'CAT A Offshore LEVEL profile',
      chartFamily: 'offshore_standard',
      profileCorrectionFt: 0,
      reference: 'Sup. 12 / Sup. 50 — BLDP'
    },
    {
      id: 'cat_a_offshore_descending',
      label: 'CAT A Offshore DESCENDING profile',
      chartFamily: 'offshore_standard',
      profileCorrectionFt: 15,
      reference: 'Sup. 12 / Sup. 50 — BLDP + 15 ft'
    }
  ],
  takeoff: [
    {
      id: 'cat_a_offshore_procedure',
      label: 'CAT A OFFSHORE procedure',
      chartFamily: 'offshore_standard',
      profileCorrectionFt: 0,
      reference: 'Sup. 12 / Sup. 50 — CTO / BTS'
    },
    {
      id: 'cat_a_enhanced_offshore_procedure',
      label: 'CAT A ENHANCED OFFSHORE procedure',
      chartFamily: 'enhanced_offshore',
      profileCorrectionFt: 0,
      reference: 'Sup. 97 — CTO OEI, NR 102%'
    }
  ]
};

const LIMITS = {
  offshore_standard_6400: { id: 'supplement_12_offshore_6400', label: 'Sup. 12 standard até 6400 kg', minWeight: 5800, maxWeight: 6400, minPa: -1000, maxPa: 5000, minOat: -30, maxOat: 50, maxDrop: 150 },
  offshore_standard_6800: { id: 'supplement_50_offshore_6800', label: 'Sup. 50 IGW até 6800 kg', minWeight: 5800, maxWeight: 6800, minPa: -1000, maxPa: 5000, minOat: -30, maxOat: 50, maxDrop: 150 },
  enhanced_offshore_7000: { id: 'supplement_97_enhanced_offshore_7000', label: 'Sup. 97 Enhanced até 7000 kg', minWeight: 6000, maxWeight: 7000, minPa: -1000, maxPa: 1000, minOat: -30, maxOat: 50, minHeadwind: 10, maxHeadwind: 40, maxDrop: 150 }
};

const els = {
  phase: document.getElementById('phaseSelect'),
  profile: document.getElementById('profileSelect'),
  pa: document.getElementById('pressureAltitude'),
  oat: document.getElementById('oat'),
  weight: document.getElementById('weight'),
  headwind: document.getElementById('headwind'),
  calculateBtn: document.getElementById('calculateBtn'),
  copyBtn: document.getElementById('copyBtn'),
  loadContextBtn: document.getElementById('loadContextBtn'),
  statusChip: document.getElementById('statusChip'),
  heightLossValue: document.getElementById('heightLossValue'),
  resultSub: document.getElementById('resultSub'),
  chartFamily: document.getElementById('chartFamily'),
  profileCorrection: document.getElementById('profileCorrection'),
  windCorrection: document.getElementById('windCorrection'),
  envelopeInfo: document.getElementById('envelopeInfo'),
  messages: document.getElementById('messages')
};

let lastResult = null;

function loadCtx() {
  try { return JSON.parse(localStorage.getItem(SHARED_KEY) || '{}'); } catch { return {}; }
}

function saveCtx(patch) {
  localStorage.setItem(SHARED_KEY, JSON.stringify({
    ...loadCtx(),
    ...patch,
    updatedAt: new Date().toISOString(),
    lastModule: 'dropdown'
  }));
}

function num(el, fallback = 0) {
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function roundTo(value, step = 1) {
  return Math.round(value / step) * step;
}

function formatFt(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.ceil(value)} ft`;
}

function selectedProfile() {
  const phaseProfiles = PROFILES[els.phase.value] || PROFILES.landing;
  return phaseProfiles.find(p => p.id === els.profile.value) || phaseProfiles[0];
}

function populateProfiles() {
  const list = PROFILES[els.phase.value] || [];
  els.profile.innerHTML = list.map(profile => `<option value="${profile.id}">${profile.label}</option>`).join('');
}

function warningsForLimits(input, limits, profile) {
  const warnings = [];
  if (input.weightKg < limits.minWeight || input.weightKg > limits.maxWeight) {
    warnings.push(`GW fora do envelope da carta (${limits.minWeight}–${limits.maxWeight} kg).`);
  }
  if (input.pressureAltitudeFt < limits.minPa || input.pressureAltitudeFt > limits.maxPa) {
    warnings.push(`PA fora do envelope da carta (${limits.minPa}–${limits.maxPa} ft).`);
  }
  if (input.oatC < limits.minOat || input.oatC > limits.maxOat) {
    warnings.push(`OAT fora do envelope da carta (${limits.minOat}–${limits.maxOat} °C).`);
  }
  if (profile.chartFamily === 'enhanced_offshore' && (input.headwindKt < limits.minHeadwind || input.headwindKt > limits.maxHeadwind)) {
    warnings.push(`Headwind fora do envelope enhanced (${limits.minHeadwind}–${limits.maxHeadwind} kt).`);
  }
  return warnings;
}

function selectStandardChart(weightKg) {
  if (weightKg <= 6400) return LIMITS.offshore_standard_6400;
  if (weightKg <= 6800) return LIMITS.offshore_standard_6800;
  return LIMITS.offshore_standard_6800;
}

function selectEnhancedChart() {
  return LIMITS.enhanced_offshore_7000;
}

function isaAtPaC(paFt) {
  return 15 - (paFt / 1000) * 1.98;
}

function standardMaxOatC(paFt) {
  return isaAtPaC(paFt) + 35;
}

function calculateStandard(input) {
  const chart = selectStandardChart(input.weightKg);
  const warnings = warningsForLimits(input, chart, selectedProfile());

  const pa = clamp(input.pressureAltitudeFt, chart.minPa, chart.maxPa);
  const oat = clamp(input.oatC, chart.minOat, chart.maxOat);
  const weight = clamp(input.weightKg, chart.minWeight, chart.maxWeight);
  const headwind = clamp(Math.max(0, input.headwindKt), 0, 40);

  if (oat > standardMaxOatC(pa) + 0.1) {
    warnings.push(`Acima do limite OAT ISA+35 para PA ${Math.round(pa)} ft.`);
  }

  // First-pass digitized model from the offshore standard nomogram.
  // It preserves the chart axes and corrections: PA -1000..5000 ft, OAT -30..50 °C,
  // GW 5800..6800 kg and the published headwind credit of -1 ft/kt up to 40 kt.
  const paNorm = (pa - chart.minPa) / (chart.maxPa - chart.minPa);
  const oatNorm = (oat - chart.minOat) / (chart.maxOat - chart.minOat);
  const weightNorm = (weight - chart.minWeight) / (6800 - chart.minWeight);

  const severity = clamp(0.52 * paNorm + 0.48 * oatNorm, 0, 1.15);
  const baseDrop = 18 + 58 * weightNorm + 46 * severity + 21 * weightNorm * severity;
  const windCorrection = -headwind;
  const dropBeforeProfile = clamp(baseDrop + windCorrection, 0, chart.maxDrop);

  return {
    chart,
    baseDropFt: baseDrop,
    windCorrectionFt: windCorrection,
    profileCorrectionFt: 0,
    dropFt: dropBeforeProfile,
    warnings,
    details: [
      `OAT limit: ISA+35 ≈ ${Math.round(standardMaxOatC(pa))} °C`,
      `Headwind credit aplicado: ${Math.round(headwind)} ft`
    ]
  };
}

function calculateEnhanced(input) {
  const chart = selectEnhancedChart();
  const warnings = warningsForLimits(input, chart, selectedProfile());

  const pa = clamp(input.pressureAltitudeFt, chart.minPa, chart.maxPa);
  const oat = clamp(input.oatC, chart.minOat, chart.maxOat);
  const weight = clamp(input.weightKg, chart.minWeight, chart.maxWeight);
  const headwind = clamp(input.headwindKt, chart.minHeadwind, chart.maxHeadwind);

  if (oat > standardMaxOatC(pa) + 0.1) {
    warnings.push(`Acima do limite OAT ISA+35 para PA ${Math.round(pa)} ft.`);
  }

  // First-pass digitized model from the enhanced nomogram.
  // This profile has a separate chart family: PA -1000..1000 ft, headwind 10..40 kt,
  // GW 6000..7000 kg and no simple external wind table.
  const paNorm = (pa - chart.minPa) / (chart.maxPa - chart.minPa);
  const oatNorm = (oat - chart.minOat) / (chart.maxOat - chart.minOat);
  const weightNorm = (weight - chart.minWeight) / (chart.maxWeight - chart.minWeight);
  const windNorm = (headwind - chart.minHeadwind) / (chart.maxHeadwind - chart.minHeadwind);

  const severity = clamp(0.55 * oatNorm + 0.45 * paNorm, 0, 1.15);
  const baseDrop = 22 + 37 * weightNorm + 34 * severity + 18 * weightNorm * severity;
  const windBenefit = 30 * windNorm;
  const drop = clamp(baseDrop - windBenefit, 0, chart.maxDrop);

  return {
    chart,
    baseDropFt: baseDrop,
    windCorrectionFt: -windBenefit,
    profileCorrectionFt: 0,
    dropFt: drop,
    warnings,
    details: [
      'Carta enhanced usa vento como eixo do nomograma, não como tabela externa.',
      `Headwind usado no envelope: ${Math.round(headwind)} kt`
    ]
  };
}

function calculateDropdown(input) {
  const profile = selectedProfile();
  const raw = profile.chartFamily === 'enhanced_offshore'
    ? calculateEnhanced(input)
    : calculateStandard(input);

  const finalDrop = clamp(raw.dropFt + profile.profileCorrectionFt, 0, raw.chart.maxDrop + profile.profileCorrectionFt);
  return {
    ...raw,
    profile,
    profileCorrectionFt: profile.profileCorrectionFt,
    finalDropFt: finalDrop,
    ok: raw.warnings.length === 0
  };
}

function collectInputs() {
  return {
    phase: els.phase.value,
    profileId: els.profile.value,
    pressureAltitudeFt: num(els.pa),
    oatC: num(els.oat),
    weightKg: num(els.weight),
    headwindKt: num(els.headwind)
  };
}

function renderMessages(result) {
  const warningHtml = result.warnings.length
    ? `<div class="message warn"><strong>Atenção:</strong><ul>${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>`
    : '<div class="message ok"><strong>Dentro do envelope digitado.</strong></div>';

  const detailHtml = result.details.length
    ? `<div class="message"><strong>Detalhes:</strong><ul>${result.details.map(w => `<li>${w}</li>`).join('')}</ul></div>`
    : '';

  els.messages.innerHTML = warningHtml + detailHtml + '<div class="message muted">Uso para treinamento/familiarização. Conferir resultado crítico no RFM/AFM aprovado.</div>';
}

function renderResult(result) {
  els.heightLossValue.textContent = formatFt(result.finalDropFt);
  els.resultSub.textContent = `${result.profile.label} — ${result.profile.reference}`;
  els.chartFamily.textContent = result.chart.label;
  els.profileCorrection.textContent = result.profileCorrectionFt ? `+${result.profileCorrectionFt} ft` : '0 ft';
  els.windCorrection.textContent = `${Math.round(result.windCorrectionFt)} ft`;
  els.envelopeInfo.textContent = result.ok ? 'OK' : 'Revisar';
  els.statusChip.textContent = result.ok ? 'Calculado' : 'Fora / revisar';
  els.statusChip.className = `status-chip ${result.ok ? 'ok' : 'bad'}`;
  renderMessages(result);
}

function run() {
  const input = collectInputs();
  const result = calculateDropdown(input);
  lastResult = { input, result };
  renderResult(result);
  saveCtx({
    pressureAltitudeFt: input.pressureAltitudeFt,
    oatC: input.oatC,
    weightKg: input.weightKg,
    headwindKt: input.headwindKt,
    dropdownPhase: input.phase,
    dropdownProfileId: input.profileId,
    dropdownHeightLossFt: Math.ceil(result.finalDropFt),
    dropdownChart: result.chart.id
  });
}

function loadContext() {
  const ctx = loadCtx();
  if (ctx.pressureAltitudeFt != null) els.pa.value = ctx.pressureAltitudeFt;
  if (ctx.oatC != null) els.oat.value = ctx.oatC;
  if (ctx.weightKg != null) els.weight.value = ctx.weightKg;
  if (ctx.headwindKt != null) els.headwind.value = ctx.headwindKt;
  if (ctx.dropdownPhase) {
    els.phase.value = ctx.dropdownPhase;
    populateProfiles();
  }
  if (ctx.dropdownProfileId) els.profile.value = ctx.dropdownProfileId;
}

async function copyResult() {
  if (!lastResult) run();
  const { input, result } = lastResult;
  const text = [
    'OEI DROP DOWN / HEIGHT LOSS',
    `Perfil: ${result.profile.label}`,
    `PA: ${input.pressureAltitudeFt} ft`,
    `OAT: ${input.oatC} °C`,
    `GW: ${input.weightKg} kg`,
    `Headwind: ${input.headwindKt} kt`,
    `Resultado: ${Math.ceil(result.finalDropFt)} ft`,
    `Carta: ${result.chart.label}`,
    result.warnings.length ? `Avisos: ${result.warnings.join(' | ')}` : 'Envelope: OK'
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = 'Copiado';
    setTimeout(() => { els.copyBtn.textContent = 'Copiar resultado'; }, 1200);
  } catch {
    window.prompt('Copie o resultado:', text);
  }
}

els.phase.addEventListener('change', () => { populateProfiles(); run(); });
els.profile.addEventListener('change', run);
els.calculateBtn.addEventListener('click', run);
els.copyBtn.addEventListener('click', copyResult);
els.loadContextBtn.addEventListener('click', () => { loadContext(); run(); });
[els.pa, els.oat, els.weight, els.headwind].forEach(el => el.addEventListener('input', () => { if (lastResult) run(); }));

populateProfiles();
loadContext();
run();
