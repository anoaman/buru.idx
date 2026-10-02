import { useEffect, useRef, useState } from 'react';

/**
 * The screener is a fixed set of slots, not a condition library. Every slot maps
 * to at most one backend condition, so there is nothing to add, nothing hidden,
 * and no either/or checkbox that silently unticks another. Presets are just a
 * way of filling the slots; once you touch one, it is your own screen.
 */
export const PRESETS = [
  { id: 'quiet_accumulation', label: 'Quiet accumulation', hint: 'Near support + broker accumulating' },
  { id: 'dominant_broker', label: 'Dominant broker', hint: 'Broker accumulating, any setup' },
  { id: 'support_compression', label: 'Support compression', hint: 'Tight base, no broker filter' },
];

const BLANK_SLOTS = Object.freeze({
  minPrice: '', maxPrice: '', minValue: 0, board: 'all', setup: 'any',
  broker: 'off', brokerCode: '', minBrokerAccumulation: 1_000_000_000, volume: '', beatsIhsg: false,
});

// Same filters as the backend's Quiet Accumulation template, so the page can run
// before the template catalog has loaded.
export const DEFAULT_SLOTS = Object.freeze({
  ...BLANK_SLOTS, maxPrice: 1000, minValue: 500_000_000, setup: 'near_support', broker: 'any',
  brokerPreset: '7d', brokerFrom: '', asOf: '',
});

const SETUPS = [
  { value: 'any', label: 'Any', hint: 'No price setup required' },
  { value: 'near_support', label: 'Near support', hint: 'Within 6% above repeatedly tested support' },
  { value: 'tight_base', label: 'Tight base', hint: 'Consolidating in a range no wider than 12%' },
  { value: 'breakout_above_base', label: 'Breakout', hint: 'Closed above the previous 20-day high' },
];
const SETUP_IDS = new Set(SETUPS.map((item) => item.value).filter((value) => value !== 'any'));
const BOARDS = [
  { value: 'all', label: 'All' },
  { value: 'exclude_fca', label: 'Exclude FCA' },
  { value: 'fca_only', label: 'FCA only' },
];
const LIQUIDITY = [0, 100_000_000, 500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000, 10_000_000_000];
const NET_BUY = [500_000_000, 1_000_000_000, 2_500_000_000, 5_000_000_000, 10_000_000_000];
const VOLUME = [
  { value: '', label: 'Off' },
  { value: 'MA5', label: 'vs 5-day average' },
  { value: 'MA10', label: 'vs 10-day average' },
  { value: 'MA20', label: 'vs 20-day average' },
];
export const BROKER_PERIODS = [
  ['latest', 'Latest session', '1D'], ['previous', 'Previous session', 'Prev'], ['this_week', 'This week', 'This wk'],
  ['last_week', 'Last week', 'Last wk'], ['7d', 'Last 7 days', '7D'], ['14d', 'Last 14 days', '14D'],
  ['1m', 'Last month', '1M'], ['custom', 'Custom start date', 'Custom'],
];

export function rupiah(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Math.abs(number) >= 1e12) return `${Number((number / 1e12).toFixed(2))}T`;
  if (Math.abs(number) >= 1e9) return `${Number((number / 1e9).toFixed(2))}B`;
  if (Math.abs(number) >= 1e6) return `${Number((number / 1e6).toFixed(2))}M`;
  return number.toLocaleString('en-US');
}

function slotsFromTemplate(conditions = []) {
  const slots = { ...BLANK_SLOTS };
  for (const { id, value } of conditions) {
    if (id === 'min_price') slots.minPrice = value;
    else if (id === 'max_price') slots.maxPrice = value;
    else if (id === 'min_average_value') slots.minValue = value;
    else if (id === 'exclude_fca' || id === 'fca_only') slots.board = id;
    else if (SETUP_IDS.has(id)) slots.setup = id;
    else if (id === 'broker_accumulation') slots.broker = 'any';
    else if (id === 'volume_breakout_baseline') slots.volume = value;
    else if (id === 'outperforming_ihsg') slots.beatsIhsg = true;
  }
  return slots;
}

