import { ratingText } from '../lib/api';

/** Five stars clipped to the rating, the same way the server-rendered store draws them. */
export default function Stars({ rating, reviews }: { rating: number; reviews?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
      <span className="relative inline-block h-[13px] w-[74px] leading-[13px] tracking-[2px]">
        <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-[#d8d3ca]">★★★★★</span>
        <span
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-gold"
          style={{ width: `${(rating * 100) / 50}%` }}
        >
          ★★★★★
        </span>
      </span>
      <span>
        {ratingText(rating)}
        {reviews === undefined ? '' : ` (${reviews})`}
      </span>
    </span>
  );
}
