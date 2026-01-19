export interface Token {
  text: string;
  pivot: number;
  isSentenceEnd: boolean;
  isParagraphEnd: boolean;
  pauseMultiplier: number;
  sentenceIndex: number;
  paragraphIndex: number;
}

export interface Chunk {
  chunkIndex: number;
  tokens: Token[];
}
