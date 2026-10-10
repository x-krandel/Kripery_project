// One function per endpoint of the contract. Screens import `api` and never call fetch directly.

import { request, USE_MOCKS, wsUrl } from "./client";
import { createMockApi } from "./mocks";
import type {
  AiDescribeRequest, AiDescriptionDto, AuthResponse, LoginRequest, RegisterRequest, ArtworkDetailDto, ArtworkSummaryDto, AuctionDetailDto, AuctionWsMessage,
  BidDto, CreateArtworkRequest, CreateAuctionRequest, LostArtworkDto, NewPassportEventRequest, PassportDto,
  PassportEventDto, PlaceBidRequest, UploadDto, UserDto,
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
  addEvent(id: number, req: NewPassportEventRequest): Promise<PassportEventDto>;
  createAuction(req: CreateAuctionRequest): Promise<AuctionDetailDto>;
  getAuction(id: number): Promise<AuctionDetailDto>;
  placeBid(id: number, req: PlaceBidRequest): Promise<BidDto>;
  listLost(limit?: number): Promise<LostArtworkDto[]>;
  /** Opens the auction stream; returns a function that closes it. `onClose` fires on unexpected disconnect. */
  subscribeAuction(id: number, onMessage: AuctionListener, onClose?: () => void): () => void;
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
  getPassport: (id) => request("GET", `/artworks/${id}/passport`),
  addEvent: (id, req) => request("POST", `/artworks/${id}/events`, req),
  createAuction: (req) => request("POST", "/auctions", req),
  getAuction: (id) => request("GET", `/auctions/${id}`),
  placeBid: (id, req) => request("POST", `/auctions/${id}/bids`, req),
  listLost: (limit = 50) => request("GET", `/lost?limit=${limit}`),

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
    ws.onclose = () => {
      if (!closedByUs) onClose?.();
    };
    return () => {
      closedByUs = true;
      ws.close();
    };
  },
};

export const api: Api = USE_MOCKS ? createMockApi() : realApi;