export function applyPreset(slots, templates, presetId) {
  return { ...slots, ...slotsFromTemplate(templates[presetId]) };
}

export function matchingPreset(slots, templates) {
  return PRESETS.find(({ id }) => templates[id]
    && Object.entries(slotsFromTemplate(templates[id])).every(([key, value]) => slots[key] === value))?.id || '';
}

export function conditionsFromSlots(slots) {
  const conditions = [];
  if (slots.minPrice !== '') conditions.push({ id: 'min_price', value: Number(slots.minPrice) });
  if (slots.maxPrice !== '') conditions.push({ id: 'max_price', value: Number(slots.maxPrice) });
  if (slots.minValue > 0) conditions.push({ id: 'min_average_value', value: slots.minValue });
  if (slots.board !== 'all') conditions.push({ id: slots.board, value: true });
  if (slots.setup !== 'any') conditions.push({ id: slots.setup, value: true });
  if (slots.broker !== 'off') conditions.push({ id: 'broker_accumulation', value: true });
  if (slots.volume) conditions.push({ id: 'volume_breakout_baseline', value: slots.volume });
  if (slots.beatsIhsg) conditions.push({ id: 'outperforming_ihsg', value: true });
  return conditions;
}

/** Why the current slots cannot be screened yet, or null when they can. */
export function blockingReason(slots) {
  if (conditionsFromSlots(slots).length === 0) return 'Turn on at least one filter.';
  if (slots.broker !== 'off' && slots.brokerPreset === 'custom' && !slots.brokerFrom) return 'Pick a start date for the custom broker period.';
  return null;
}

export function requestFromSlots(slots) {
  const conditions = conditionsFromSlots(slots);
  const ids = new Set(conditions.map((item) => item.id));
  const request = {
    conditions,
    useBroker: ids.has('broker_accumulation'),
    useSupport: ids.has('near_support'),
    useSideways: ids.has('tight_base') || ids.has('breakout_above_base'),
    brokerPreset: slots.brokerPreset,
    minBrokerAccumulation: slots.minBrokerAccumulation,
    limit: 100,
  };
  if (slots.broker === 'code' && slots.brokerCode.length === 2) request.brokerCode = slots.brokerCode;
  if (slots.brokerPreset === 'custom' && slots.brokerFrom) request.brokerFrom = slots.brokerFrom;
  if (slots.asOf) request.asOf = slots.asOf;
  return request;
}

// Saved screens live in this browser. They keep every slot except the analysis
// date, so a screen saved last week still runs on the latest data.
const SAVED_KEY = 'nalar.screener.savedScreens';
const SAVED_FIELDS = Object.keys(DEFAULT_SLOTS).filter((key) => key !== 'asOf');

function loadSavedScreens() {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item?.name && item.slots && typeof item.slots === 'object') : [];
  } catch {
    return [];
  }
}

export function useSavedScreens() {
  const [saved, setSaved] = useState(loadSavedScreens);
  const persist = (next) => {
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* storage full or blocked: keep in memory */ }
  };
  return {
    saved,
    save: (name, slots) => persist([
      ...saved.filter((item) => item.name !== name),
      { name, slots: Object.fromEntries(SAVED_FIELDS.map((key) => [key, slots[key]])) },
    ]),
    remove: (name) => persist(saved.filter((item) => item.name !== name)),
  };
}

export function matchingSavedScreen(slots, saved) {
  return saved.find((item) => SAVED_FIELDS.every((key) => item.slots[key] === slots[key]))?.name || '';
}

function SaveScreenForm({ onSave }) {
  const [name, setName] = useState('');
  return (
    <form className="sf-save" onSubmit={(event) => { event.preventDefault(); if (name.trim()) { onSave(name.trim()); setName(''); } }}>
      <input type="text" aria-label="Screen name" placeholder="Name this screen" maxLength="40" value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit" className="ui-btn ui-btn--primary" disabled={!name.trim()}>Save</button>
    </form>
  );
}

function OptionList({ options, value, onSelect }) {
  return (
    <div className="sf-options">
      {options.map((option) => (
        <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onSelect(option.value)}>
          <strong>{option.label}</strong>
          {option.hint && <small>{option.hint}</small>}
        </button>
      ))}
    </div>
  );
}

