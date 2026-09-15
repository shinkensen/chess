// Stockfish Web Worker
// This file should be in public/stockfish-worker.js

importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');

let stockfish = null;

self.onmessage = function(e) {
  const msg = e.data;
  
  if (msg === 'uci') {
    stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
    stockfish.onmessage = function(event) {
      self.postMessage(event.data);
      if (event.data === 'uciok') {
        self.postMessage('ready');
      }
    };
    stockfish.postMessage('uci');
  } else if (stockfish) {
    stockfish.postMessage(msg);
  }
};
