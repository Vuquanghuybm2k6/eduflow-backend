import { randomUUID } from 'node:crypto';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';

@EventSubscriber()
export class UuidValueGeneratorSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    const { entity, metadata } = event;
    const now = new Date();
    for (const column of metadata.columns) {
      const value = column.getEntityValue(entity);
      if (value !== undefined) {
        continue;
      }
      if (column.isPrimary && column.generationStrategy === 'uuid') {
        column.setEntityValue(entity, randomUUID());
      } else if (column.isCreateDate || column.isUpdateDate) {
        column.setEntityValue(entity, now);
      }
    }
  }
}