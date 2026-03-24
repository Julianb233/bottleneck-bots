import WebSocket from 'ws';
import type { Computer } from './computer.js';

export class ComputerTerminal {
  private _ws: WebSocket | null = null;
  private _computer: Computer;
  private _onData: ((data: string) => void) | null = null;
  private _onClose: (() => void) | null = null;

  constructor(computer: Computer) {
    this._computer = computer;
  }

  async connect(): Promise<void> {
    // WebSocket server not yet implemented (Phase 05)
    // This is the client-side implementation ready for when it is
    const url = `ws://localhost:3000/ws/computers/${this._computer.id}/terminal`;
    this._ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      this._ws!.on('open', () => resolve());
      this._ws!.on('error', (err) => reject(err));
      this._ws!.on('message', (data) => {
        this._onData?.(data.toString());
      });
      this._ws!.on('close', () => {
        this._onClose?.();
      });
    });
  }

  write(data: string): void {
    this._ws?.send(data);
  }

  onData(callback: (data: string) => void): void {
    this._onData = callback;
  }

  onClose(callback: () => void): void {
    this._onClose = callback;
  }

  async close(): Promise<void> {
    this._ws?.close();
    this._ws = null;
  }
}
