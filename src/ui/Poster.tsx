import { POSTER_BASE } from "../services/tmdb";
import type { Movie } from "../domain/types";

const PALETTE = ["#8e5572", "#3d6b8f", "#5f7a3f", "#a8643a", "#5c5c99", "#2f7b78"];

/** Real poster when TMDB gave one, otherwise a stable coloured placeholder. */
export function Poster({ movie, title }: { movie: Movie; title: string }) {
  if (movie.posterPath) return <img className="poster" src={POSTER_BASE + movie.posterPath} alt={title} loading="lazy" />;
  const color = PALETTE[movie.tmdbId % PALETTE.length];
  return (
    <div className="poster placeholder" style={{ background: color }} aria-label={title}>
      <span>{title}</span>
      {movie.year && <small>{movie.year}</small>}
    </div>
  );
}
