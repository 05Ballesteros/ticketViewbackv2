// src/redis/redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    this.client = createClient({ url: "redis://redis:6379" });
    this.client.on('error', (err) => console.error('❌ Redis error:', err));
    await this.client.connect();
    console.log('🔗 Redis conectado');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  // Métodos de utilidad
  async publish(channel: string, message: any): Promise<number> {
    return this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subClient = this.client.duplicate();
    await subClient.connect();
    await subClient.subscribe(channel, callback);
  }
}
