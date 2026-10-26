import {apiGetPage, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {MonitorDto} from './resolve.js'

/** Every monitor in Trash (`GET /monitors/trash`, flat page/size). */
export async function findTrashed(client: ApiClient): Promise<MonitorDto[]> {
  const out: MonitorDto[] = []
  for (let page = 0; page < 50; page++) {
    const resp = await apiGetPage(client, '/api/v1/monitors/trash', apiSchemas.MonitorDto, {query: {page, size: 100}})
    out.push(...resp.data)
    if (!resp.hasNext) break
  }
  return out
}
