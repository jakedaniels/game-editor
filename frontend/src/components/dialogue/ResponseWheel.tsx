import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DialogueSummary } from '../../api/client';

interface ResponseWheelProps {
  responses: DialogueSummary[];
  onSelect: (id: number) => void;
}

const VISIBLE = 3; // show at most this many before turning into a scrollable carousel
const MIN_SCALE = 0.68; // how small a card gets once it's off to the side
const MIN_OPACITY = 0.45;

/**
 * The current dialogue's children. With <= 3 responses they sit in a simple row. With more,
 * it becomes a coverflow carousel: three at a time, left/right arrows, smooth scrolling, and
 * each card shrinks/dims as it moves away from the center.
 */
export function ResponseWheel({ responses, onSelect }: ResponseWheelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // Static card centers (relative to the track) + the live viewport center, in content coords.
  const [centers, setCenters] = useState<number[]>([]);
  const [viewportCenter, setViewportCenter] = useState(0);

  const carousel = responses.length > VISIBLE;

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll<HTMLElement>('.response-card'));
    setCenters(cards.map((c) => c.offsetLeft + c.offsetWidth / 2));
    setViewportCenter(track.scrollLeft + track.clientWidth / 2);
  }, []);

  // Re-measure (and reset to the start) whenever the set of responses changes.
  useLayoutEffect(() => {
    if (!carousel) return;
    if (trackRef.current) trackRef.current.scrollLeft = 0;
    measure();
  }, [carousel, responses, measure]);

  // Keep measurements correct on resize.
  useEffect(() => {
    const track = trackRef.current;
    if (!carousel || !track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [carousel, measure]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() =>
      setViewportCenter(track.scrollLeft + track.clientWidth / 2),
    );
  };

  const styleFor = (i: number): React.CSSProperties | undefined => {
    if (!carousel) return undefined;
    const c = centers[i];
    const track = trackRef.current;
    if (c == null || !track) return undefined;
    const half = track.clientWidth / 2 || 1;
    const t = Math.min(Math.abs(c - viewportCenter) / half, 1); // 0 at center → 1 at the edge
    const scale = MIN_SCALE + (1 - MIN_SCALE) * (1 - t);
    const opacity = MIN_OPACITY + (1 - MIN_OPACITY) * (1 - t);
    return { transform: `scale(${scale})`, opacity };
  };

  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track || centers.length < 2) return;
    const stride = centers[1] - centers[0]; // one card + gap
    track.scrollBy({ left: dir * stride, behavior: 'smooth' });
  };

  if (responses.length === 0) {
    return (
      <div className="response-wheel">
        <div className="response-wheel__label">Responses</div>
        <p className="response-wheel__empty">No responses — this is a leaf dialogue.</p>
      </div>
    );
  }

  const cards = responses.map((r, i) => (
    <button
      key={r.id}
      type="button"
      className="response-card"
      style={styleFor(i)}
      onClick={() => onSelect(r.id)}
    >
      <span className="response-card__avatar" aria-hidden>
        {r.character?.image_url ? (
          <img className="response-card__avatar-img" src={r.character.image_url} alt="" />
        ) : (
          (r.character?.name?.[0] ?? '?').toUpperCase()
        )}
      </span>
      <span className="response-card__speaker">{r.character?.name ?? 'Unknown'}</span>
      <span className="response-card__text">{r.text || '(no text)'}</span>
    </button>
  ));

  return (
    <div className="response-wheel">
      <div className="response-wheel__label">Responses</div>

      {carousel ? (
        <div className="response-wheel__viewport-wrap">
          <button
            type="button"
            className="wheel-arrow wheel-arrow--left"
            onClick={() => step(-1)}
            aria-label="Scroll responses left"
          >
            ‹
          </button>
          <div
            ref={trackRef}
            className="response-wheel__track response-wheel__track--carousel"
            onScroll={handleScroll}
          >
            {cards}
          </div>
          <button
            type="button"
            className="wheel-arrow wheel-arrow--right"
            onClick={() => step(1)}
            aria-label="Scroll responses right"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="response-wheel__track">{cards}</div>
      )}
    </div>
  );
}
