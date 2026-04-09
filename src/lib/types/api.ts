export interface EvolutionGroupDto {
  id?: string;
  jid?: string;
  subject?: string;
  name?: string;
  size?: number;
  participants?: unknown[];
  isGroup?: boolean;
  archived?: boolean;
  announce?: boolean;
  onlyAdminsCanSend?: boolean;
  adminOnly?: boolean;
  onlyAdmin?: boolean;
  groupMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EvolutionInstanceDto {
  id?: string;
  name?: string;
  instanceName?: string;
  ownerJid?: string;
  number?: string;
  instance?: {
    instanceName?: string;
    status?: string;
    ownerJid?: string;
    number?: string;
  };
  [key: string]: unknown;
}

export interface EvolutionSettingsDto {
  groups_ignore?: boolean;
  [key: string]: unknown;
}

export interface EvolutionSendMediaRequest {
  number: string;
  mediatype: 'image';
  media: string;
  caption?: string;
}

export interface EvolutionSendTextRequest {
  number: string;
  text: string;
}

export interface EvolutionApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}
