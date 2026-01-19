import type { Token } from '@speed-reader/types';

export interface RSVPConfig {
  wpm: number;
  chunkSize: number;
}

export interface RSVPCallbacks {
  onTokenChange: (tokens: Token[], index: number) => void;
  onStateChange: (isPlaying: boolean) => void;
  onPositionChange: (index: number) => void;
  onNeedMoreTokens: (currentChunk: number) => void;
}

export class RSVPEngine {
  private tokens: Token[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private config: RSVPConfig = { wpm: 300, chunkSize: 1 };
  private callbacks: RSVPCallbacks;
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  private accumulatedTime: number = 0;
  private totalTokens: number = 0;
  private tokensPerChunk: number = 5000;

  constructor(callbacks: RSVPCallbacks) {
    this.callbacks = callbacks;
  }

  setTokens(tokens: Token[], chunkIndex: number, totalTokens: number, tokensPerChunk: number = 5000): void {
    if (chunkIndex === 0) {
      this.tokens = tokens;
    } else {
      const expectedLength = chunkIndex * tokensPerChunk;
      if (this.tokens.length >= expectedLength) {
        this.tokens = [...this.tokens.slice(0, expectedLength), ...tokens];
      } else {
        this.tokens = [...this.tokens, ...tokens];
      }
    }
    this.totalTokens = totalTokens;
    this.tokensPerChunk = tokensPerChunk;
  }

  setConfig(config: Partial<RSVPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RSVPConfig {
    return { ...this.config };
  }

  setPosition(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.tokens.length - 1));
    this.accumulatedTime = 0;
    this.callbacks.onPositionChange(this.currentIndex);
    this.emitCurrentToken();
    this.checkNeedMoreTokens();
  }

  getPosition(): number {
    return this.currentIndex;
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  getAllLoadedTokens(): Token[] {
    return this.tokens;
  }

  play(): void {
    if (this.isPlaying || this.tokens.length === 0) return;

    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.accumulatedTime = 0;
    this.callbacks.onStateChange(true);
    this.tick();
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.callbacks.onStateChange(false);
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  getCurrentChunk(): Token[] {
    const start = this.currentIndex;
    const end = Math.min(start + this.config.chunkSize, this.tokens.length);
    return this.tokens.slice(start, end);
  }

  private tick = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    this.accumulatedTime += deltaTime;

    const currentToken = this.tokens[this.currentIndex];
    const baseDelay = this.getBaseDelay();
    const adjustedDelay = baseDelay * (currentToken?.pauseMultiplier || 1);

    if (this.accumulatedTime >= adjustedDelay) {
      this.accumulatedTime -= adjustedDelay;
      this.advance();
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private getBaseDelay(): number {
    return 60000 / this.config.wpm;
  }

  private advance(): void {
    const nextIndex = this.currentIndex + this.config.chunkSize;

    if (nextIndex >= this.totalTokens) {
      this.pause();
      return;
    }

    this.currentIndex = Math.min(nextIndex, this.tokens.length - 1);
    this.callbacks.onPositionChange(this.currentIndex);
    this.emitCurrentToken();
    this.checkNeedMoreTokens();
  }

  private emitCurrentToken(): void {
    const chunk = this.getCurrentChunk();
    this.callbacks.onTokenChange(chunk, this.currentIndex);
  }

  private checkNeedMoreTokens(): void {
    const currentChunk = Math.floor(this.currentIndex / this.tokensPerChunk);
    const positionInChunk = this.currentIndex % this.tokensPerChunk;
    const threshold = this.tokensPerChunk * 0.8;

    if (positionInChunk >= threshold) {
      const nextChunk = currentChunk + 1;
      const maxChunks = Math.ceil(this.totalTokens / this.tokensPerChunk);

      if (nextChunk < maxChunks && this.tokens.length < (nextChunk + 1) * this.tokensPerChunk) {
        this.callbacks.onNeedMoreTokens(nextChunk);
      }
    }
  }

  destroy(): void {
    this.pause();
    this.tokens = [];
    this.currentIndex = 0;
  }
}
