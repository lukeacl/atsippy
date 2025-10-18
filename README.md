# ATSippy

A reconnecting compression supporting client for the Bluesky [Jetstream](https://github.com/bluesky-social/jetstream) service.

## Installation

```sh
npm install atsippy
```

## Example Usage

```js
import { ATSippy } from "atsippy";

const sippy = new ATSippy();

//sippy.cursor = 0;
//sippy.endpoint = "wss://jetstream1.us-west.bsky.network/subscribe";
//sippy.reconnect = true;
//sippy.reconnectDelay = 3000;
//sippy.useCompression = true;
sippy.wantedCollections = ["app.bsky.actor.profile"];
sippy.wantedDIDs = ["did:plc:mfl5calppp7zoa44zt6pymie"];

sippy.on("connected", () => {
  console.log("Connected");
});

sippy.on("ping", () => {
  console.log("Ping!");
});

sippy.on("cursor", (cursor) => {});

sippy.on("commit", (event) => {});

sippy.on("create", (event) => {});

sippy.on("update", (event) => {});

sippy.on("delete", (event) => {});

sippy.on("account", (event) => {});

sippy.on("identity", (event) => {});

sippy.on("disconnected", () => {
  console.log("Disconnected");
});

sippy.on("reconnecting", () => {
  console.log("Reconnecting...");
});

sippy.connect();
```