// Applies as you type; the screen's own short debounce batches the keystrokes,
// so there is no Enter or blur step.
function PriceInput({ label, value, onCommit }) {
  const format = (next) => (next === '' ? '' : Number(next).toLocaleString('en-US'));
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value]);
  const change = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '');
    const parsed = digits === '' ? '' : Math.min(10_000, Math.max(1, Number(digits)));
    setDraft(format(parsed));
    onCommit(parsed);
  };
  return (
    <label>{label}
      <input type="text" inputMode="numeric" placeholder="No limit" value={draft} onChange={(event) => change(event.target.value)} />
    </label>
  );
}

function Chip({ id, label, value, openId, setOpenId, active = true, children }) {
  const open = openId === id;
  return (
    <div className="sf-chip-wrap">
      <button
        type="button" className={`sf-chip${active ? '' : ' is-off'}`} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => setOpenId(open ? null : id)}
      >
        <span>{label}</span> <strong>{value}</strong> <i aria-hidden="true">▾</i>
      </button>
      {open && <div className="sf-pop" role="dialog" aria-label={label}>{children}</div>}
    </div>
  );
}

function priceLabel({ minPrice, maxPrice }) {
  const fmt = (value) => Number(value).toLocaleString('en-US');
  if (minPrice !== '' && maxPrice !== '') return `${fmt(minPrice)} – ${fmt(maxPrice)}`;
  if (maxPrice !== '') return `≤ ${fmt(maxPrice)}`;
  if (minPrice !== '') return `≥ ${fmt(minPrice)}`;
  return 'Any';
}

function brokerLabel(slots) {
  if (slots.broker === 'off') return 'Off';
  const who = slots.broker === 'code' ? (slots.brokerCode || '—') : 'Any';
  const period = BROKER_PERIODS.find(([value]) => value === slots.brokerPreset)?.[2] || slots.brokerPreset;
  return `${who} · ≥ ${rupiah(slots.minBrokerAccumulation)} · ${period}`;
}

