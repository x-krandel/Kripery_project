// One function per endpoint of the contract. Screens import `api` and never call fetch directly.

import { request, USE_MOCKS, wsUrl } from "./client";
import { createMockApi } from "./mocks";
import type {
  AiDescribeRequest, AiDescriptionDto, AuthResponse, LoginRequest, RegisterRequest, ArtworkDetailDto, ArtworkSummaryDto, AuctionDetailDto, AuctionWsMessage,
  BidDto, ChatMessageDto, CreateArtworkRequest, CreateAuctionRequest, CreateOfflineAuctionRequest, PostDto, LostArtworkDto, NewPassportEventRequest, PassportDto,
  PassportEventDto, PlaceBidRequest, SimilarArtworkDto, StatsDto, UploadDto, UserDto,
} from "./types";

export type AuctionListener = (msg: AuctionWsMessage) => void;

export interface Api {
  register(req: RegisterRequest): Promise<AuthResponse>;
  login(req: LoginRequest): Promise<AuthResponse>;
  me(): Promise<UserDto>;
  logout(): Promise<void>;
  listUsers(): Promise<UserDto[]>;
  upload(file: File): Promise<UploadDto>;
  describe(req: AiDescribeRequest): Promise<AiDescriptionDto>;
  listArtworks(ownerId?: number): Promise<ArtworkSummaryDto[]>;
  createArtwork(req: CreateArtworkRequest): Promise<ArtworkDetailDto>;
  getArtwork(id: number): Promise<ArtworkDetailDto>;
  getPassport(id: number): Promise<PassportDto>;
  similarArtworks(id: number, limit?: number): Promise<SimilarArtworkDto[]>;
  addEvent(id: number, req: NewPassportEventRequest): Promise<PassportEventDto>;
  createAuction(req: CreateAuctionRequest): Promise<AuctionDetailDto>;
  getAuction(id: number): Promise<AuctionDetailDto>;
  placeBid(id: number, req: PlaceBidRequest): Promise<BidDto>;
  postChatMessage(auctionId: number, text: string): Promise<ChatMessageDto>;
  listLost(limit?: number): Promise<LostArtworkDto[]>;
  stats(): Promise<StatsDto>;
  listPosts(filter: { authorId?: number; artworkId?: number }): Promise<PostDto[]>;
  createOfflineAuction(req: CreateOfflineAuctionRequest): Promise<PostDto>;
  deletePost(id: number): Promise<void>;
  /** Opens the auction stream; returns a function that closes it. `onClose` fires on unexpected
   *  disconnect with the close code (4404: no such auction). */
  subscribeAuction(id: number, onMessage: AuctionListener, onClose?: (code: number) => void): () => void;
}

const realApi: Api = {
  register: (req) => request("POST", "/auth/register", req),
  login: (req) => request("POST", "/auth/login", req),
  me: () => request("GET", "/auth/me"),
  logout: () => request<void>("POST", "/auth/logout"),
  listUsers: () => request("GET", "/users"),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("POST", "/uploads", form);
  },
  describe: (req) => request("POST", "/ai/describe", req),
  listArtworks: (ownerId) => request("GET", ownerId == null ? "/artworks" : `/artworks?ownerId=${ownerId}`),
  createArtwork: (req) => request("POST", "/artworks", req),
  getArtwork: (id) => request("GET", `/artworks/${id}`),
  similarArtworks: (id, limit = 4) => request("GET", `/artworks/${id}/similar?limit=${limit}`),
  getPassport: (id) => request("GET", `/artworks/${id}/passport`),
  addEvent: (id, req) => request("POST", `/artworks/${id}/events`, req),
  createAuction: (req) => request("POST", "/auctions", req),
  getAuction: (id) => request("GET", `/auctions/${id}`),
  placeBid: (id, req) => request("POST", `/auctions/${id}/bids`, req),
  postChatMessage: (auctionId, text) => request("POST", `/auctions/${auctionId}/messages`, { text }),
  listLost: (limit = 50) => request("GET", `/lost?limit=${limit}`),
  stats: () => request("GET", "/stats"),
  listPosts: ({ authorId, artworkId }) => {
    const q = new URLSearchParams();
    if (authorId != null) q.set("authorId", String(authorId));
    if (artworkId != null) q.set("artworkId", String(artworkId));
    return request("GET", `/posts?${q}`);
  },
  createOfflineAuction: (req) => request("POST", "/posts/offline-auction", req),
  deletePost: (id) => request<void>("DELETE", `/posts/${id}`),

  subscribeAuction(id, onMessage, onClose) {
    const ws = new WebSocket(wsUrl(`/ws/auctions/${id}`));
    let closedByUs = false;
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data as string) as AuctionWsMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (ev) => {
      if (!closedByUs) onClose?.(ev.code);
    };
    return () => {
      closedByUs = true;
      ws.close();
    };
  },
};

export const api: Api = USE_MOCKS ? createMockApi() : realApi;
