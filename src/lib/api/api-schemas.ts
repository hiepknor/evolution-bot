import { z } from 'zod';

export const evolutionGroupDtoSchema = z
  .object({
    id: z.unknown().optional(),
    jid: z.unknown().optional(),
    subject: z.unknown().optional(),
    name: z.unknown().optional(),
    size: z.unknown().optional(),
    participants: z.unknown().optional(),
    isGroup: z.unknown().optional(),
    archived: z.unknown().optional(),
    announce: z.unknown().optional(),
    onlyAdminsCanSend: z.unknown().optional(),
    adminOnly: z.unknown().optional(),
    onlyAdmin: z.unknown().optional(),
    groupMetadata: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .catchall(z.unknown());

const evolutionInstanceInfoSchema = z
  .object({
    instanceName: z.unknown().optional(),
    status: z.unknown().optional(),
    ownerJid: z.unknown().optional(),
    number: z.unknown().optional()
  })
  .catchall(z.unknown());

export const evolutionInstanceDtoSchema = z
  .object({
    id: z.unknown().optional(),
    name: z.unknown().optional(),
    instanceName: z.unknown().optional(),
    ownerJid: z.unknown().optional(),
    number: z.unknown().optional(),
    instance: evolutionInstanceInfoSchema.optional()
  })
  .catchall(z.unknown());

export const evolutionSettingsDtoSchema = z
  .object({
    groups_ignore: z.unknown().optional()
  })
  .catchall(z.unknown());

export const evolutionSendMediaRequestSchema = z.object({
  number: z.string().min(1),
  mediatype: z.literal('image'),
  media: z.string().min(1),
  caption: z.string().optional()
});

export const evolutionSendTextRequestSchema = z.object({
  number: z.string().min(1),
  text: z.string().min(1)
});
