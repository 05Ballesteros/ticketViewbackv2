import { Types } from "mongoose";
import { RedisService } from "src/redis/redis.service";
export const normalizeUserIds = (
  inputs: (string | Types.ObjectId | null | undefined | (string | Types.ObjectId | null | undefined)[])[]
): string[] => {
  return inputs
    .flat()
    .filter((id): id is string | Types.ObjectId => Boolean(id))
    .map(id => id instanceof Object ? id.toString() : id)
    .filter((id): id is string => typeof id === 'string'); // <- asegura solo strings
};

export const generateNotification = async (redisService: RedisService, userIds: any[], ticketId: number, mensaje: string, tipo: string) => {
    const userIdsNormialized = normalizeUserIds(userIds);

    return await redisService.publish('notificaciones', {
        userIds: userIdsNormialized,
        ticketId,
        mensaje,
        tipo,
    });
}


