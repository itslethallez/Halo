export interface AiConversationTurn {
  role: "assistant" | "client";
  text: string;
}

export interface AiReplyContext {
  workerDisplayName: string;
  toneStyle: "WARM_FRIENDLY" | "PROFESSIONAL" | "CASUAL" | "BRIEF_DIRECT" | "CUSTOM";
  customToneDescription?: string;
  /** A short, factual system brief the caller builds from real data (services, prices,
   * availability already computed by the booking engine) — the AI provider must never invent
   * availability or prices itself. */
  systemBrief: string;
  history: AiConversationTurn[];
  latestClientMessage: string;
}

export interface AiReply {
  text: string;
  /** 0..1 confidence the provider has in this reply being safe/appropriate to send unsupervised. */
  confidence: number;
}

export interface AiProvider {
  readonly providerName: string;
  generateReply(context: AiReplyContext): Promise<AiReply>;
}
