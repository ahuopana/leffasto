import { useEffect, useState } from "react";
import { POSTER_BASE } from "../services/tmdb";
import type { Movie } from "../domain/types";

const PALETTE = ["#8e5572", "#3d6b8f", "#5f7a3f", "#a8643a", "#5c5c99", "#2f7b78"];

/** Real poster when there is one and it loads, otherwise a stable coloured placeholder. */
export function Poster({ movie, title }: { movie: Movie; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [movie.posterPath]);
  if (movie.posterPath && !failed) {
    const src = movie.posterPath.startsWith("http") ? movie.posterPath : POSTER_BASE + movie.posterPath;
    return <img className="poster" src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />;
  }
  const color = PALETTE[Math.abs(movie.tmdbId) % PALETTE.length];
  return (
    <div className="poster placeholder" style={{ background: color }} aria-label={title}>
      <span>{title}</span>
      {movie.year && <small>{movie.year}</small>}
    </div>
  );
}
