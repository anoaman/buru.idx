/**
 * The opening read on Home: a few plain sentences built only from the numbers
 * on the page. It describes what happened (index vs breadth, where foreign
 * money went, limit hits, sector leadership). It never says what to do.
 */
export function idr(value) {
  const number = Math.abs(Number(value));
  if (!Number.isFinite(number)) return '';
  if (number >= 1e12) return `Rp${Number((number / 1e12).toFixed(2))}T`;
  if (number >= 1e9) return `Rp${Number((number / 1e9).toFixed(1))}B`;
  if (number >= 1e6) return `Rp${Number((number / 1e6).toFixed(0))}M`;
  return `Rp${number.toLocaleString('en-US')}`;
}

export function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return '';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function breadthSentence(ihsg, breadth) {
  if (!ihsg || !breadth?.available) return null;
  const { advanced: up, declined: down } = breadth;
  const move = ihsg.changePct > 0 ? 'rose' : ihsg.changePct < 0 ? 'fell' : 'was flat';
  const head = `IHSG ${move} ${pct(ihsg.changePct)} to ${ihsg.close.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (ihsg.changePct > 0 && down > up * 1.3) return `${head}, but the move was narrow: ${down} stocks fell against ${up} that rose.`;
  if (ihsg.changePct < 0 && up > down * 1.3) return `${head}, but most stocks held up: ${up} rose against ${down} that fell.`;
  if (ihsg.changePct === 0) return `${head}, with ${up} stocks up and ${down} down.`;
  return `${head}, and breadth agreed: ${up} up, ${down} down.`;
}

// marketNet is the exchange's own market-wide figure when available; the
// per-stock sum can differ by rounding and unclassified rows.
function foreignSentence(foreign, marketNet) {
  const net = Number.isFinite(marketNet) ? marketNet : foreign?.net;
  if (!foreign || !Number.isFinite(net) || net === 0) return null;
  const buying = net > 0;
  const side = buying ? foreign.inflow : foreign.outflow;
  const top = side?.[0];
  const head = `Foreigners were net ${buying ? 'buyers' : 'sellers'} of ${idr(net)}`;
  if (!top) return `${head}.`;
  if (Math.abs(top.net) > Math.abs(net)) {
    return `${head}, and ${top.code} alone took ${idr(top.net)}, more than the whole market's net.`;
  }
  const share = buying ? foreign.topInflowSharePct : foreign.topOutflowSharePct;
  return `${head}, led by ${top.code} (${idr(top.net)})${Number.isFinite(share) ? `; the top five names were ${Math.round(share)}% of all net ${buying ? 'buying' : 'selling'}` : ''}.`;
}

function limitsAndSectorsSentence(limits, trends) {
  const parts = [];
  if (limits && (limits.araCount || limits.arbCount)) {
    parts.push(`${limits.araCount} stock${limits.araCount === 1 ? '' : 's'} closed at ARA and ${limits.arbCount} at ARB`);
  }
  const ranked = (trends?.sectors || []).filter((item) => Number.isFinite(item.vsIhsg?.d5))
    .sort((a, b) => b.vsIhsg.d5 - a.vsIhsg.d5);
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked.at(-1);
    parts.push(`over five sessions ${best.name} led IHSG by ${best.vsIhsg.d5.toFixed(1)} pts while ${worst.name} trailed by ${Math.abs(worst.vsIhsg.d5).toFixed(1)}`);
  }
  if (!parts.length) return null;
  const text = parts.join('; ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

export function composeMarketRead(data) {
  if (!data) return [];
  const home = data.home || {};
  return [
    breadthSentence(data.ihsg, data.breadth),
    foreignSentence(home.foreign, data.foreignFlow?.net),
    limitsAndSectorsSentence(home.limits, home.trends),
  ].filter(Boolean);
}
