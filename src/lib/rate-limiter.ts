import { setTimeout } from "node:timers/promises";

interface RateLimiterOptions {
  rpm: number;
  tpm: number;
}

export class RateLimiter {
  private rpm: number;
  private tpm: number;
  private requestLog: number[] = [];
  private tokenLog: { timestamp: number; tokens: number }[] = [];
  private name: string;

  constructor(options: RateLimiterOptions, name = "RateLimiter") {
    this.rpm = options.rpm;
    this.tpm = options.tpm;
    this.name = name;
  }

  private cleanOldLogs() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestLog = this.requestLog.filter((t) => t > oneMinuteAgo);
    this.tokenLog = this.tokenLog.filter((l) => l.timestamp > oneMinuteAgo);
  }

  async acquire(estimatedTokens: number) {
    while (true) {
      this.cleanOldLogs();
      const now = Date.now();

      const currentRpm = this.requestLog.length;
      const currentTpm = this.tokenLog.reduce(
        (sum, log) => sum + log.tokens,
        0,
      );

      if (currentRpm < this.rpm && currentTpm + estimatedTokens <= this.tpm) {
        this.requestLog.push(now);
        this.tokenLog.push({ timestamp: now, tokens: estimatedTokens });
        return;
      }

      const waitTime = 2000; // Check every 2 seconds
      console.log(
        `[${this.name}] 🚦 Limit reached (RPM: ${currentRpm}/${this.rpm}, TPM: ${currentTpm}/${this.tpm}). Waiting ${waitTime}ms...`,
      );
      await setTimeout(waitTime);
    }
  }
}
