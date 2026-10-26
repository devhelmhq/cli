import {Args} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class RuntimesShow extends DevhelmCommand {
  static description = 'Show one runtime: packages and versions, lifecycle dates and the browser capability envelope'
  static examples = ['<%= config.bin %> runtimes show 2026.11']
  static args = {id: Args.string({description: 'Runtime id, e.g. 2026.11', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RuntimesShow)
    const rt = await apiGetSingle(this.client(), `/api/v1/synthetics/runtime-profiles/${encodeURIComponent(args.id)}`, apiSchemas.RuntimeProfileDto)
    await this.finish({
      data: rt,
      human: () => {
        this.log(`${rt.id} · ${rt.status} · node ${rt.nodeVersion} · playwright ${rt.playwrightVersion}`)
        if (rt.availableAt) this.log(`  available:  ${rt.availableAt}`)
        if (rt.deprecatedAt) this.log(`  deprecated: ${rt.deprecatedAt}`)
        if (rt.eolAt) this.log(`  end of life: ${rt.eolAt}`)
        const pkgs = Object.entries(rt.packages ?? {})
        if (pkgs.length > 0) {
          this.log('  packages:')
          for (const [name, version] of pkgs.sort(([a], [b]) => a.localeCompare(b))) this.log(`    ${name} ${version ?? ''}`)
        }
        if (rt.nodeBuiltins?.length) this.log(`  node builtins: ${rt.nodeBuiltins.join(', ')}`)
        if (rt.reservedBindings?.length) this.log(`  reserved bindings: ${rt.reservedBindings.join(', ')}`)
        if (rt.browser) {
          const caps = Object.entries(rt.browser).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`)
          this.log(`  browser: ${caps.join(' · ')}`)
        }
      },
    })
  }
}