export default function ScreenerFilters({ slots, onChange, templates, templatesReady }) {
  const [openId, setOpenId] = useState(null);
  const barRef = useRef(null);
  useEffect(() => {
    if (!openId) return undefined;
    const close = (event) => { if (!barRef.current?.contains(event.target)) setOpenId(null); };
    const escape = (event) => { if (event.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [openId]);
  const set = (patch, keepOpen = false) => {
    onChange({ ...slots, ...patch });
    if (!keepOpen) setOpenId(null);
  };
  const preset = matchingPreset(slots, templates);
  const { saved, save, remove } = useSavedScreens();
  const savedName = matchingSavedScreen(slots, saved);
  const chip = { openId, setOpenId };

  return (
    <div className="sf-bar" ref={barRef} aria-label="Screener filters">
      <Chip id="preset" label="Preset" value={savedName || PRESETS.find((item) => item.id === preset)?.label || 'Custom'} {...chip}>
        {templatesReady
          ? <OptionList options={PRESETS.map((item) => ({ value: item.id, label: item.label, hint: item.hint }))} value={savedName ? '' : preset} onSelect={(id) => set(applyPreset(slots, templates, id))} />
          : <p className="sf-note">Presets are unavailable right now.</p>}
        <p className="sf-heading">My screens</p>
        {saved.length === 0 && <p className="sf-note">Nothing saved yet. Set the filters, then name and save them here.</p>}
        <div className="sf-options">
          {saved.map((item) => (
            <div key={item.name} className="sf-saved">
              <button type="button" aria-pressed={item.name === savedName} onClick={() => set({ ...item.slots })}><strong>{item.name}</strong></button>
              <button type="button" className="sf-remove" aria-label={`Delete ${item.name}`} onClick={() => remove(item.name)}>×</button>
            </div>
          ))}
        </div>
        {!savedName && <SaveScreenForm onSave={(name) => { save(name, slots); setOpenId(null); }} />}
      </Chip>
      <span className="sf-sep" aria-hidden="true" />
      <Chip id="price" label="Price" value={priceLabel(slots)} active={slots.minPrice !== '' || slots.maxPrice !== ''} {...chip}>
        <div className="sf-fields">
          <PriceInput label="Min price" value={slots.minPrice} onCommit={(minPrice) => set({ minPrice }, true)} />
          <PriceInput label="Max price" value={slots.maxPrice} onCommit={(maxPrice) => set({ maxPrice }, true)} />
        </div>
      </Chip>
      <Chip id="liquidity" label="Liquidity" value={slots.minValue ? `≥ ${rupiah(slots.minValue)}` : 'Any'} active={slots.minValue > 0} {...chip}>
        <p className="sf-note">Average value traded per day</p>
        <OptionList options={LIQUIDITY.map((value) => ({ value, label: value ? `≥ ${rupiah(value)}` : 'Any' }))} value={slots.minValue} onSelect={(minValue) => set({ minValue })} />
      </Chip>
      <Chip id="board" label="Board" value={BOARDS.find((item) => item.value === slots.board).label} active={slots.board !== 'all'} {...chip}>
        <OptionList options={BOARDS} value={slots.board} onSelect={(board) => set({ board })} />
      </Chip>
      <span className="sf-sep" aria-hidden="true" />
      <Chip id="setup" label="Setup" value={SETUPS.find((item) => item.value === slots.setup).label} active={slots.setup !== 'any'} {...chip}>
        <OptionList options={SETUPS} value={slots.setup} onSelect={(setup) => set({ setup })} />
      </Chip>
      <Chip id="broker" label="Broker" value={brokerLabel(slots)} active={slots.broker !== 'off'} {...chip}>
        <div className="sf-fields">
          <label>Who
            <select value={slots.broker} onChange={(event) => set({ broker: event.target.value }, true)}>
              <option value="off">Off</option>
              <option value="any">Any broker (dominant buyer)</option>
              <option value="code">Specific broker</option>
            </select>
          </label>
          {slots.broker === 'code' && (
            <label>Broker code
              <input
                type="text" maxLength="2" placeholder="CC, AK…" value={slots.brokerCode}
                onChange={(event) => set({ brokerCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) }, true)}
              />
            </label>
          )}
          {slots.broker !== 'off' && <>
            <label>Net buy at least
              <select value={slots.minBrokerAccumulation} onChange={(event) => set({ minBrokerAccumulation: Number(event.target.value) }, true)}>
                {NET_BUY.map((value) => <option key={value} value={value}>{rupiah(value)}</option>)}
              </select>
            </label>
            <label>Over
              <select value={slots.brokerPreset} onChange={(event) => set({ brokerPreset: event.target.value }, true)}>
                {BROKER_PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {slots.brokerPreset === 'custom' && (
              <label>Starting
                <input type="date" max={slots.asOf || undefined} value={slots.brokerFrom} onChange={(event) => set({ brokerFrom: event.target.value }, true)} />
              </label>
            )}
          </>}
        </div>
      </Chip>
      <Chip id="volume" label="Volume" value={slots.volume ? `≥ 1.5× ${slots.volume}` : 'Off'} active={Boolean(slots.volume)} {...chip}>
        <p className="sf-note">Latest volume at least 1.5× its average</p>
        <OptionList options={VOLUME} value={slots.volume} onSelect={(volume) => set({ volume })} />
      </Chip>
      <button type="button" className={`sf-chip${slots.beatsIhsg ? '' : ' is-off'}`} aria-pressed={slots.beatsIhsg} onClick={() => set({ beatsIhsg: !slots.beatsIhsg })}>
        <strong>Beats IHSG</strong>
      </button>
      <span className="sf-grow" aria-hidden="true" />
      <Chip id="asof" label="As of" value={slots.asOf || 'Latest'} {...chip}>
        <div className="sf-fields">
          <label>Analysis date
            <input type="date" value={slots.asOf} onChange={(event) => set({ asOf: event.target.value }, true)} />
          </label>
          {slots.asOf && <button type="button" className="sf-link" onClick={() => set({ asOf: '' })}>Use latest data</button>}
        </div>
      </Chip>
    </div>
  );
}
