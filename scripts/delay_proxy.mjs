// A far connection on the local stack: a proxy in front of the game server
// that holds every WebSocket message for DELAY_MS each way (a round trip of
// twice that) and passes HTTP through, for trying the own champion's
// prediction (src/net/self_predict.ts) the way a player far from the
// server plays. Point the Vite client's proxy at it:
//
//   PORT=8861 NO_CLIENT=1 .claude/skills/dev-server/stack.sh up
//   LISTEN=8862 TARGET=8861 DELAY_MS=250 node scripts/delay_proxy.mjs &
//   PORT=8862 pnpm exec vite --port 5361 --strictPort
//
// Messages keep their order; the session cookie rides the upgrade, the
// page's origin does not (the server takes a socket with none).

import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const LISTEN = Number(process.env.LISTEN ?? 8788);
const TARGET = Number(process.env.TARGET ?? 8787);
const DELAY_MS = Number(process.env.DELAY_MS ?? 250);

const server = http.createServer((req, res) => {
  const up = http.request(
    { host: '127.0.0.1', port: TARGET, path: req.url, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  up.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(up);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (client) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${TARGET}${req.url ?? '/'}`, {
      headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
    });
    // What the page sent before the server's side opened, in order.
    const early = [];
    const toServer = (data, binary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary });
      else if (upstream.readyState === WebSocket.CONNECTING) early.push([data, binary]);
    };
    upstream.on('open', () => {
      for (const [data, binary] of early.splice(0)) upstream.send(data, { binary });
    });
    client.on('message', (data, binary) => setTimeout(() => toServer(data, binary), DELAY_MS));
    upstream.on('message', (data, binary) =>
      setTimeout(() => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary });
      }, DELAY_MS),
    );
    const closeBoth = () => {
      setTimeout(() => {
        if (client.readyState <= WebSocket.OPEN) client.close();
        if (upstream.readyState <= WebSocket.OPEN) upstream.close();
      }, DELAY_MS);
    };
    client.on('close', closeBoth);
    upstream.on('close', closeBoth);
    client.on('error', closeBoth);
    upstream.on('error', closeBoth);
  });
});

server.listen(LISTEN, '127.0.0.1', () => {
  console.log(`delay proxy :${LISTEN} -> :${TARGET}, ${DELAY_MS} ms each way`);
});
