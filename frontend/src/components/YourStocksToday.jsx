import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { tr } from '../utils/uiStrings';
import { contextLine, formatMovePercent, shortName } from '../utils/insightCopy';

/**
 * "Your stocks today": one row per watched stock with its move and a plain fact line.
 * Facts about the latest session only. No direction, no target, no advice.
 */
export default function YourStocksToday({ items, language, onOpen }) {
  if (!items.length) return <p className="yst-empty">{tr('Nothing to show yet. Add a stock to see how it did today.', language)}</p>;
  return (
    <ul className="yst-list">
      {items.map((item) => {
        const up = item.changePercent >= 0;
        return (
          <li key={item.symbol}>
            <button type="button" className="yst-row" onClick={() => onOpen({ symbol: item.symbol, name: shortName(item.symbol) })}>
              <span className="yst-main">
                <span className="yst-name">{shortName(item.symbol)}</span>
                <span className="yst-context">{contextLine(item, language)}</span>
              </span>
              <span className={`stock-delta-pill ${up ? 'positive' : 'negative'}`}>
                {up ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}
                <span>{formatMovePercent(item.changePercent)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
