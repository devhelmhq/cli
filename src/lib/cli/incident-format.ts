import type {z} from 'zod'
import type {schemas as apiSchemas} from '../api-zod.generated.js'

export type IncidentDto = z.infer<typeof apiSchemas.IncidentDto>

export function incidentLine(i: IncidentDto): string {
  const subject = i.monitorName ?? i.serviceName ?? i.resourceGroupName ?? ''
  return [i.id, i.status, i.severity, i.title ?? '', subject, i.startedAt ?? i.createdAt].filter(Boolean).join(' · ')
}
