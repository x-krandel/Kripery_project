// API contract: mirror of backend/app/schemas.py, field for field.
// Change only together with the backend file (one PR for both).

// ===== enums =====
export type UserRole = "collector" | "buyer";
export type ArtworkStatus = "published" | "held"; // held = blocked by the war-loss check
export type ArtworkCategory = "painting" | "works_on_paper" | "sculpture" | "other";
export type PassportEventType =
  | "creation" | "exhibition" | "conservation" | "ownership_change" | "registration";
export type AuctionStatus = "scheduled" | "live" | "ended";
export type LossCheckResult = "clear" | "match";

// ===== responses =====
export interface UserDto {
  id: number;
  name: string;
  role: UserRole;
}

export interface AuctionSummaryDto {
  id: number;
  status: AuctionStatus;
  startPrice: number;
  currentPrice: number; // = startPrice while there are no bids
  bidCount: number;
  startsAt: string;
  endsAt: string;
}

export interface ArtworkSummaryDto {
  id: number;
  title: string;
  artist: string;
  dating: string;
  technique: string;
  category: ArtworkCategory;
  imageUrl: string;
  status: ArtworkStatus;
  ownerId: number;
  verified: boolean; // chainValid && lossCheck.result === "clear"
  auction: AuctionSummaryDto | null; // unfinished auction or null
  lastPrice: number | null; // latest auction's current or final price; null if never auctioned
}

/** GET /api/artworks/{id}/similar: nearest published works by CLIP image vector. */
export interface SimilarArtworkDto extends ArtworkSummaryDto {
  similarity: number; // cosine similarity 0..1
}

export interface LostArtworkMatchDto {
  lostArtworkId: number;
  title: string;
  artist: string;
  sourceUrl: string;
  imageUrl: string;
  similarity: number; // 0..1
}

export interface LossCheckDto {
  result: LossCheckResult;
  checkedAt: string;
  topSimilarity: number;
  matches: LostArtworkMatchDto[]; // top-3, most similar first
}

export interface ArtworkDetailDto extends ArtworkSummaryDto {
  dimensions: string;
  story: string;
  owner: UserDto;
  lossCheck: LossCheckDto;
}

export interface PassportEventDto {
  id: number;
  seq: number;
  type: PassportEventType;
  occurredOn: string;
  title: string;
  description: string;
  createdAt: string;
  prevHash: string;
  hash: string;
  valid: boolean;
}

export interface PassportDto {
  artwork: ArtworkSummaryDto;
  events: PassportEventDto[]; // ascending seq
  chainValid: boolean;
  brokenAtSeq: number | null;
  verifiedAt: string;
}

export interface BidDto {
  id: number;
  auctionId: number;
  user: UserDto;
  amount: number;
  createdAt: string;
}

export interface AuctionDetailDto extends AuctionSummaryDto {
  artworkId: number;
  minStep: number;
  leader: UserDto | null;
  bids: BidDto[]; // last 10, newest first
}

/** A post on the author's profile. Today only invitations to an offline (in-person) auction. */
export interface PostDto {
  id: number;
  kind: "offline_auction";
  author: UserDto;
  artwork: ArtworkSummaryDto | null;
  title: string;
  body: string;
  place: string;
  startsAt: string | null;
  minPrice: number | null;
  createdAt: string;
}

/** POST /api/posts/offline-auction: published as a post at once. */
export interface CreateOfflineAuctionRequest {
  artworkId: number;
  startsAt: string; // ISO, in the future
  place: string;
  minPrice: number;
  body: string;
}

/** GET /api/stats: live numbers for the home page, counted from the database. */
export interface StatsDto {
  artworks: number;
  passportEntries: number;
  collectors: number;
  auctionVolume: number;
  lostIndexed: number;
}

export interface LostArtworkDto {
  id: number;
  title: string;
  artist: string;
  sourceUrl: string;
  imageUrl: string;
}

export interface UploadDto {
  uploadId: string;
  imageUrl: string;
}

export interface AiDescriptionDto {
  title: string;
  artist: string;
  dating: string;
  technique: string;
  category: ArtworkCategory;
  aiFields: Array<"title" | "artist" | "dating" | "technique" | "category">;
  note: string | null;
}

// ===== requests =====
export interface AiDescribeRequest {
  uploadId: string;
}

export interface NewPassportEventRequest {
  type: "creation" | "exhibition" | "conservation";
  occurredOn: string;
  title: string;
  description: string;
}

export interface CreateArtworkRequest {
  uploadId: string;
  title: string;
  artist: string;
  dating: string;
  technique: string;
  category: ArtworkCategory;
  dimensions: string;
  story: string;
  history: NewPassportEventRequest[];
}

export interface CreateAuctionRequest {
  artworkId: number;
  startPrice: number;
  minStep: number;
  durationMinutes: number;
}

export interface PlaceBidRequest {
  amount: number;
}

// ===== auth =====
export interface RegisterRequest {
  username: string; // 3-32 chars: a-z 0-9 . _ -  (lower-cased by the server)
  password: string; // at least 6 chars
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string; // send as "Authorization: Bearer <token>"
  user: UserDto;
}

// ===== WebSocket: server -> client only =====
export type AuctionWsMessage =
  | { type: "snapshot"; auction: AuctionDetailDto }
  | { type: "bid"; bid: BidDto; currentPrice: number; bidCount: number; endsAt: string }
  | { type: "ended"; winner: UserDto | null; finalPrice: number };

export interface ApiError {
  detail: { code: string; message: string };
}
