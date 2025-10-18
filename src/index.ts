import EventEmitter from "node:events";
import zlib from "node:zlib";
import WebSocket from "ws";

export interface ATSippyEvents {
  connected: () => void;
  ping: () => void;
  cursor: (cursor: number) => void;
  commit: (event: CommitEvent) => void;
  create: (event: CommitCreateEvent) => void;
  update: (event: CommitUpdateEvent) => void;
  delete: (event: CommitDeleteEvent) => void;
  account: (event: AccountEvent) => void;
  identity: (event: IdentityEvent) => void;
  error: (error: Error) => void;
  disconnected: () => void;
  reconnecting: () => void;
}

export declare interface ATSippy {
  on<U extends keyof ATSippyEvents>(event: U, listener: ATSippyEvents[U]): this;

  emit<U extends keyof ATSippyEvents>(
    event: U,
    ...args: Parameters<ATSippyEvents[U]>
  ): boolean;
}

export class ATSippy extends EventEmitter {
  cursor?: number;
  endpoint: string = "wss://jetstream1.us-west.bsky.network/subscribe";
  reconnect: boolean = true;
  reconnectDelay: number = 3;
  useCompression: boolean = true;
  wantedCollections: string[] = [];
  wantedDIDs: string[] = [];

  private ws?: WebSocket;
  private dictionary?: DataView;

  constructor() {
    super();
  }

  async connect() {
    try {
      this.dictionary = new DataView(
        await (
          await fetch(
            "https://raw.githubusercontent.com/bluesky-social/jetstream/refs/heads/main/pkg/models/zstd_dictionary",
          )
        ).arrayBuffer(),
      );
    } catch (error) {
      console.error(error);
    }

    const url = new URL(this.endpoint);
    url.searchParams.append("requireHello", "true");
    if (this.cursor !== undefined) {
      url.searchParams.append("cursor", this.cursor?.toString());
    }
    url.searchParams.append(
      "compress",
      this.useCompression === true && this.dictionary !== undefined
        ? "true"
        : "false",
    );
    this.ws = new WebSocket(url);
    this.ws.on("open", () => this.onOpen());
    this.ws.on("ping", () => this.onPing());
    this.ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
    this.ws.on("error", (error) => this.onError(error));
    this.ws.on("close", () => this.onClose());
  }

  private onOpen() {
    this.emit("connected");
    this.ws?.send(
      JSON.stringify({
        type: "options_update",
        payload: {
          wantedCollections: this.wantedCollections,
          wantedDids: this.wantedDIDs,
          maxMessageSizeBytes: 1000000,
        },
      }),
    );
  }

  private onPing() {
    this.emit("ping");
  }

  private onMessage(data: WebSocket.RawData, isBinary: boolean) {
    if (this.useCompression === false && isBinary === false) {
      const message = (data as Buffer).toString();
      this.onEvent(message);
    } else if (
      this.useCompression === true &&
      this.dictionary !== undefined &&
      isBinary === true
    ) {
      try {
        const message = zlib
          .zstdDecompressSync(data as Buffer, {
            dictionary: this.dictionary,
          })
          .toString();
        this.onEvent(message);
      } catch (error) {
        console.error(error);
      }
    }
  }

  private onEvent(data: string) {
    try {
      const event = JSON.parse(data) as
        | CommitEvent
        | AccountEvent
        | IdentityEvent;
      this.onCursor(event.time_us);
      switch (event.kind) {
        case EventKind.Commit:
          this.emit("commit", event as CommitEvent);
          switch ((event as CommitEvent).commit.operation) {
            case CommitOperation.Create:
              this.emit("create", event as CommitCreateEvent);
              break;
            case CommitOperation.Update:
              this.emit("update", event as CommitUpdateEvent);
              break;
            case CommitOperation.Delete:
              this.emit("delete", event as CommitDeleteEvent);
              break;
          }
          break;
        case EventKind.Account:
          this.emit("account", event as AccountEvent);
          break;
        case EventKind.Identity:
          this.emit("identity", event as IdentityEvent);
          break;
      }
    } catch (error) {
      console.error(error);
    }
  }

  private onCursor(cursor: number) {
    this.cursor = cursor;
    this.emit("cursor", cursor);
  }

  private onError(error: Error) {
    this.emit("error", error);
  }

  private onClose() {
    this.emit("disconnected");
    if (this.reconnect === true)
      setTimeout(() => {
        this.emit("reconnecting");
        this.connect();
      }, this.reconnectDelay * 1000);
  }
}

export const EventKind = {
  Commit: "commit",
  Account: "account",
  Identity: "identity",
};
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

export interface EventBase {
  did: string;
  time_us: number;
  kind: EventKind;
}

export const CommitOperation = {
  Create: "create",
  Update: "update",
  Delete: "delete",
};
export type CommitOperation =
  (typeof CommitOperation)[keyof typeof CommitOperation];

export interface CommitBase {
  operation: CommitOperation;
  rev: string;
  collection: string;
  rkey: string;
}

export interface CommitCreate extends CommitBase {
  operation: typeof CommitOperation.Create;
  record: any;
  cid: string;
}

export interface CommitUpdate extends CommitBase {
  operation: typeof CommitOperation.Update;
  record: any;
  cid: string;
}

export interface CommitDelete extends CommitBase {
  operation: typeof CommitOperation.Delete;
}

export interface CommitEvent extends EventBase {
  kind: typeof EventKind.Commit;
  commit: CommitCreate | CommitUpdate | CommitDelete;
}

export interface CommitCreateEvent extends EventBase {
  kind: typeof EventKind.Commit;
  commit: CommitCreate;
}

export interface CommitUpdateEvent extends EventBase {
  kind: typeof EventKind.Commit;
  commit: CommitUpdate;
}

export interface CommitDeleteEvent extends EventBase {
  kind: typeof EventKind.Commit;
  commit: CommitDelete;
}

export const AccountStatus = {
  TakenDown: "takendown",
  Suspended: "suspended",
  Deleted: "deleted",
  Deactivated: "deactivated",
};
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export interface Account {
  seq: number;
  did: string;
  time: string;
  active: boolean;
  status?: AccountStatus;
}

export interface AccountEvent extends EventBase {
  kind: typeof EventKind.Account;
  account: Account;
}

export interface IdentityEvent extends EventBase {
  kind: typeof EventKind.Identity;
  identity: Identity;
}

export interface Identity {
  seq: number;
  did: string;
  time: string;
  handle?: string;
}
