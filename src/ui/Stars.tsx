import { useI18n } from "../i18n";

/** 5 stars with half-star precision; value is 1-10 (or undefined). */
export function Stars({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const { t } = useI18n();
  return (
    <div className="stars-row">
      <div className="stars" role="radiogroup" aria-label={t("detail.rating")}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(2, (value ?? 0) - (star - 1) * 2));
          return (
            <span key={star} className="star" data-fill={fill}>
              <span className="star-bg">★</span>
              <span className="star-fg" style={{ width: `${fill * 50}%` }}>★</span>
              <button
                className="half left" aria-label={`${star - 0.5}`}
                onClick={() => onChange((star - 1) * 2 + 1)}
              />
              <button className="half right" aria-label={`${star}`} onClick={() => onChange(star * 2)} />
            </span>
          );
        })}
      </div>
      {value !== undefined && (
        <>
          <span className="rating-number">{(value / 2).toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
          <button className="link" onClick={() => onChange(undefined)}>{t("detail.clearRating")}</button>
        </>
      )}
    </div>
  );
}
