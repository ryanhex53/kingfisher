const Store = require('electron-store');
const store = new Store({cwd: process.env.KFCONFIG_DIR});
const { randomPairCode } = require('../helper');

//Multicast Server sending messages
let PAIR_CODE = store.get('pair_code', 'E418');
let http_port = undefined;
let KEY = Buffer.from('0123456789AB' + PAIR_CODE);
const PORT = 41848;
//not your IP and should be a Class D address
const MCAST_ADDR = "230.185.192.108";

const crypto = require('crypto');

const { networkInterfaces, hostname } = require('os');
const host_name = hostname();
const nets = networkInterfaces();

const dgram = require('dgram');
const server = dgram.createSocket({ type: "udp4", reuseAddr: true });

server.bind(PORT, '0.0.0.0', function () {
  server.setMulticastLoopback(false);
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        server.addMembership(MCAST_ADDR, net.address);
        console.log('member', net.address);
      }
    }
  }
  console.log('udp', server.address());
  setInterval(() => {
    if (!http_port)
      return;
    const message = { channel: 'server-report', host_name, http_port };
    const msg = Buffer.from(JSON.stringify(message));
    const cipher = crypto.createCipheriv('AES-128-CBC', KEY, KEY);
    const buf = Buffer.concat([cipher.update(msg), cipher.final()]);
    server.send(buf, 0, buf.length, PORT, MCAST_ADDR);
  }, 1000);
});

server.on('message', function (message, remote) {
  const decipher = crypto.createDecipheriv('AES-128-CBC', KEY, KEY);
  try {
    const body = JSON.parse(Buffer.concat([decipher.update(message), decipher.final()]));
    console.log('MCast Msg: From: ' + remote.address + ':' + remote.port + ' - ' + body);
    if (body.channel === 'server-report') {
      body.remote_address = remote.address;
    }
    process.send(body);
  } catch (error) {
    console.error(error.message);
  }
});

process.on('message', message => {
  if (message.channel === 'http-up') {
    http_port = message.address.port;
  } else if (message.channel === 'pair-code-change') {
    PAIR_CODE = message.pair_code;
    KEY = Buffer.from('0123456789AB' + PAIR_CODE);
  } else {
    console.warn('udp receive unknow message');
  }
});