/**
 * Trader-facing copy. Backend keys stay snake_case; React only maps them here.
 * Glossary renders the same strings so the study room cannot drift from the UI.
 */

export const LABELS = Object.freeze({
  setupType: 'Setup type',
  clearsAbove: 'Clears above',
  failsBelow: 'Fails below',
  upsideTo: 'Upside to',
  damageIfLost: 'Damage if lost',
  longEntry: 'Long entry',
  priceTrend: 'Price trend',
  lean: 'Lean',
  grade: 'Grade',
  recipeFit: 'Recipe fit',
  dataQuality: 'Data quality',
  ihsg: 'IHSG',
  vsIhsg: 'Vs IHSG',
  marketVsIhsg: 'Market vs IHSG',
  windowNet: 'Window net',
  leadBroker: 'Lead broker',
  howConcentrated: 'How concentrated',
  watchedBrokersShare: 'Watched brokers’ share',
  rewardRisk: 'Reward / risk',
});

const SETUP_TYPE_LABEL = Object.freeze({
  compression_breakout: 'Tight range, then break',
  trend_pullback: 'Pullback in an uptrend',
  accumulation_repair: 'Repair after selling',
  momentum_continuation: 'Trend continuation',
  range_reversal: 'Reversal from a range',
  distribution_risk: 'Selling pressure',
  unclassified: 'Not classified',
});

const FRAMING_LABEL = Object.freeze({
  long_setup: 'Long setup',
  defensive: 'Risk, not a long',
  already_extended: 'Already extended',
  late_extension: 'Late extension',
  unavailable: 'Unavailable',
});

const RECIPE_FIT_LABEL = Object.freeze({
  high: 'High recipe fit',
  medium: 'Medium recipe fit',
  low: 'Low recipe fit',
});

const LEAN_LABEL = Object.freeze({
  LONG_LEAN: 'Constructive',
  SHORT_LEAN: 'Defensive',
  NEUTRAL: 'Mixed',
});

export function setupTypeLabel(value) {
  const key = String(value || 'unclassified');
  return SETUP_TYPE_LABEL[key] || 'Not classified';
}

export function framingLabel(value) {
  return FRAMING_LABEL[value] || 'Unavailable';
}

export function recipeFitLabel(band) {
  return RECIPE_FIT_LABEL[band] || RECIPE_FIT_LABEL.low;
}

export function leanLabel(stance) {
  return LEAN_LABEL[stance] || 'Mixed';
}

export function priceLevelCaption(framing, { longLabel, defensiveLabel }) {
  return framing === 'defensive' ? defensiveLabel : longLabel;
}

export const GLOSSARY_GROUPS = Object.freeze([
  {
    id: 'prices',
    title: 'Prices on a setup',
    entries: [
      {
        id: 'clears-above',
        title: LABELS.clearsAbove,
        body: 'The setup is in play if the daily close moves through this price. It is not automatically last close, and it is not an order.',
      },
      {
        id: 'fails-below',
        title: LABELS.failsBelow,
        body: 'The setup is wrong if the daily close falls through this price. Older notes may have called this invalidation.',
      },
      {
        id: 'upside-to',
        title: LABELS.upsideTo,
        body: 'Where this geometry is aiming if the setup holds. It is not a price target, a forecast, or a promise.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Stock Analysis',
    entries: [
      {
        id: 'setup-type',
        title: LABELS.setupType,
        body: 'What kind of tape this looks like: tight range then break, pullback, repair, continuation, range reversal, selling pressure, or not classified. It is separate from listing size (lane) and from Grade.',
      },
      {
        id: 'grade',
        title: LABELS.grade,
        body: 'A weighted score of broker flow, momentum, structure, and risk. A ≥ 82%, B ≥ 68%, C ≥ 54%, D ≥ 40%. It is not a win probability.',
      },
      {
        id: 'price-trend',
        title: LABELS.priceTrend,
        body: 'Whether this stock’s moving averages look trending or range-bound. Not the same as IHSG, which is the market index.',
      },
      {
        id: 'lean',
        title: LABELS.lean,
        body: 'Whether the evidence currently leans constructive, defensive, or mixed. Context only — not a buy or sell call.',
      },
      {
        id: 'market-vs-ihsg',
        title: LABELS.marketVsIhsg,
        body: 'IHSG state plus this stock’s return versus IHSG over 20 and 60 sessions. Hidden from the chart with one toggle so candles stay readable.',
      },
    ],
  },
  {
    id: 'screener',
    title: 'Screener',
    entries: [
      {
        id: 'recipe-fit',
        title: LABELS.recipeFit,
        body: 'How well a Custom Screener row matched the chosen recipe. This is not Grade and not data quality.',
      },
      {
        id: 'data-quality',
        title: LABELS.dataQuality,
        body: 'How complete and fresh the sources are. Low data quality is a coverage warning, not a bad trade.',
      },
      {
        id: 'near-miss',
        title: 'Almost qualified',
        body: 'Failed one recipe condition while the rest held. Use it to see why a name was close — not as a ranked buy list.',
      },
    ],
  },
  {
    id: 'broker',
    title: 'Broker Flow',
    entries: [
      {
        id: 'window-net',
        title: LABELS.windowNet,
        body: 'Observed buy value minus sell value in the selected range, from up to the top 25 brokers per stock-day. Not holdings.',
      },
      {
        id: 'lead-broker',
        title: LABELS.leadBroker,
        body: 'The broker with the largest signed net in this window, plus how often they stayed on that side. Example: ZP stayed on the buy (8 of 10 days).',
      },
      {
        id: 'how-concentrated',
        title: LABELS.howConcentrated,
        body: 'Lead net versus the second buyer. Watched brokers’ share is the slice of positive net from AK, BK, CC, and ZP — names you watch, not “the market’s favourite”.',
      },
      {
        id: 'source-class',
        title: 'Foreign / local source',
        body: 'A broker code’s reported source class. It is not the identity or intent of the end investor. It lives in the ranking table, not in the three summary cards.',
      },
    ],
  },
]);
