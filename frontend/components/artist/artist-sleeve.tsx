import type { Artist } from "@/types";
export function ArtistSleeve({
  artist,
  large = false,
}: {
  artist: Pick<Artist, "id" | "symbol">;
  large?: boolean;
}) {
  return (
    <div
      className={`artist-sleeve ${large ? "sleeve-large" : ""}`}
      data-tone={Number(artist.id) % 3}
      aria-hidden="true"
    >
      <div className="sleeve-record">
        <span>{artist.symbol}</span>
      </div>
      <span className="sleeve-corner">A / {artist.symbol}</span>
    </div>
  );
}
